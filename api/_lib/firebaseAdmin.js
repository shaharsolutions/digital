const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'shahar-storyline-saas';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAtt8KrtnXH1S7tglh739Y2-YGO2xtvbpU';
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'temp-mail.org'
]);

const DEFAULT_ADMIN_EMAILS = new Set([
  'shaharc94@gmail.com',
  'shaharsolutions@gmail.com'
]);

function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.trim().toLowerCase();
  if (DEFAULT_ADMIN_EMAILS.has(lower)) return true;
  const customAdmins = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return customAdmins.includes(lower);
}

let adminApp = null;
let firestoreDb = null;
let adminInitAttempted = false;

function initFirebaseAdmin() {
  if (adminInitAttempted) {
    return { adminApp, firestoreDb };
  }
  adminInitAttempted = true;

  try {
    const admin = require('firebase-admin');
    const { getFirestore } = require('firebase-admin/firestore');

    if (admin.apps && admin.apps.length > 0) {
      adminApp = admin.apps[0];
      firestoreDb = getFirestore(adminApp);
      return { adminApp, firestoreDb };
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || FIREBASE_PROJECT_ID
      });
      firestoreDb = getFirestore(adminApp);
      return { adminApp, firestoreDb };
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      adminApp = admin.initializeApp({
        projectId: FIREBASE_PROJECT_ID
      });
      firestoreDb = getFirestore(adminApp);
      return { adminApp, firestoreDb };
    }
  } catch (_) {
    // Optional firebase-admin SDK not installed; native crypto JWT + Firestore REST API is used automatically
  }

  return { adminApp: null, firestoreDb: null };
}

let cachedSaToken = null;
let cachedSaTokenExp = 0;
let runtimeEnvLoaded = false;

const VAULT_DOC_ID = 'srv_8f4d9c2a1b7e6f3d5a0c9e8b2d4f6a1c7e9b3d5f8a2c4e6b';
const VAULT_KEY_HEX = '9a4f7c2e1b8d6a3f5c0e9b2d4f6a8c1e3b5d7f9a2c4e6b8d0f1a3c5e7b9d2f4a';

async function ensureRuntimeEnv() {
  if (runtimeEnvLoaded) return;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.TRANZILA_API_SECRET) {
    runtimeEnvLoaded = true;
    return;
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/_server_vault/${VAULT_DOC_ID}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      const blob = json && json.fields && json.fields.blob && json.fields.blob.stringValue;
      if (blob) {
        const [ivB64, tagB64, encB64] = String(blob).split('.');
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          Buffer.from(VAULT_KEY_HEX, 'hex'),
          Buffer.from(ivB64, 'base64')
        );
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        const decrypted = Buffer.concat([
          decipher.update(Buffer.from(encB64, 'base64')),
          decipher.final()
        ]).toString('utf8');
        const envVars = JSON.parse(decrypted);
        for (const [k, v] of Object.entries(envVars || {})) {
          if (process.env[k] === undefined && v !== undefined) {
            process.env[k] = String(v);
          }
        }
        runtimeEnvLoaded = true;
      }
    }
  } catch (_) {}
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Generates an OAuth2 access token from FIREBASE_SERVICE_ACCOUNT_JSON using built-in Node.js crypto,
 * or falls back to the local Firebase CLI token during local development.
 */
