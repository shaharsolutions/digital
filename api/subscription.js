const {
  TRIAL_DURATION_MS,
  isAdminEmail,
  verifyFirebaseIdToken,
  getOrCreateUser,
  evaluateAccessState,
  getDocument,
  setDocument
} = require('./_lib/firebaseAdmin');
const {
  getTranzilaConfig,
  resolveUserSubscriptionPrice
} = require('./_lib/tranzila');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authUser = await verifyFirebaseIdToken(req);
    let userDoc = await getOrCreateUser(authUser);
    const tranzilaCfg = getTranzilaConfig();

    // Support sandbox/test state simulation for testing the 3-day trial & expiration flow
    if (req.method === 'POST' && (tranzilaCfg.mode === 'mock' || tranzilaCfg.sandboxControlsEnabled)) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const nowIso = new Date().toISOString();

      if (body.action === 'simulate_expire_trial') {
        const pastStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const pastEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
        userDoc = {
          ...userDoc,
          trialStartedAt: pastStart,
          trialEndsAt: pastEnd,
          subscriptionStatus: 'expired',
          currentPeriodEnd: undefined,
          cancelAtPeriodEnd: false,
          updatedAt: nowIso
        };
        await setDocument('users', authUser.uid, userDoc);
      } else if (body.action === 'simulate_reset_trial') {
        const nextEnd = new Date(Date.now() + TRIAL_DURATION_MS).toISOString();
        userDoc = {
          ...userDoc,
          trialStartedAt: nowIso,
          trialEndsAt: nextEnd,
          subscriptionStatus: 'trialing',
          currentPeriodEnd: undefined,
          cancelAtPeriodEnd: false,
          tranzilaStoId: undefined,
          cardLast4: undefined,
          cardExp: undefined,
          updatedAt: nowIso
        };
        await setDocument('users', authUser.uid, userDoc);
      }
    } else if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const access = evaluateAccessState(userDoc);
    const globalPricing = await getDocument('system_settings', 'pricing');
    const pricing = resolveUserSubscriptionPrice(userDoc, globalPricing);

    return res.status(200).json({
      uid: userDoc.uid,
      email: userDoc.email,
      displayName: userDoc.displayName || '',
      emailVerified: authUser.emailVerified,
      isAdmin: isAdminEmail(userDoc.email || authUser.email),
      subscriptionStatus: access.effectiveStatus,
      hasAccess: access.hasAccess,
      trialStartedAt: userDoc.trialStartedAt,
      trialEndsAt: userDoc.trialEndsAt,
      trialRemainingMs: access.trialRemainingMs,
      trialRemainingHours: access.trialRemainingHours,
      trialRemainingDays: access.trialRemainingDays,
      currentPeriodEnd: userDoc.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(userDoc.cancelAtPeriodEnd),
      cardLast4: userDoc.cardLast4 || null,
      cardExp: userDoc.cardExp || null,
      lastInvoiceUrl: userDoc.lastInvoiceUrl || null,
      priceIls: pricing.effectivePriceIls,
      basePriceIls: pricing.basePriceIls,
      discountPercent: pricing.discountPercent,
      hasCustomPricing: pricing.hasCustomPricing,
      billingMode: tranzilaCfg.mode,
      sandboxControlsEnabled: Boolean(tranzilaCfg.sandboxControlsEnabled),
      checkoutTerminalName: tranzilaCfg.checkoutTerminalName,
      stoTerminalName: tranzilaCfg.terminalName
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Internal Server Error'
    });
  }
};
