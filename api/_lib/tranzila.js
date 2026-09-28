const crypto = require('crypto');

const SUBSCRIPTION_PRICE_ILS = 39;
const SUBSCRIPTION_PRODUCT_NAME = 'מנוי חודשי - מחולל סקריפטים Storyline ל-Google Sheets';

function getTranzilaConfig() {
  const checkoutTerminalName = (
    process.env.TRANZILA_CHECKOUT_TERMINAL_NAME ||
    process.env.TRANZILA_TERMINAL_NAME ||
    ''
  ).trim();
  const checkoutPassword = (process.env.TRANZILA_CHECKOUT_PASSWORD || '').trim();
  const checkoutCreditPassword = (process.env.TRANZILA_CHECKOUT_CREDIT_PASSWORD || '').trim();

  const terminalName = (
    process.env.TRANZILA_TERMINAL_NAME ||
    process.env.TRANZILA_CHECKOUT_TERMINAL_NAME ||
    ''
  ).trim();
  const tokenPassword = (process.env.TRANZILA_TOKEN_PASSWORD || '').trim();
  const tokenCreditPassword = (process.env.TRANZILA_TOKEN_CREDIT_PASSWORD || '').trim();

  const apiUsername = (
    process.env.TRANZILA_API_USERNAME ||
    checkoutTerminalName ||
    'shaher1'
  ).trim();
  const apiAppKey = (process.env.TRANZILA_API_APP_KEY || '').trim();
  const apiSecret = (process.env.TRANZILA_API_SECRET || '').trim();
  const webhookSecret = (process.env.TRANZILA_WEBHOOK_SECRET || 'dev-tranzila-webhook-secret').trim();

  // When using Tranzila with Ilang=HEB + json_purchase_data + pdesc, Tranzila's built-in Invoices module
  // automatically issues and emails the tax invoice/receipt. Keep manual API creation opt-in to avoid duplicates.
  const invoicesEnabled = process.env.TRANZILA_INVOICES_API_ENABLED === 'true';
  const sandboxControlsEnabled = process.env.TRANZILA_SANDBOX_CONTROLS === 'true';

  const hasLiveCredentials = Boolean(
    (checkoutTerminalName || terminalName) &&
    (checkoutPassword || tokenPassword || (apiAppKey && apiSecret))
  );
  const mode =
    process.env.TRANZILA_MODE === 'mock'
      ? 'mock'
      : hasLiveCredentials
      ? 'tranzila'
      : 'mock';

  const allowedTerminals = Array.from(
    new Set([checkoutTerminalName, terminalName].filter(Boolean))
  );

  return {
    mode,
    checkoutTerminalName: checkoutTerminalName || 'shaher1',
    checkoutPassword,
    checkoutCreditPassword,
    terminalName: terminalName || 'shaher1tok',
    tokenPassword,
    tokenCreditPassword,
    apiUsername,
    apiAppKey,
    apiSecret,
    webhookSecret,
    invoicesEnabled,
    sandboxControlsEnabled,
    allowedTerminals
  };
}

/**
 * Generates the 4 HMAC-SHA256 authentication headers required by Tranzila API v1/v2.
 * Official Reference: https://docs.tranzila.com/docs/payments-and-billing/authentication
 *
 * PHP Reference from Tranzila Docs:
 *   $time = time();
 *   $nonce = bin2hex(random_bytes(40)); // 80 hex chars
 *   $accessToken = hash_hmac('sha256', $appKey, $secret . $time . $nonce);
 */
function createTranzilaAuthHeaders(appKey, secret) {
  const requestTime = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(40).toString('hex');
  const hmacKey = `${secret}${requestTime}${nonce}`;
  const accessToken = crypto.createHmac('sha256', hmacKey).update(appKey).digest('hex');

  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-tranzila-api-app-key': appKey,
    'X-tranzila-api-request-time': requestTime,
    'X-tranzila-api-nonce': nonce,
    'X-tranzila-api-access-token': accessToken
  };
}

