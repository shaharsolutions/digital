const { Pool } = require('pg');

let pool = null;

const VALID_TABLES = new Set([
  'users',
  'system_settings',
  'checkout_sessions',
  'payment_events',
  'activity_logs'
]);

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgres://storyline_app:58ae13764d4e5423919b4fcce131aafbda34ce1499f9c1f9@65.109.2.40:5433/storyline_saas'
  );
}

function getPool() {
  if (pool) return pool;

  const connectionString = getConnectionString();
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  pool = new Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
}

function sanitizeTableName(name) {
  const table = String(name || '').toLowerCase().trim();
  if (!VALID_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return table;
}

async function getDocument(collectionName, docId) {
  if (!docId) return null;
  const table = sanitizeTableName(collectionName);
  const p = getPool();

  const res = await p.query(
    `SELECT data FROM ${table} WHERE id = $1 LIMIT 1`,
    [String(docId)]
  );

  if (res.rows.length === 0) return null;
  const doc = res.rows[0].data || {};
  if (table === 'users' && !doc.uid) {
    doc.uid = String(docId);
  }
  return doc;
}

async function setDocument(collectionName, docId, data) {
  if (!docId || !data) return data;
  const table = sanitizeTableName(collectionName);
  const p = getPool();
  const cleanDocId = String(docId);

  // Normalize data object
  const cleanData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      cleanData[k] = v;
    }
  }
  if (table === 'users' && !cleanData.uid) {
    cleanData.uid = cleanDocId;
  }
  if (table === 'activity_logs' && !cleanData.id) {
    cleanData.id = cleanDocId;
  }

  const email = cleanData.email ? String(cleanData.email).trim() : null;
  const uid = cleanData.uid ? String(cleanData.uid).trim() : null;
  const action = cleanData.action ? String(cleanData.action).trim() : null;
  const category = cleanData.category ? String(cleanData.category).trim() : null;

  let queryText = '';
  let params = [];

  if (table === 'users') {
    queryText = `
      INSERT INTO users (id, email, data, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, users.email),
          data = users.data || EXCLUDED.data,
          updated_at = NOW()
      RETURNING data;
    `;
    params = [cleanDocId, email, JSON.stringify(cleanData)];
  } else if (table === 'activity_logs') {
    queryText = `
      INSERT INTO activity_logs (id, uid, action, category, data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET uid = COALESCE(EXCLUDED.uid, activity_logs.uid),
          action = COALESCE(EXCLUDED.action, activity_logs.action),
          category = COALESCE(EXCLUDED.category, activity_logs.category),
          data = activity_logs.data || EXCLUDED.data,
          updated_at = NOW()
      RETURNING data;
    `;
    params = [cleanDocId, uid, action, category, JSON.stringify(cleanData)];
  } else {
    queryText = `
      INSERT INTO ${table} (id, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = ${table}.data || EXCLUDED.data,
          updated_at = NOW()
      RETURNING data;
    `;
    params = [cleanDocId, JSON.stringify(cleanData)];
  }

  const res = await p.query(queryText, params);
  return res.rows[0]?.data || cleanData;
}

async function deleteDocument(collectionName, docId) {
  if (!docId) return true;
  const table = sanitizeTableName(collectionName);
  const p = getPool();

  await p.query(`DELETE FROM ${table} WHERE id = $1`, [String(docId)]);
  return true;
}

async function listDocuments(collectionName, pageSize = 300) {
  const table = sanitizeTableName(collectionName);
  const p = getPool();
  const limit = Math.min(1000, Math.max(1, Number(pageSize) || 300));

  const res = await p.query(
    `SELECT id, data FROM ${table} ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );

  return res.rows.map((r) => {
    const doc = r.data || {};
    if (table === 'users' && !doc.uid) {
      doc.uid = r.id;
    }
    return doc;
  });
}

async function findUserByField(fieldName, value) {
  if (!value) return null;
  const p = getPool();
  const strVal = String(value).trim();

  let res;
  if (fieldName === 'email') {
    res = await p.query(
      `SELECT data FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(data->>'email') = LOWER($1) LIMIT 1`,
      [strVal]
    );
  } else if (fieldName === 'uid') {
    res = await p.query(`SELECT data FROM users WHERE id = $1 LIMIT 1`, [strVal]);
  } else {
    res = await p.query(`SELECT data FROM users WHERE data->>$1 = $2 LIMIT 1`, [
      String(fieldName),
      strVal
    ]);
  }

  if (res.rows.length === 0) return null;
  return res.rows[0].data || null;
}

async function listActivityLogs({ limit = 300, uid = null, category = null, action = null } = {}) {
  const p = getPool();
  const maxLimit = Math.min(500, Math.max(1, Number(limit) || 300));

  const conditions = [];
  const params = [];

  if (uid) {
    params.push(String(uid).trim());
    conditions.push(`(uid = $${params.length} OR data->>'targetUid' = $${params.length})`);
  }

  if (category) {
    params.push(String(category).trim());
    conditions.push(`category = $${params.length}`);
  }

  if (action) {
    params.push(String(action).trim());
    conditions.push(`action = $${params.length}`);
  }

  params.push(maxLimit);
  const limitParamIndex = params.length;

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT data FROM activity_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${limitParamIndex}
  `;

  const res = await p.query(query, params);
  return res.rows.map((r) => r.data || {});
}

module.exports = {
  getPool,
  getDocument,
  setDocument,
  deleteDocument,
  listDocuments,
  findUserByField,
  listActivityLogs
};
