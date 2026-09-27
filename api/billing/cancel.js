const {
  verifyFirebaseIdToken,
  getOrCreateUser,
  setDocument
} = require('../_lib/firebaseAdmin');
const { cancelStandingOrder, findStandingOrder } = require('../_lib/tranzila');

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

    if (userDoc.subscriptionStatus !== 'active') {
      return res.status(400).json({
        error: 'אין מנוי פעיל לביטול בחשבון זה.'
      });
    }

    // 1. Cancel recurring Standing Order (STO) in Tranzila My Billing (`shaharsoltok`)
    let stoIdToCancel = userDoc.tranzilaStoId || '';
    if (!stoIdToCancel && userDoc.email) {
      const remoteSto = await findStandingOrder({ clientEmail: userDoc.email });
      if (remoteSto && remoteSto.sto_id) {
        stoIdToCancel = String(remoteSto.sto_id);
      }
    }

    if (stoIdToCancel) {
      await cancelStandingOrder({
        stoId: stoIdToCancel,
        updatedByUser: authUser.uid
      });
    }

    const nowIso = new Date().toISOString();
    const updatedUser = {
      ...userDoc,
      tranzilaStoId: stoIdToCancel || userDoc.tranzilaStoId,
      subscriptionStatus: 'canceled',
      cancelAtPeriodEnd: true,
      updatedAt: nowIso
    };

    await setDocument('users', authUser.uid, updatedUser);

    // Log cancellation event
    const cancelEventId = `cancel_${authUser.uid}_${Date.now()}`;
    await setDocument('payment_events', cancelEventId, {
      eventId: cancelEventId,
      uid: authUser.uid,
      stoId: userDoc.tranzilaStoId || '',
      amount: 39,
      currency: 'ILS',
      responseCode: '000',
      eventType: 'subscription_canceled',
      createdAt: nowIso
    });

    return res.status(200).json({
      ok: true,
      subscriptionStatus: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: updatedUser.currentPeriodEnd,
      message: 'המנוי החודשי בוטל ולא יחויב עוד. הגישה למחולל תישאר פתוחה עד סוף תקופת החיוב הנוכחית.'
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'שגיאה בביטול המנוי מול ספק הסליקה'
    });
  }
};