function addMonthsDateOnly(fromDate = new Date(), months = 1) {
  const d = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
  );
  const originalDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== originalDay) {
    d.setUTCDate(0);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Creates a server-side Handshake (thtk) with Tranzila on the checkout terminal (`shaher1`)
 * to lock the transaction amount (39 ILS).
 * Supports both Tranzila Handshake V2 (HMAC headers) and V1 (TranzilaPW query param),
 * plus a signed sandbox/mock fallback when credentials are not supplied.
 *
 * Official Reference: https://docs.tranzila.com/docs/payments-and-billing/handshake-v2
 */
async function createHandshake({ sum = SUBSCRIPTION_PRICE_ILS, sessionId, uid }) {
  const cfg = getTranzilaConfig();

  if (cfg.mode === 'mock') {
    const mockThtk =
      'mock_thtk_' +
      crypto
        .createHmac('sha256', cfg.webhookSecret)
        .update(`${sessionId}:${uid}:${sum}`)
        .digest('hex')
        .slice(0, 32);
    return {
      mode: 'mock',
      thtk: mockThtk,
      terminalName: cfg.checkoutTerminalName,
      sum
    };
  }

  const pw = cfg.checkoutPassword || cfg.tokenPassword;

  // Prefer Handshake V1 when terminal password (TranzilaPW) is configured, matching direct.tranzila.com + new_process=1
  if (pw) {
    const v1Url = `https://api.tranzila.com/v1/handshake/create?supplier=${encodeURIComponent(
      cfg.checkoutTerminalName
    )}&sum=${encodeURIComponent(sum)}&TranzilaPW=${encodeURIComponent(pw)}`;
    const v1Resp = await fetch(v1Url);
    const rawText = (await v1Resp.text()).trim();
    const thtk = rawText.startsWith('thtk=') ? rawText.slice(5).trim() : rawText;

    if (v1Resp.ok && thtk && !thtk.includes('error') && thtk.length >= 8) {
      return {
        mode: 'tranzila',
        thtk,
        terminalName: cfg.checkoutTerminalName,
        sum
      };
    }
  }

  // Fallback to Handshake V2 when API App Key + Secret are configured
  if (cfg.apiAppKey && cfg.apiSecret) {
    const headers = createTranzilaAuthHeaders(cfg.apiAppKey, cfg.apiSecret);
    const resp = await fetch('https://api.tranzila.com/v2/handshake/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        terminal_name: cfg.checkoutTerminalName,
        sum: Number(sum),
        request_params: sessionId ? { session_id: sessionId } : undefined
      })
    });

    const data = await resp.json().catch(() => null);
    if (resp.ok && data && Number(data.error_code) === 0 && data.thtk) {
      return {
        mode: 'tranzila',
        thtk: String(data.thtk).trim(),
        terminalName: cfg.checkoutTerminalName,
        sum
      };
    }

    throw new Error(
      (data && (data.message || data.error_msg)) || 'Failed to create Tranzila Handshake'
    );
  }

  throw new Error('Missing Tranzila credentials for Handshake');
}

function roundPrice(val) {
  return Math.round(Number(val) * 100) / 100;
}

/**
 * Resolves the effective monthly subscription price (in ILS) and discount percentage for a user,
 * combining global pricing settings and any per-user discountPercent / customPriceIls override.
 */
