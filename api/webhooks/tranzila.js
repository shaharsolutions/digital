const querystring = require('querystring');
const {
  ensureRuntimeEnv,
  getDocument,
  setDocument,
  findUserByField
} = require('../_lib/firebaseAdmin');
const {
  SUBSCRIPTION_PRICE_ILS,
  getTranzilaConfig,
  findStandingOrder,
  createTaxInvoiceDocument
} = require('../_lib/tranzila');

function parseWebhookBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    const trimmed = req.body.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch (_) {}
    }
    return querystring.parse(trimmed);
  }
  return {};
}

function addOneMonthIso(fromDateIso) {
  const baseMs =
    fromDateIso && Date.parse(fromDateIso) > Date.now()
      ? Date.parse(fromDateIso)
      : Date.now();
  const d = new Date(baseMs);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function extractSessionIdFromRemarks(remarks) {
  const match = String(remarks || '').match(/STORYLINE[:_-](chk_[A-Za-z0-9_-]+)/i);
  return match ? match[1] : '';
}

function renderIframeCallbackHtml({ status, sessionId, message }) {
  const isSuccess = status === 'success';
  const title = isSuccess ? 'התשלום אושר בהצלחה!' : 'פעולת התשלום לא הושלמה';
  const subtitle =
    message ||
    (isSuccess
      ? 'המנוי החודשי הופעל וחשבונית מס/קבלה תישלח אליך בדוא"ל. החלון ייסגר כעת אוטומטית...'
      : 'העסקה נדחתה או בוטלה ולא בוצע חיוב בכרטיס. ניתן לנסות שוב.');
  const badgeBg = isSuccess ? '#dcfce7' : '#fee2e2';
  const badgeColor = isSuccess ? '#166534' : '#991b1b';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 32px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Rubik, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 85vh;
      text-align: center;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 28px 24px;
      max-width: 380px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: ${badgeBg};
      color: ${badgeColor};
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 14px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 20px;
    }
    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${isSuccess ? 'אושר • Tranzila' : 'לא הושלם'}</div>
    <h2>${title}</h2>
    <p>${subtitle}</p>
  </div>
  <script>
    (function () {
      var payload = {
        source: 'storyline-tranzila',
        status: ${JSON.stringify(status)},
        sessionId: ${JSON.stringify(sessionId || '')}
      };
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const payload = { ...query, ...parseWebhookBody(req) };
  const callbackMode = String(query.callback || '').trim(); // 'success' | 'failed' | ''

  if (req.method !== 'POST' && !callbackMode) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await ensureRuntimeEnv();
    const cfg = getTranzilaConfig();

    // 1. Verify webhook / callback authenticity:
    // Either wh_secret matches, or a valid checkout_session exists with matching session_id
    const whSecret =
      query.wh_secret || payload.wh_secret || req.headers['x-tranzila-webhook-secret'];
    const sessionId =
      query.session_id ||
      payload.session_id ||
      (payload.request_params && payload.request_params.session_id) ||
      extractSessionIdFromRemarks(payload.remarks) ||
      (String(payload.DCdisable || '').startsWith('chk_') ? String(payload.DCdisable) : '');

    let sessionDoc = null;
    if (sessionId) {
      sessionDoc = await getDocument('checkout_sessions', String(sessionId));
    }

    const secretMatches = Boolean(whSecret && whSecret === cfg.webhookSecret);
    if (!secretMatches && !sessionDoc) {
      if (callbackMode) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res
          .status(403)
          .send(renderIframeCallbackHtml({ status: 'failed', sessionId: '' }));
      }
      return res.status(403).json({ error: 'Untrusted webhook notification' });
    }

    // Check terminal supplier if provided (allow both shaharsol and shaharsoltok)
    const supplier = String(payload.supplier || payload.terminal_name || '').trim();
    if (
      supplier &&
      cfg.allowedTerminals.length > 0 &&
      !cfg.allowedTerminals.includes(supplier) &&
      cfg.mode !== 'mock'
    ) {
      return res.status(400).json({ error: `Unexpected Tranzila terminal: ${supplier}` });
    }

    // 2. Extract standard Tranzila DirectNG & My Billing STO fields
    const rawResponse = String(
      payload.Response ||
        payload.response ||
        payload.processor_response_code ||
        (callbackMode === 'success' ? '000' : callbackMode === 'failed' ? 'ERR' : '')
    ).trim();

    const txnIndex = String(
      payload.index ||
        payload.TranzilaIndex ||
        payload.transaction_id ||
        payload.ConfirmationCode ||
        (sessionId ? `sess_${sessionId}` : `evt_${Date.now()}`)
    ).trim();

    const expectedAmount =
      sessionDoc && Number(sessionDoc.amount) > 0
        ? Number(sessionDoc.amount)
        : SUBSCRIPTION_PRICE_ILS;
    const chargedSum = Number(payload.sum || payload.amount || expectedAmount);
    const stoExternalId = String(
      payload.sto_external_id || payload.sto_id || payload.stoId || ''
    ).trim();
    const tranzilaToken = String(payload.TranzilaTK || payload.token || '').trim();
    const rawCcNo = String(
      payload.card_last_4 || payload.last_4 || payload.ccno || ''
    ).replace(/\D/g, '');
    const cardLast4 = rawCcNo.length >= 4 ? rawCcNo.slice(-4) : '';

    const expDate = String(
      payload.expdate ||
        (payload.expmonth && payload.expyear
          ? `${String(payload.expmonth).padStart(2, '0')}${String(payload.expyear).slice(-2)}`
          : '')
    ).trim();
    const formattedExp =
      expDate.length === 4 ? `${expDate.slice(0, 2)}/${expDate.slice(2)}` : expDate;

    // 3. Idempotency check: prevent duplicate processing of the same Tranzila transaction index
    const existingEvent = await getDocument('payment_events', txnIndex);
    if (existingEvent) {
      if (callbackMode) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(
          renderIframeCallbackHtml({
            status: existingEvent.responseCode === '000' ? 'success' : 'failed',
            sessionId
          })
        );
      }
      return res.status(200).json({
        ok: true,
        idempotent: true,
        message: 'Transaction index already processed'
      });
    }

    // Also check if session was already completed by notify_url before callback_url arrived
    if (sessionDoc && sessionDoc.status === 'completed' && callbackMode === 'success') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(
        renderIframeCallbackHtml({
          status: 'success',
          sessionId
        })
      );
    }

    // 4. Validate charged amount matches checkout session amount (supports custom price & discount %)
    const amountMismatch =
      sessionDoc && Number(sessionDoc.amount) > 0
        ? Math.abs(chargedSum - Number(sessionDoc.amount)) > 0.05
        : !(chargedSum > 0);
    if (rawResponse === '000' && amountMismatch) {
      if (callbackMode) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(400).send(
          renderIframeCallbackHtml({
            status: 'failed',
            sessionId,
            message: 'סכום העסקה אינו תואם את מחיר המנוי.'
          })
        );
      }
      return res.status(400).json({
        error: `Amount mismatch: expected ${expectedAmount}, received ${chargedSum}`
      });
    }

    // 5. Resolve target user (by checkout_session, by sto_external_id, or by email)
    let userDoc = null;
    if (sessionDoc && sessionDoc.uid) {
      userDoc = await getDocument('users', sessionDoc.uid);
    }
    if (!userDoc && stoExternalId) {
      userDoc = await findUserByField('tranzilaStoId', stoExternalId);
    }
    if (!userDoc && payload.email) {
      userDoc = await findUserByField('email', String(payload.email).trim());
    }

    if (!userDoc) {
      if (callbackMode) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(
          renderIframeCallbackHtml({
            status: 'failed',
            sessionId
          })
        );
      }
      return res.status(404).json({ error: 'Target user not found for webhook notification' });
    }

    const nowIso = new Date().toISOString();
    const isSuccess = rawResponse === '000';
    const isRecurringRenewal = Boolean(stoExternalId && !sessionDoc);

    // Look up sto_id and card details from Tranzila API (`shaharsoltok`)
    let resolvedStoId = stoExternalId || '';
    let remoteCardLast4 = '';
    let remoteCardExp = '';

    if (isSuccess && (!resolvedStoId || !cardLast4 || !formattedExp || !secretMatches)) {
      const remoteSto = await findStandingOrder({
        stoId: resolvedStoId || undefined,
        token: tranzilaToken || undefined,
        clientEmail: userDoc.email
      });
      if (remoteSto && remoteSto.sto_id) {
        resolvedStoId = String(remoteSto.sto_id);
        if (remoteSto.card) {
          const tokenDigits = String(remoteSto.card.token || '').replace(/\D/g, '');
          if (tokenDigits.length >= 4) {
            remoteCardLast4 = tokenDigits.slice(-4);
          }
          if (remoteSto.card.expire_month && remoteSto.card.expire_year) {
            remoteCardExp = `${String(remoteSto.card.expire_month).padStart(2, '0')}/${String(
              remoteSto.card.expire_year
            ).slice(-2)}`;
          }
        }
      } else if (cfg.mode === 'mock') {
        resolvedStoId = resolvedStoId || userDoc.tranzilaStoId || `mock_sto_${Date.now().toString().slice(-6)}`;
      }
    }

    if (!resolvedStoId && userDoc.tranzilaStoId) {
      resolvedStoId = userDoc.tranzilaStoId;
    }

    // In live Tranzila mode, if the request came from a client callback without wh_secret,
    // require proof of an active Standing Order in Tranzila before activating subscription.
    if (isSuccess && !secretMatches && cfg.mode === 'tranzila' && !resolvedStoId) {
      return res.status(403).json({
        error: 'לא נמצאה הוראת קבע פעילה בטרנזילה לאימות העסקה'
      });
    }

    const finalCardLast4 = cardLast4 || remoteCardLast4 || userDoc.cardLast4 || '';
    const finalCardExp = formattedExp || remoteCardExp || userDoc.cardExp || '';

    let invoiceResult = null;
    if (isSuccess && cfg.invoicesEnabled) {
      invoiceResult = await createTaxInvoiceDocument({
        clientName: userDoc.displayName || userDoc.email,
        clientEmail: userDoc.email,
        amount: chargedSum,
        txnIndex,
        cardLast4: finalCardLast4,
        uid: userDoc.uid
      });
    }

    // 6. Update user subscription state in Firestore
    if (isSuccess) {
      const nextPeriodEnd = addOneMonthIso(userDoc.currentPeriodEnd);
      const updatedUser = {
        ...userDoc,
        subscriptionStatus: 'active',
        currentPeriodEnd: nextPeriodEnd,
        cancelAtPeriodEnd: false,
        tranzilaStoId: resolvedStoId || userDoc.tranzilaStoId,
        cardLast4: finalCardLast4,
        cardExp: finalCardExp,
        lastInvoiceUrl: (invoiceResult && invoiceResult.documentUrl) || userDoc.lastInvoiceUrl,
        updatedAt: nowIso
      };
      await setDocument('users', userDoc.uid, updatedUser);

      if (sessionDoc) {
        await setDocument('checkout_sessions', sessionDoc.sessionId, {
          ...sessionDoc,
          status: 'completed'
        });
      }
    } else {
      // Failed payment / failed recurring renewal
      const updatedUser = {
        ...userDoc,
        subscriptionStatus: isRecurringRenewal ? 'past_due' : userDoc.subscriptionStatus,
        updatedAt: nowIso
      };
      await setDocument('users', userDoc.uid, updatedUser);

      if (sessionDoc) {
        await setDocument('checkout_sessions', sessionDoc.sessionId, {
          ...sessionDoc,
          status: 'failed'
        });
      }
    }

    // 7. Record idempotent payment event
    const eventType = isSuccess
      ? isRecurringRenewal
        ? 'renewal_success'
        : 'initial_charge'
      : 'renewal_failed';

    await setDocument('payment_events', txnIndex, {
      eventId: txnIndex,
      uid: userDoc.uid,
      stoId: resolvedStoId || '',
      amount: chargedSum > 0 ? chargedSum : SUBSCRIPTION_PRICE_ILS,
      currency: 'ILS',
      responseCode: rawResponse || 'ERR',
      eventType,
      invoiceId: (invoiceResult && invoiceResult.documentId) || '',
      invoiceUrl: (invoiceResult && invoiceResult.documentUrl) || '',
      createdAt: nowIso
    });

    if (callbackMode) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(
        renderIframeCallbackHtml({
          status: isSuccess ? 'success' : 'failed',
          sessionId
        })
      );
    }

    return res.status(200).json({
      ok: true,
      status: isSuccess ? 'active' : 'failed',
      eventType,
      stoId: resolvedStoId,
      invoiceUrl: (invoiceResult && invoiceResult.documentUrl) || null
    });
  } catch (err) {
    console.error('Tranzila webhook error:', err);
    if (callbackMode) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        renderIframeCallbackHtml({
          status: 'failed',
          sessionId: query.session_id || ''
        })
      );
    }
    return res.status(500).json({
      error: err.message || 'Webhook processing error'
    });
  }
};