async function getFirestoreAccessToken() {
  await ensureRuntimeEnv();

  if (cachedSaToken && Date.now() < cachedSaTokenExp - 60000) {
    return cachedSaToken;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (sa && sa.client_email && sa.private_key) {
        const nowSec = Math.floor(Date.now() / 1000);
        const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const claimSet = base64UrlEncode(
          JSON.stringify({
            iss: sa.client_email,
            sub: sa.client_email,
             scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',
            aud: 'https://oauth2.googleapis.com/token',
            iat: nowSec,
            exp: nowSec + 3600
          })
        );
        const unsignedJwt = `${header}.${claimSet}`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsignedJwt);
        signer.end();
        const signature = base64UrlEncode(signer.sign(sa.private_key));
        const assertion = `${unsignedJwt}.${signature}`;

        const resp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`
        });
        if (resp.ok) {
          const tokenData = await resp.json();
          if (tokenData && tokenData.access_token) {
            cachedSaToken = tokenData.access_token;
            cachedSaTokenExp = Date.now() + Number(tokenData.expires_in || 3600) * 1000;
            return cachedSaToken;
          }
        }
      }
    } catch (err) {
      console.warn('Service account JWT token exchange warning:', err.message);
    }
  }

  try {
    const os = require('os');
    const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const tokens = raw && raw.tokens;
    if (tokens && tokens.access_token && tokens.expires_at && Number(tokens.expires_at) > Date.now() + 30000) {
      return tokens.access_token;
    }
  } catch (_) {
    // Ignore local CLI token errors
  }
  return null;
}

/**
 * Normalizes an email address to prevent multi-account trial abuse
 * (e.g. user+1@gmail.com or u.s.e.r@gmail.com).
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return trimmed;
  let [local, domain] = parts;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.split('+')[0].replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

function isDisposableEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  return Boolean(domain && DISPOSABLE_EMAIL_DOMAINS.has(domain));
}

/**
 * Verifies a Firebase Auth ID Token (JWT) sent in Authorization: Bearer <token>.
 * Uses firebase-admin when available, or verifies directly against Google Identity Toolkit REST API.
 */
async function verifyFirebaseIdToken(req) {
  await ensureRuntimeEnv();
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.statusCode = 401;
    throw err;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    const err = new Error('Empty Bearer token');
    err.statusCode = 401;
    throw err;
  }

  const { adminApp: app } = initFirebaseAdmin();
  if (app) {
    try {
      const decoded = await app.auth().verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email || '',
        emailVerified: Boolean(decoded.email_verified),
        displayName: decoded.name || decoded.email?.split('@')[0] || '',
        providerId: decoded.firebase?.sign_in_provider || 'password'
      };
    } catch (err) {
      const authErr = new Error('Invalid or expired authentication token');
      authErr.statusCode = 401;
      throw authErr;
    }
  }

  // Fallback verification via official Google Identity Toolkit accounts:lookup endpoint
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
  const resp = await fetch(lookupUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });

  if (!resp.ok) {
    const authErr = new Error('Invalid or expired Firebase ID token');
    authErr.statusCode = 401;
    throw authErr;
  }

  const data = await resp.json();
  const account = data && Array.isArray(data.users) && data.users[0];
  if (!account || !account.localId) {
    const authErr = new Error('User account not found');
    authErr.statusCode = 401;
    throw authErr;
  }

  const providerInfo = Array.isArray(account.providerUserInfo) ? account.providerUserInfo : [];
  const isGoogle = providerInfo.some((p) => p.providerId === 'google.com');

  return {
    uid: account.localId,
    email: account.email || '',
    emailVerified: Boolean(account.emailVerified || isGoogle),
    displayName: account.displayName || (account.email ? account.email.split('@')[0] : ''),
    providerId: isGoogle ? 'google.com' : 'password'
  };
}

// ===============================================================
// Firestore Document Serialization Helpers (Admin SDK + REST API + Local Fallback)
// ===============================================================

const LOCAL_STORE_PATH = path.join('/tmp', 'storyline-saas-firestore-cache.json');

function readLocalStore() {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));
    }
  } catch (_) {}
  return { users: {}, checkout_sessions: {}, payment_events: {}, normalized_emails: {} };
}

function writeLocalStore(store) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (_) {}
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'string') {
    // Convert ISO date strings for known timestamp fields when appropriate
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

const TIMESTAMP_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'trialStartedAt',
  'trialEndsAt',
  'currentPeriodEnd',
  'expiresAt'
]);

function objToFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (TIMESTAMP_FIELDS.has(k) && typeof v === 'string') {
      fields[k] = { timestampValue: new Date(v).toISOString() };
    } else {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function fromFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return firestoreFieldsToObj(v.mapValue.fields || {});
  return null;
}

function firestoreFieldsToObj(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

function normalizeAdminDoc(data) {
  if (!data) return null;
  const out = { ...data };
  for (const field of TIMESTAMP_FIELDS) {
    if (out[field] && typeof out[field].toDate === 'function') {
      out[field] = out[field].toDate().toISOString();
    } else if (out[field] instanceof Date) {
      out[field] = out[field].toISOString();
    }
  }
  return out;
}

function prepareForAdminWrite(data) {
  const admin = require('firebase-admin');
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) {
      if (admin.firestore && admin.firestore.FieldValue) {
        out[k] = admin.firestore.FieldValue.delete();
      }
      continue;
    }
    if (TIMESTAMP_FIELDS.has(k) && typeof v === 'string') {
      out[k] = admin.firestore.Timestamp.fromDate(new Date(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function getDocument(collectionName, docId) {
  const { firestoreDb: db } = initFirebaseAdmin();
  if (db) {
    const snap = await db.collection(collectionName).doc(docId).get();
    return snap.exists ? normalizeAdminDoc(snap.data()) : null;
  }

  const cliToken = await getFirestoreAccessToken();
  if (cliToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${cliToken}` }
    });
    if (resp.status === 404) return null;
    if (resp.ok) {
      const json = await resp.json();
      return firestoreFieldsToObj(json.fields);
    }
  }

  const store = readLocalStore();
  return (store[collectionName] && store[collectionName][docId]) || null;
}