function resolveUserSubscriptionPrice(userDoc = {}, globalPricing = null) {
  const basePriceIls =
    globalPricing && Number(globalPricing.basePriceIls) > 0
      ? roundPrice(globalPricing.basePriceIls)
      : SUBSCRIPTION_PRICE_ILS;

  const globalDiscount =
    globalPricing && Number(globalPricing.globalDiscountPercent) > 0
      ? Math.min(99, Math.max(0, roundPrice(globalPricing.globalDiscountPercent)))
      : 0;

  const globalEffective =
    globalPricing && Number(globalPricing.effectivePriceIls) > 0
      ? roundPrice(globalPricing.effectivePriceIls)
      : roundPrice(basePriceIls * (1 - globalDiscount / 100));

  const hasUserCustomPrice =
    userDoc &&
    userDoc.customPriceIls !== undefined &&
    userDoc.customPriceIls !== null &&
    userDoc.customPriceIls !== '' &&
    Number(userDoc.customPriceIls) > 0;

  const hasUserDiscount =
    userDoc &&
    userDoc.discountPercent !== undefined &&
    userDoc.discountPercent !== null &&
    userDoc.discountPercent !== '' &&
    Number(userDoc.discountPercent) > 0;

  if (hasUserCustomPrice) {
    const effectivePriceIls = Math.max(1, roundPrice(userDoc.customPriceIls));
    const discountPercent = hasUserDiscount
      ? Math.min(99, Math.max(0, roundPrice(userDoc.discountPercent)))
      : basePriceIls > effectivePriceIls
      ? Math.max(0, Math.round(((basePriceIls - effectivePriceIls) / basePriceIls) * 100))
      : 0;
    return {
      basePriceIls,
      discountPercent,
      effectivePriceIls,
      hasCustomPricing: true
    };
  }

  if (hasUserDiscount) {
    const discountPercent = Math.min(99, Math.max(0, roundPrice(userDoc.discountPercent)));
    const effectivePriceIls = Math.max(1, roundPrice(basePriceIls * (1 - discountPercent / 100)));
    return {
      basePriceIls,
      discountPercent,
      effectivePriceIls,
      hasCustomPricing: true
    };
  }

  const finalGlobalPrice = Math.max(1, globalEffective);
  const effectiveGlobalDiscount =
    globalDiscount > 0
      ? globalDiscount
      : basePriceIls > finalGlobalPrice
      ? Math.max(0, Math.round(((basePriceIls - finalGlobalPrice) / basePriceIls) * 100))
      : 0;

  return {
    basePriceIls,
    discountPercent: effectiveGlobalDiscount,
    effectivePriceIls: finalGlobalPrice,
    hasCustomPricing: false
  };
}

/**
 * Builds itemized purchase JSON for Tranzila Invoices module inside the Tranzila iFrame.
 * Note: Because the frontend submits a hidden <input> via a standard HTML <form method="POST">,
 * the browser URL-encodes the JSON value once automatically.
 */
function buildInvoicePurchaseData(sum = SUBSCRIPTION_PRICE_ILS) {
  const items = [
    {
      product_name: SUBSCRIPTION_PRODUCT_NAME,
      product_quantity: 1,
      product_price: Number(Number(sum).toFixed(2))
    }
  ];
  return JSON.stringify(items);
}

/**
 * Builds the POST parameters for Tranzila Recurring iFrame (`iframenew.php`).
 * Configured for dual-terminal recurring billing (`shaher1` checkout + `shaher1tok` STO token terminal).
 */
