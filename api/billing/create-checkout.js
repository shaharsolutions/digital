const crypto = require('crypto');
const {
  verifyFirebaseIdToken,
  getOrCreateUser,
  getDocument,
  setDocument
} = require('../_lib/firebaseAdmin');
const {
  resolveUserSubscriptionPrice,
  createHandshake,
  buildIframeCheckoutConfig
} = require('../_lib/tranzila');

function resolveBaseUrl(req) {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authUser = await verifyFirebaseIdToken(req);
    const userDoc = await getOrCreateUser(authUser);
    const globalPricing = await getDocument('system_settings', 'pricing');
    const pricing = resolveUserSubscriptionPrice(userDoc, globalPricing);
    const checkoutAmount = pricing.effectivePriceIls;

    const sessionId = 'chk_' + crypto.randomBytes(12).toString('hex');
    const dcDisable = `storyline_${authUser.uid.slice(0, 12)}_${sessionId}`;
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + 20 * 60 * 1000).toISOString(); // 20 minutes per Tranzila Handshake spec

    const baseUrl = resolveBaseUrl(req);

    // 1. Lock effective subscription amount on Tranzila server via Handshake API
    const handshake = await createHandshake({
      sum: checkoutAmount,
      sessionId,
      uid: authUser.uid,
      baseUrl
    });

    // 2. Store checkout session in Firestore for server-side verification when webhook arrives
    const sessionDoc = {
      sessionId,
      uid: authUser.uid,
      email: userDoc.email,
      amount: checkoutAmount,
      basePriceIls: pricing.basePriceIls,
      discountPercent: pricing.discountPercent,
      currency: 'ILS',
      thtk: handshake.thtk,
      dcDisable,
      status: 'pending',
      mode: handshake.mode,
      createdAt,
      expiresAt
    };

    await setDocument('checkout_sessions', sessionId, sessionDoc);

    // 3. Build Tranzila iFrame form configuration
    const iframeConfig = buildIframeCheckoutConfig({
      thtk: handshake.thtk,
      dcDisable,
      sessionId,
      user: userDoc,
      baseUrl,
      sum: checkoutAmount
    });

    return res.status(200).json({
      sessionId,
      amount: checkoutAmount,
      basePriceIls: pricing.basePriceIls,
      discountPercent: pricing.discountPercent,
      currency: 'ILS',
      mode: handshake.mode,
      iframe: iframeConfig
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Failed to initialize Tranzila checkout'
    });
  }
};