async function setDocument(collectionName, docId, data) {
  // Always mirror in local store for instant consistency during local dev
  const store = readLocalStore();
  if (!store[collectionName]) store[collectionName] = {};
  const cleanData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) {
      cleanData[k] = v;
    }
  }
  store[collectionName][docId] = cleanData;
  writeLocalStore(store);

  const { firestoreDb: db } = initFirebaseAdmin();
  if (db) {
    await db.collection(collectionName).doc(docId).set(prepareForAdminWrite(data), { merge: true });
    return cleanData;
  }

  const cliToken = await getFirestoreAccessToken();
  if (cliToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${cliToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: objToFirestoreFields(data) })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`Firestore REST write warning (${collectionName}/${docId}):`, errText);
    }
  }

  return data;
}

async function findUserByField(fieldName, value) {
  if (!value) return null;
  const { firestoreDb: db } = initFirebaseAdmin();
  if (db) {
    const snap = await db.collection('users').where(fieldName, '==', value).limit(1).get();
    if (!snap.empty) {
      return normalizeAdminDoc(snap.docs[0].data());
    }
  }

  const cliToken = await getFirestoreAccessToken();
  if (cliToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cliToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: fieldName },
              op: 'EQUAL',
              value: { stringValue: String(value) }
            }
          },
          limit: 1
        }
      })
    });
    if (resp.ok) {
      const rows = await resp.json();
      const match = Array.isArray(rows) && rows.find((r) => r.document);
      if (match && match.document) {
        return firestoreFieldsToObj(match.document.fields);
      }
    }
  }

  const store = readLocalStore();
  const users = Object.values(store.users || {});
  return users.find((u) => u && u[fieldName] === value) || null;
}

async function listDocuments(collectionName, pageSize = 300) {
  const { firestoreDb: db } = initFirebaseAdmin();
  if (db) {
    const snap = await db.collection(collectionName).limit(pageSize).get();
    return snap.docs.map((d) => normalizeAdminDoc({ uid: d.id, ...d.data() }));
  }

  const cliToken = await getFirestoreAccessToken();
  if (cliToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=${pageSize}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${cliToken}` }
    });
    if (resp.ok) {
      const json = await resp.json();
      const docs = Array.isArray(json.documents) ? json.documents : [];
      return docs.map((d) => {
        const docId = String(d.name || '').split('/').pop();
        const obj = firestoreFieldsToObj(d.fields);
        return { uid: obj.uid || docId, ...obj };
      });
    }
  }

  const store = readLocalStore();
  return Object.values(store[collectionName] || {});
}

async function deleteDocument(collectionName, docId) {
  const store = readLocalStore();
  if (store[collectionName] && store[collectionName][docId]) {
    delete store[collectionName][docId];
    writeLocalStore(store);
  }

  const { firestoreDb: db } = initFirebaseAdmin();
  if (db) {
    await db.collection(collectionName).doc(docId).delete();
    return true;
  }

  const cliToken = await getFirestoreAccessToken();
  if (cliToken) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cliToken}` }
    });
  }
  return true;
}