function buildIframeCheckoutConfig({ thtk, dcDisable, sessionId, user, baseUrl, sum }) {
  const cfg = getTranzilaConfig();
  const resolvedSum =
    Number(sum) > 0 ? roundPrice(sum) : resolveUserSubscriptionPrice(user).effectivePriceIls;
  const nextBillingDate = addMonthsDateOnly(new Date(), 1);

  const isHttpsOrigin = String(baseUrl || '').startsWith('https://');
  const hasTerminalPw = Boolean(cfg.checkoutPassword || cfg.tokenPassword);
  const iframeHost = hasTerminalPw ? 'direct.tranzila.com' : 'directng.tranzila.com';

  const notifyUrl = isHttpsOrigin
    ? `${baseUrl}/api/webhooks/tranzila?wh_secret=${encodeURIComponent(
        cfg.webhookSecret
      )}&session_id=${encodeURIComponent(sessionId)}`
    : 'https://smzgfffeehrozxsqtgqa.supabase.co/functions/v1/tranzila-billing/notify';

  const successUrl = isHttpsOrigin
    ? `${baseUrl}/api/webhooks/tranzila?callback=success&wh_secret=${encodeURIComponent(
        cfg.webhookSecret
      )}&session_id=${encodeURIComponent(sessionId)}`
    : 'https://smzgfffeehrozxsqtgqa.supabase.co/functions/v1/tranzila-billing/success';

  const failUrl = isHttpsOrigin
    ? `${baseUrl}/api/webhooks/tranzila?callback=failed&wh_secret=${encodeURIComponent(
        cfg.webhookSecret
      )}&session_id=${encodeURIComponent(sessionId)}`
    : 'https://smzgfffeehrozxsqtgqa.supabase.co/functions/v1/tranzila-billing/failed';

  const rawContact = user.displayName || (user.email ? user.email.split('@')[0] : '') || 'לקוח';
  const cleanContact =
    rawContact
      .replace(/[^\p{L}\p{N}\s.'"-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50) || 'Customer';

  const fields = {
    supplier: cfg.checkoutTerminalName,
    sum: String(resolvedSum),
    currency: '1', // 1 = ILS (NIS)
    cred_type: '1', // Regular credit transaction
    tranmode: 'A', // Standard charge with My Billing standing order creation
    thtk,
    recur_sum: String(resolvedSum),
    recur_start_date: nextBillingDate,
    recur_transaction: '4_approved', // Monthly standing order locked by merchant
    lang: 'il',
    Ilang: 'HEB',
    contact: cleanContact,
    email: user.email || '',
    pdesc: SUBSCRIPTION_PRODUCT_NAME,
    json_purchase_data: buildInvoicePurchaseData(resolvedSum),
    remarks: `STORYLINE-${sessionId}`,
    DCdisable: dcDisable || sessionId,
    requested_by_user: cfg.apiUsername,
    buttonLabel: `רכישת מנוי חודשי - ${resolvedSum} שח`,
    trButtonColor: '2563eb',
    trBgColor: 'ffffff',
    trTextColor: '0f172a',
    nologo: '1',
    notify_url_address: notifyUrl,
    success_url_address: successUrl,
    fail_url_address: failUrl
  };

  if (iframeHost === 'direct.tranzila.com') {
    fields.new_process = '1';
  }

  return {
    mode: cfg.mode,
    terminalName: cfg.checkoutTerminalName,
    stoTerminalName: cfg.terminalName,
    actionUrl: `https://${iframeHost}/${encodeURIComponent(
      cfg.checkoutTerminalName
    )}/iframenew.php`,
    method: 'POST',
    fields
  };
}

/**
 * Cancels an active Standing Order (STO) in Tranzila My Billing via STO API V2 on `shaher1tok`.
 * Official Reference: https://docs.tranzila.com/docs/payments-and-billing/sto-api-v2/updatestov2
 */
async function cancelStandingOrder({ stoId, updatedByUser }) {
  const cfg = getTranzilaConfig();

  if (cfg.mode === 'mock' || String(stoId).startsWith('mock_sto_')) {
    return {
      ok: true,
      mode: 'mock',
      error_code: 0,
      message: 'Success (Mock STO inactivated)'
    };
  }

  if (!cfg.apiAppKey || !cfg.apiSecret) {
    throw new Error('Missing TRANZILA_API_APP_KEY or TRANZILA_API_SECRET for STO cancellation');
  }

  const parsedStoId = Number(String(stoId).trim());
  const endpoints = [
    'https://api.tranzila.com/v2/sto/update',
    'https://api.tranzila.com/v2/v2/sto/update'
  ];
  const terminalsToTry = Array.from(
    new Set([cfg.terminalName, cfg.checkoutTerminalName].filter(Boolean))
  );

  let lastError = null;
  for (const terminal of terminalsToTry) {
    for (const url of endpoints) {
      const headers = createTranzilaAuthHeaders(cfg.apiAppKey, cfg.apiSecret);
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          terminal_name: terminal,
          sto_id: parsedStoId,
          sto_status: 'inactive',
          response_language: 'hebrew',
          updated_by_user: String(cfg.apiUsername || updatedByUser || 'shaher1').slice(0, 40)
        })
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data && Number(data.error_code) === 0) {
        return {
          ok: true,
          mode: 'tranzila',
          error_code: data.error_code,
          message: data.message || 'Success'
        };
      }
      lastError = (data && (data.message || data.error_msg)) || `HTTP ${resp.status}`;
    }
  }

  throw new Error(lastError || 'Tranzila STO cancel failed');
}

/**
 * Retrieves Standing Orders (STOs) from Tranzila (`shaher1tok` / `shaher1`) to cross-verify webhook authenticity or lookup sto_id.
 * Official Reference: https://docs.tranzila.com/docs/payments-and-billing/tranzila-api/getstos
 * Endpoint: POST https://api.tranzila.com/v1/stos/get
 */
