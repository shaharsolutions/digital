const {
  isAdminEmail,
  verifyFirebaseIdToken,
  listActivityLogs
} = require('../_lib/firebaseAdmin');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authUser = await verifyFirebaseIdToken(req);
    if (!isAdminEmail(authUser.email)) {
      return res.status(403).json({
        error: 'גישה חסומה: יומן הפעילות זמין למנהל המערכת בלבד.'
      });
    }

    if (req.method === 'GET') {
      const query = req.query || {};
      const limit = Math.min(500, Math.max(1, Number(query.limit) || 250));
      const targetUid = query.uid ? String(query.uid).trim() : null;
      const category = query.category && query.category !== 'all' ? String(query.category).trim() : null;
      const action = query.action && query.action !== 'all' ? String(query.action).trim() : null;
      const search = query.search ? String(query.search).trim().toLowerCase() : null;
      const timeRange = query.timeRange || 'all'; // 'all' | 'today' | '7d' | '30d'

      let rawLogs = await listActivityLogs({ limit: 500, uid: targetUid, category, action });

      // Apply time filter
      const nowMs = Date.now();
      if (timeRange === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startMs = startOfDay.getTime();
        rawLogs = rawLogs.filter((l) => Date.parse(l.createdAt || 0) >= startMs);
      } else if (timeRange === '7d') {
        const cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
        rawLogs = rawLogs.filter((l) => Date.parse(l.createdAt || 0) >= cutoffMs);
      } else if (timeRange === '30d') {
        const cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;
        rawLogs = rawLogs.filter((l) => Date.parse(l.createdAt || 0) >= cutoffMs);
      }

      // Apply text search
      if (search) {
        rawLogs = rawLogs.filter((l) => {
          const haystack = [
            l.email,
            l.displayName,
            l.description,
            l.action,
            l.category,
            l.ip,
            l.targetEmail,
            l.details && typeof l.details === 'object' ? JSON.stringify(l.details) : ''
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(search);
        });
      }

      // Calculate stats
      const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
      const loginsToday = rawLogs.filter(
        (l) => (l.action === 'user_login' || l.action === 'user_register') && Date.parse(l.createdAt || 0) >= oneDayAgo
      ).length;
      const scriptsGenerated = rawLogs.filter((l) => l.action === 'generate_scripts').length;
      const billingEvents = rawLogs.filter((l) => l.category === 'billing').length;

      const pagedLogs = rawLogs.slice(0, limit);

      return res.status(200).json({
        ok: true,
        stats: {
          total: rawLogs.length,
          loginsToday,
          scriptsGenerated,
          billingEvents
        },
        logs: pagedLogs
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'שגיאה בטעינת יומן הפעילות'
    });
  }
};
