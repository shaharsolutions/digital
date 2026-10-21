const {
  verifyFirebaseIdToken,
  logActivity
} = require('./_lib/firebaseAdmin');

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

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body && typeof req.body === 'object' ? req.body : {});

    const action = String(body.action || '').trim();
    if (!action) {
      return res.status(400).json({ error: 'Missing required field: action' });
    }

    const category = String(body.category || 'general').trim();
    const description = String(body.description || '').trim();
    const details = body.details && typeof body.details === 'object' ? body.details : {};

    const activity = await logActivity({
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName,
      action,
      category,
      description,
      details,
      req
    });

    return res.status(200).json({
      ok: true,
      logId: activity ? activity.id : null
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Failed to record activity log'
    });
  }
};
