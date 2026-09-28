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
  resolveUserSubscriptionPrice,
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

function normalizeGlobalPricing(doc) {
  const basePriceIls =
    doc && Number(doc.basePriceIls) >= 1
      ? Math.round(Number(doc.basePriceIls) * 100) / 100
      : SUBSCRIPTION_PRICE_ILS;
  const globalDiscountPercent =
    doc && Number.isFinite(Number(doc.globalDiscountPercent))
      ? Math.max(0, Math.min(100, Math.round(Number(doc.globalDiscountPercent) * 100) / 100))
      : 0;
  const effectivePriceIls = Math.max(
    1,
    Math.round(basePriceIls * (1 - globalDiscountPercent / 100) * 100) / 100
  );
  return {
    basePriceIls,
    globalDiscountPercent,
    effectivePriceIls,
    updatedAt: (doc && doc.updatedAt) || null
  };
}

function formatUserForAdmin(u, nowMs = Date.now(), globalPricing = null) {
  const access = evaluateAccessState(u, nowMs);
  const pricing = resolveUserSubscriptionPrice(u, globalPricing);
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
    basePriceIls: pricing.basePriceIls,
    discountPercent: pricing.discountPercent,
    customPriceIls:
      u.customPriceIls !== undefined && u.customPriceIls !== null && u.customPriceIls !== ''
        ? Number(u.customPriceIls)
        : null,
    userDiscountPercent:
      u.discountPercent !== undefined && u.discountPercent !== null && u.discountPercent !== ''
        ? Number(u.discountPercent)
        : null,
    effectivePriceIls: pricing.effectivePriceIls,
    hasCustomPricing: pricing.hasCustomPricing,
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

    const rawGlobalPricing = await getDocument('system_settings', 'pricing');
    let globalPricing = normalizeGlobalPricing(rawGlobalPricing);

    if (req.method === 'GET') {
      const rawUsers = await listDocuments('users', 500);
      const nowMs = Date.now();
      const users = rawUsers
        .filter((u) => u && (u.uid || u.email))
        .map((u) => formatUserForAdmin(u, nowMs, globalPricing))
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      const activeUsers = users.filter((u) => u.subscriptionStatus === 'active');
      const activeCount = activeUsers.length;
      const trialingCount = users.filter((u) => u.subscriptionStatus === 'trialing').length;
      const canceledCount = users.filter((u) => u.subscriptionStatus === 'canceled').length;
      const expiredCount = users.filter(
        (u) => u.subscriptionStatus === 'expired' || u.subscriptionStatus === 'past_due'
      ).length;

      const estimatedMrrIls =
        Math.round(
          activeUsers.reduce((sum, u) => sum + (Number(u.effectivePriceIls) || globalPricing.effectivePriceIls), 0) *
            100
        ) / 100;

      return res.status(200).json({
        ok: true,
        globalPricing,
        stats: {
          totalUsers: users.length,
          activeCount,
          trialingCount,
          canceledCount,
          expiredCount,
          estimatedMrrIls
        },
        users
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || '').trim();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      // Global system pricing action (does not require targetUid)
      if (action === 'update_global_pricing') {
        const basePriceIls = Math.max(
          1,
          Math.round((Number(body.basePriceIls) || SUBSCRIPTION_PRICE_ILS) * 100) / 100
        );
        let globalDiscountPercent = 0;
        if (body.customPriceIls !== undefined && body.customPriceIls !== null && body.customPriceIls !== '') {
          const targetPrice = Math.max(1, Math.round(Number(body.customPriceIls) * 100) / 100);
          globalDiscountPercent = Math.max(
            0,
            Math.min(100, Math.round(((basePriceIls - targetPrice) / basePriceIls) * 10000) / 100)
          );
        } else if (body.globalDiscountPercent !== undefined) {
          globalDiscountPercent = Math.max(
            0,
            Math.min(100, Math.round((Number(body.globalDiscountPercent) || 0) * 100) / 100)
          );
        }

        const effectivePriceIls = Math.max(
          1,
          Math.round(basePriceIls * (1 - globalDiscountPercent / 100) * 100) / 100
        );

        const newPricingDoc = {
          basePriceIls,
          globalDiscountPercent,
          effectivePriceIls,
          updatedBy: authUser.email,
          updatedAt: nowIso
        };

        await setDocument('system_settings', 'pricing', newPricingDoc);
        globalPricing = normalizeGlobalPricing(newPricingDoc);

        return res.status(200).json({
          ok: true,
          globalPricing,
          message:
            globalDiscountPercent > 0
              ? `תמחור המערכת עודכן: מחיר בסיס ₪${basePriceIls}, הנחה גורפת ${globalDiscountPercent}% -> מחיר לתשלום ₪${effectivePriceIls}.`
              : `תמחור המערכת עודכן: מחיר לתשלום ₪${effectivePriceIls} לחודש.`
        });
      }

      const targetUid = String(body.targetUid || '').trim();

      if (!targetUid) {
        return res.status(400).json({ error: 'חסר מזהה משתמש (targetUid).' });
      }

      const targetUser = await getDocument('users', targetUid);
      if (!targetUser) {
        return res.status(404).json({ error: 'המשתמש המבוקש לא נמצא במסד הנתונים.' });
      }

      let updatedUser = null;
      let message = '';

      if (action === 'set_user_pricing') {
        const basePrice = globalPricing.basePriceIls || SUBSCRIPTION_PRICE_ILS;

        if (body.reset) {
          updatedUser = {
            ...targetUser,
            discountPercent: undefined,
            customPriceIls: undefined,
            updatedAt: nowIso
          };
          await setDocument('users', targetUid, updatedUser);
          message = `התמחור האישי של ${targetUser.email} אופס לתמחור המערכת (₪${globalPricing.effectivePriceIls}).`;
        } else {
          let discountPercent = undefined;
          let customPriceIls = undefined;

          const hasExplicitPrice =
            body.customPriceIls !== undefined &&
            body.customPriceIls !== null &&
            String(body.customPriceIls).trim() !== '';
          const hasExplicitDiscount =
            body.discountPercent !== undefined &&
            body.discountPercent !== null &&
            String(body.discountPercent).trim() !== '';

          if (hasExplicitPrice) {
            customPriceIls = Math.max(1, Math.round(Number(body.customPriceIls) * 100) / 100);
            discountPercent =
              basePrice > customPriceIls
                ? Math.max(0, Math.min(100, Math.round(((basePrice - customPriceIls) / basePrice) * 10000) / 100))
                : 0;
          } else if (hasExplicitDiscount) {
            discountPercent = Math.max(
              0,
              Math.min(100, Math.round(Number(body.discountPercent) * 100) / 100)
            );
            customPriceIls = Math.max(
              1,
              Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
            );
          } else {
            return res.status(400).json({
              error: 'יש להזין אחוז הנחה או מחיר לתשלום בשקלים.'
            });
          }

          updatedUser = {
            ...targetUser,
            discountPercent,
            customPriceIls,
            updatedAt: nowIso
          };
          await setDocument('users', targetUid, updatedUser);
          message =
            discountPercent > 0
              ? `עודכן מחיר אישי עבור ${targetUser.email}: ₪${customPriceIls} לחודש (${discountPercent}% הנחה).`
              : `עודכן מחיר אישי עבור ${targetUser.email}: ₪${customPriceIls} לחודש.`;
        }
      } else if (action === 'grant_active') {
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
        if (stoIdToCancel || targetUser.email) {
          const cancelRes = await cancelStandingOrder({
            stoId: stoIdToCancel,
            clientEmail: targetUser.email,
            updatedByUser: authUser.email
          });
          if (cancelRes && cancelRes.stoId) {
            stoIdToCancel = String(cancelRes.stoId);
          }
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
        user: formatUserForAdmin(updatedUser, nowMs, globalPricing)
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
