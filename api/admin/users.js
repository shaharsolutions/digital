const {
  isAdminEmail,
  verifyFirebaseIdToken,
  getDocument,
  setDocument,
  listDocuments,
  deleteDocument,
  deleteFirebaseAuthUser,
  evaluateAccessState
} = require('../_lib/firebaseAdmin');
const {
  SUBSCRIPTION_PRICE_ILS,
  cancelStandingOrder,
  findStandingOrder
} = require('../_lib/tranzila');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return {};
}

function formatUserForAdmin(u, nowMs = Date.now()) {
  const access = evaluateAccessState(u, nowMs);
  return {
    uid: u.uid,
    email: u.email || '',
    displayName: u.displayName || '',
    isAdmin: isAdminEmail(u.email),
    subscriptionStatus: access.effectiveStatus,
    rawStatus: u.subscriptionStatus || 'trialing',
    hasAccess: access.hasAccess,
    trialStartedAt: u.trialStartedAt || null,
    trialEndsAt: u.trialEndsAt || null,
    trialRemainingDays: access.trialRemainingDays,
    trialRemainingHours: access.trialRemainingHours,
    currentPeriodEnd: u.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(u.cancelAtPeriodEnd),
    tranzilaStoId: u.tranzilaStoId || null,
    cardLast4: u.cardLast4 || null,
    cardExp: u.cardExp || null,
    lastInvoiceUrl: u.lastInvoiceUrl || null,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authUser = await verifyFirebaseIdToken(req);
    if (!isAdminEmail(authUser.email)) {
      return res.status(403).json({
        error: 'גישה חסומה: פאנל הניהול זמין למנהל המערכת בלבד.'
      });
    }

    if (req.method === 'GET') {
      const rawUsers = await listDocuments('users', 500);
      const nowMs = Date.now();
      const users = rawUsers
        .filter((u) => u && (u.uid || u.email))
        .map((u) => formatUserForAdmin(u, nowMs))
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      const activeCount = users.filter((u) => u.subscriptionStatus === 'active').length;
      const trialingCount = users.filter((u) => u.subscriptionStatus === 'trialing').length;
      const canceledCount = users.filter((u) => u.subscriptionStatus === 'canceled').length;
      const expiredCount = users.filter(
        (u) => u.subscriptionStatus === 'expired' || u.subscriptionStatus === 'past_due'
      ).length;

      return res.status(200).json({
        ok: true,
        stats: {
          totalUsers: users.length,
          activeCount,
          trialingCount,
          canceledCount,
          expiredCount,
          estimatedMrrIls: activeCount * SUBSCRIPTION_PRICE_ILS
        },
        users
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || '').trim();
      const targetUid = String(body.targetUid || '').trim();

      if (!targetUid) {
        return res.status(400).json({ error: 'חסר מזהה משתמש (targetUid).' });
      }

      const targetUser = await getDocument('users', targetUid);
      if (!targetUser) {
        return res.status(404).json({ error: 'המשתמש המבוקש לא נמצא במסד הנתונים.' });
      }

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      let updatedUser = null;
      let message = '';

      if (action === 'grant_active') {
        const days = Math.max(1, Math.min(3650, Number(body.days) || 30));
        const periodEnd = new Date(nowMs + days * 24 * 60 * 60 * 1000).toISOString();
        updatedUser = {
          ...targetUser,
          subscriptionStatus: 'active',
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: nowIso
        };
        await setDocument('users', targetUid, updatedUser);
        message = `הופעל מנוי פעיל עבור ${targetUser.email} ל-${days} ימים.`;
      } else if (action === 'reset_trial') {
        const days = Math.max(1, Math.min(365, Number(body.days) || 3));
        const nextTrialEnd = new Date(nowMs + days * 24 * 60 * 60 * 1000).toISOString();
        updatedUser = {
          ...targetUser,
          subscriptionStatus: 'trialing',
          trialStartedAt: nowIso,
          trialEndsAt: nextTrialEnd,
          cancelAtPeriodEnd: false,
          updatedAt: nowIso
        };
        await setDocument('users', targetUid, updatedUser);
        message = `תקופת הניסיון של ${targetUser.email} אופסה/הוארכה ל-${days} ימים מלאים.`;
      } else if (action === 'expire_access') {
        const pastIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
        updatedUser = {
          ...targetUser,
          subscriptionStatus: 'expired',
          trialEndsAt: pastIso,
          currentPeriodEnd: pastIso,
          cancelAtPeriodEnd: false,
          updatedAt: nowIso
        };
        await setDocument('users', targetUid, updatedUser);
        message = `הגישה של ${targetUser.email} נחסמה והועברה לסטטוס "פג תוקף".`;
      } else if (action === 'cancel_subscription') {
        let stoIdToCancel = targetUser.tranzilaStoId || '';
        if (!stoIdToCancel && targetUser.email) {
          const remoteSto = await findStandingOrder({ clientEmail: targetUser.email });
          if (remoteSto && remoteSto.sto_id) {
            stoIdToCancel = String(remoteSto.sto_id);
          }
        }
        if (stoIdToCancel) {
          await cancelStandingOrder({
            stoId: stoIdToCancel,
            updatedByUser: authUser.email
          });
        }
        updatedUser = {
          ...targetUser,
          tranzilaStoId: stoIdToCancel || targetUser.tranzilaStoId,
          subscriptionStatus: 'canceled',
          cancelAtPeriodEnd: true,
          updatedAt: nowIso
        };
        await setDocument('users', targetUid, updatedUser);
        message = stoIdToCancel
          ? `הוראת הקבע (#${stoIdToCancel}) בטרנזילה בוטלה והמנוי של ${targetUser.email} הועבר לסטטוס "בוטל".`
          : `המנוי של ${targetUser.email} הועבר לסטטוס "בוטל".`;
      } else if (action === 'delete_user') {
        if (targetUid === authUser.uid) {
          return res.status(400).json({
            error: 'לא ניתן למחוק את חשבון מנהל המערכת המחובר כעת.'
          });
        }
        // Cancel active STO in Tranzila if present before deleting user
        if (targetUser.subscriptionStatus === 'active' && (targetUser.tranzilaStoId || targetUser.email)) {
          try {
            let stoId = targetUser.tranzilaStoId || '';
            if (!stoId && targetUser.email) {
              const remoteSto = await findStandingOrder({ clientEmail: targetUser.email });
              if (remoteSto && remoteSto.sto_id) stoId = String(remoteSto.sto_id);
            }
            if (stoId) {
              await cancelStandingOrder({ stoId, updatedByUser: authUser.email });
            }
          } catch (_) {}
        }

        await deleteDocument('users', targetUid);
        await deleteFirebaseAuthUser(targetUid);

        return res.status(200).json({
          ok: true,
          deletedUid: targetUid,
          message: `המשתמש ${targetUser.email} נמחק מהמערכת (Firestore + Firebase Auth).`
        });
      } else {
        return res.status(400).json({ error: `פעולת ניהול לא מוכרת: ${action}` });
      }

      return res.status(200).json({
        ok: true,
        message,
        user: formatUserForAdmin(updatedUser, nowMs)
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'שגיאה בביצוע פעולת ניהול'
    });
  }
};