async function deleteFirebaseAuthUser(uid) {
  if (!uid) return false;
  const { adminApp: app } = initFirebaseAdmin();
  if (app) {
    try {
      await app.auth().deleteUser(uid);
      return true;
    } catch (_) {}
  }

  const cliToken = await getFirestoreAccessToken();
  if (cliToken) {
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:delete`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cliToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ localId: String(uid) })
    });
    return resp.ok;
  }
  return false;
}

/**
 * Evaluates authoritative subscription state and access rights on the server.
 */
function evaluateAccessState(userDoc, nowMs = Date.now()) {
  const trialEndsMs = Date.parse(userDoc.trialEndsAt || 0);
  const periodEndMs = userDoc.currentPeriodEnd ? Date.parse(userDoc.currentPeriodEnd) : 0;

  let effectiveStatus = userDoc.subscriptionStatus || 'trialing';
  let hasAccess = false;

  if (effectiveStatus === 'active') {
    if (periodEndMs && nowMs < periodEndMs) {
      hasAccess = true;
    } else if (periodEndMs && nowMs >= periodEndMs) {
      effectiveStatus = 'expired';
      hasAccess = false;
    } else {
      hasAccess = true;
    }
  } else if (effectiveStatus === 'canceled') {
    // Canceled subscriptions retain access until the end of the paid period
    if (periodEndMs && nowMs < periodEndMs) {
      hasAccess = true;
    } else {
      effectiveStatus = 'expired';
      hasAccess = false;
    }
  } else if (effectiveStatus === 'trialing') {
    if (trialEndsMs > nowMs) {
      hasAccess = true;
    } else {
      effectiveStatus = 'expired';
      hasAccess = false;
    }
  } else {
    // 'past_due' or 'expired'
    hasAccess = false;
  }

  const trialRemainingMs = Math.max(0, trialEndsMs - nowMs);
  const trialRemainingHours = Math.ceil(trialRemainingMs / (1000 * 60 * 60));
  const trialRemainingDays = Math.ceil(trialRemainingMs / (1000 * 60 * 60 * 24));

  return {
    effectiveStatus,
    hasAccess,
    trialRemainingMs,
    trialRemainingHours,
    trialRemainingDays
  };
}

/**
 * Gets or creates the authoritative user document in Firestore.
 */
async function getOrCreateUser(authUser) {
  if (isDisposableEmail(authUser.email)) {
    const err = new Error('לא ניתן להירשם עם כתובת אימייל זמנית (Disposable Email). אנא השתמש בכתובת אימייל תקנית.');
    err.statusCode = 403;
    throw err;
  }

  let userDoc = await getDocument('users', authUser.uid);
  const nowIso = new Date().toISOString();

  if (!userDoc) {
    // Check if another account already used a trial with the same normalized email
    const normEmail = normalizeEmail(authUser.email);
    const store = readLocalStore();
    const priorTrialUsed = Boolean(store.normalized_emails && store.normalized_emails[normEmail]);

    const trialStartedAt = nowIso;
    const trialEndsAt = priorTrialUsed
      ? nowIso // Immediate expiration if normalized email already consumed a trial
      : new Date(Date.now() + TRIAL_DURATION_MS).toISOString();

    userDoc = {
      uid: authUser.uid,
      email: authUser.email,
      displayName: (authUser.displayName || '').slice(0, 100),
      createdAt: nowIso,
      updatedAt: nowIso,
      trialStartedAt,
      trialEndsAt,
      subscriptionStatus: priorTrialUsed ? 'expired' : 'trialing',
      cancelAtPeriodEnd: false
    };

    if (normEmail) {
      store.normalized_emails = store.normalized_emails || {};
      store.normalized_emails[normEmail] = authUser.uid;
      writeLocalStore(store);
    }

    await setDocument('users', authUser.uid, userDoc);
  } else {
    // Sync displayStatus if trial or period ended
    const { effectiveStatus } = evaluateAccessState(userDoc);
    if (effectiveStatus !== userDoc.subscriptionStatus) {
      userDoc = {
        ...userDoc,
        subscriptionStatus: effectiveStatus,
        updatedAt: nowIso
      };
      await setDocument('users', authUser.uid, userDoc);
    }
  }

  return userDoc;
}

module.exports = {
  FIREBASE_PROJECT_ID,
  FIREBASE_API_KEY,
  TRIAL_DURATION_MS,
  ensureRuntimeEnv,
  isAdminEmail,
  verifyFirebaseIdToken,
  getDocument,
  setDocument,
  listDocuments,
  deleteDocument,
  deleteFirebaseAuthUser,
  findUserByField,
  getOrCreateUser,
  evaluateAccessState
};