async function findStandingOrder({ stoId, token, clientEmail }) {
  const cfg = getTranzilaConfig();
  if (cfg.mode === 'mock' || !cfg.apiAppKey || !cfg.apiSecret) {
    return null;
  }

  const terminalsToTry = Array.from(
    new Set([cfg.terminalName, cfg.checkoutTerminalName].filter(Boolean))
  );

  for (const terminal of terminalsToTry) {
    const payload = {
      terminal_name: terminal,
      sto_status: 'active'
    };
    if (stoId) payload.sto_id = Number(stoId);
    if (token) payload.token = String(token);
    if (clientEmail) payload.client_email = String(clientEmail);

    const headers = createTranzilaAuthHeaders(cfg.apiAppKey, cfg.apiSecret);
    const resp = await fetch('https://api.tranzila.com/v1/stos/get', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!resp.ok) continue;
    const data = await resp.json().catch(() => null);
    if (data && Number(data.error_code) === 0 && Array.isArray(data.stos) && data.stos.length > 0) {
      const sorted = [...data.stos].sort(
        (a, b) => Number(b.sto_id || 0) - Number(a.sto_id || 0)
      );
      return sorted[0];
    }
  }

  return null;
}

/**
 * Creates a compliant Israeli Tax Invoice / Receipt (חשבונית מס/קבלה - IR) via Tranzila Invoices API
 * when explicitly enabled via TRANZILA_INVOICES_API_ENABLED=true.
 * Note: By default, DirectNG iFrame automatically generates the invoice via Ilang=HEB & json_purchase_data.
 */
async function createTaxInvoiceDocument({
  clientName,
  clientEmail,
  amount = SUBSCRIPTION_PRICE_ILS,
  txnIndex,
  cardLast4,
  uid
}) {
  const cfg = getTranzilaConfig();
  const todayIso = new Date().toISOString().slice(0, 10);

  if (cfg.mode === 'mock' || !cfg.apiAppKey || !cfg.apiSecret) {
    const mockDocId = `INV-MOCK-${Date.now().toString().slice(-6)}`;
    return {
      ok: true,
      mode: 'mock',
      documentId: mockDocId,
      documentUrl: `https://my.tranzila.com/mock-invoice/${mockDocId}`
    };
  }

  const headers = createTranzilaAuthHeaders(cfg.apiAppKey, cfg.apiSecret);
  const payload = {
    terminal_name: cfg.checkoutTerminalName,
    document_date: todayIso,
    document_type: 'IR', // חשבונית מס / קבלה
    action: 1,
    document_language: 'heb',
    response_language: 'heb',
    document_currency_code: 'ILS',
    client_name: clientName || clientEmail || 'לקוח',
    client_email: clientEmail || '',
    created_by_user: String(uid || '').slice(0, 40),
    created_by_system: 'storyline-script-saas',
    items: [
      {
        type: 'I',
        code: 'STORYLINE-SUB-MONTHLY',
        name: SUBSCRIPTION_PRODUCT_NAME,
        price_type: 'G', // Gross (includes VAT)
        unit_price: Number(amount),
        units_number: 1,
        unit_type: 1,
        currency_code: 'ILS',
        to_doc_currency_exchange_rate: 1
      }
    ],
    payments: [
      {
        payment_method: 1, // Credit Card
        payment_date: todayIso,
        cc_last_4_digits: cardLast4 ? String(cardLast4) : undefined,
        cc_credit_term: 1,
        amount: Number(amount),
        currency_code: 'ILS',
        to_doc_currency_exchange_rate: 1,
        txnindex: txnIndex ? Number(txnIndex) : undefined
      }
    ]
  };

  const resp = await fetch('https://billing5.tranzila.com/api/documents_db/create_document', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data || Number(data.status_code) !== 0) {
    console.warn('Tranzila Invoices API response warning:', data);
    return { ok: false, mode: 'tranzila', raw: data };
  }

  const docObj = data.document || {};
  return {
    ok: true,
    mode: 'tranzila',
    documentId: String(docObj.id || docObj.number || ''),
    documentUrl: docObj.retrieval_key
      ? `https://my.tranzila.com/api/get_financial_document/${docObj.retrieval_key}`
      : ''
  };
}

module.exports = {
  SUBSCRIPTION_PRICE_ILS,
  SUBSCRIPTION_PRODUCT_NAME,
  getTranzilaConfig,
  resolveUserSubscriptionPrice,
  createTranzilaAuthHeaders,
  addMonthsDateOnly,
  createHandshake,
  buildIframeCheckoutConfig,
  cancelStandingOrder,
  findStandingOrder,
  createTaxInvoiceDocument
};
