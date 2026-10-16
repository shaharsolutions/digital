import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

const firebaseConfig = {
  projectId: 'shahar-storyline-saas',
  appId: '1:87620536673:web:7e12f7a3baff171dd25d20',
  storageBucket: 'shahar-storyline-saas.firebasestorage.app',
  apiKey: 'AIzaSyAtt8KrtnXH1S7tglh739Y2-YGO2xtvbpU',
  authDomain: 'shahar-storyline-saas.firebaseapp.com',
  messagingSenderId: '87620536673'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// DOM Elements - Layout & Auth
const authLoading = document.getElementById('auth-loading');
const authSection = document.getElementById('auth-section');
const userBar = document.getElementById('user-bar');
const sandboxBar = document.getElementById('sandbox-bar');
const paywallSection = document.getElementById('paywall-section');
const generatorWorkspace = document.getElementById('generator-workspace');
const globalBanner = document.getElementById('global-banner');

// DOM Elements - User Bar
const userAvatar = document.getElementById('user-avatar');
const userEmailDisplay = document.getElementById('user-email-display');
const subscriptionBadge = document.getElementById('subscription-badge');
const subscriptionSubtext = document.getElementById('subscription-subtext');
const adminPanelBtn = document.getElementById('admin-panel-btn');
const upgradeTopBtn = document.getElementById('upgrade-top-btn');
const manageSubBtn = document.getElementById('manage-sub-btn');
const logoutBtn = document.getElementById('logout-btn');
const simExpireBtn = document.getElementById('sim-expire-btn');
const simResetBtn = document.getElementById('sim-reset-btn');
const sandboxModeText = document.getElementById('sandbox-mode-text');

// DOM Elements - Auth Form
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authTitle = document.getElementById('auth-title');
const googleLoginBtn = document.getElementById('google-login-btn');
const emailAuthForm = document.getElementById('email-auth-form');
const registerNameGroup = document.getElementById('register-name-group');
const registerConfirmPasswordGroup = document.getElementById('register-confirm-password-group');
const authNameInput = document.getElementById('auth-name');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authConfirmPasswordInput = document.getElementById('auth-confirm-password');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const authErrorBox = document.getElementById('auth-error');
const authSubmitBtn = document.getElementById('auth-submit-btn');

// DOM Elements - Generator
const variableCountInput = document.getElementById('variable-count');
const variableNamesContainer = document.getElementById('variable-names');
const webAppUrlInput = document.getElementById('web-app-url');
const appScriptCodeTextarea = document.getElementById('app-script-code');
const storylineCodeTextarea = document.getElementById('storyline-code');
const copyAppScriptButton = document.getElementById('copy-app-script');
const copyStorylineCodeButton = document.getElementById('copy-storyline-code');
const appScriptNotification = document.getElementById('app-script-notification');
const storylineNotification = document.getElementById('storyline-notification');

// DOM Elements - Modals
const paywallSubscribeBtn = document.getElementById('paywall-subscribe-btn');
const paywallPriceAmount = document.getElementById('paywall-price-amount');
const paywallBasePrice = document.getElementById('paywall-base-price');
const paywallDiscountBadge = document.getElementById('paywall-discount-badge');
const checkoutModal = document.getElementById('checkout-modal');
const checkoutModalTitle = document.getElementById('checkout-modal-title');
const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
const checkoutLoading = document.getElementById('checkout-loading');
const checkoutLoadingText = document.getElementById('checkout-loading-text');
const tranzilaIframeWrapper = document.getElementById('tranzila-iframe-wrapper');
const tranzilaPostForm = document.getElementById('tranzila-post-form');
const mockCheckoutSimulator = document.getElementById('mock-checkout-simulator');
const mockThtkDisplay = document.getElementById('mock-thtk-display');
const mockApprovePaymentBtn = document.getElementById('mock-approve-payment-btn');
const mockFailPaymentBtn = document.getElementById('mock-fail-payment-btn');

const manageModal = document.getElementById('manage-modal');
const closeManageModalBtn = document.getElementById('close-manage-modal');
const manageEmail = document.getElementById('manage-email');
const manageStatus = document.getElementById('manage-status');
const manageDate = document.getElementById('manage-date');
const manageCard = document.getElementById('manage-card');
const manageInvoiceRow = document.getElementById('manage-invoice-row');
const manageInvoiceLink = document.getElementById('manage-invoice-link');
const manageFeedback = document.getElementById('manage-feedback');
const manageUpgradeBtn = document.getElementById('manage-upgrade-btn');
const openCancelConfirmBtn = document.getElementById('open-cancel-confirm-btn');
const cancelConfirmBox = document.getElementById('cancel-confirm-box');
const confirmCancelSubBtn = document.getElementById('confirm-cancel-sub-btn');
const abortCancelSubBtn = document.getElementById('abort-cancel-sub-btn');

// DOM Elements - Admin Panel Modal
const adminModal = document.getElementById('admin-modal');
const closeAdminModalBtn = document.getElementById('close-admin-modal');
const adminStatTotal = document.getElementById('admin-stat-total');
const adminStatActive = document.getElementById('admin-stat-active');
const adminStatMrr = document.getElementById('admin-stat-mrr');
const adminStatTrialing = document.getElementById('admin-stat-trialing');
const adminStatExpired = document.getElementById('admin-stat-expired');
const adminGlobalBasePrice = document.getElementById('admin-global-base-price');
const adminGlobalDiscount = document.getElementById('admin-global-discount');
const adminGlobalFinalPrice = document.getElementById('admin-global-final-price');
const adminSaveGlobalPricingBtn = document.getElementById('admin-save-global-pricing-btn');
const adminSearchInput = document.getElementById('admin-search-input');
const adminStatusFilter = document.getElementById('admin-status-filter');
const adminRefreshBtn = document.getElementById('admin-refresh-btn');
const adminFeedback = document.getElementById('admin-feedback');
const adminLoading = document.getElementById('admin-loading');
const adminUsersTbody = document.getElementById('admin-users-tbody');

// Application State
let authMode = 'login'; // 'login' | 'register'
let currentUser = null;
let currentSubState = null;
let activeCheckoutSession = null;
let adminUsersCache = [];
let adminGlobalPricingCache = { basePriceIls: 39, globalDiscountPercent: 0, effectivePriceIls: 39 };
let variableCount = 0;
let variableNames = [];
let generateDebounceTimer = null;

function formatDateHe(isoString) {
  if (!isoString) return '-';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(isoString));
  } catch (_) {
    return isoString;
  }
}

function showGlobalBanner(message, type = 'success') {
  if (!message) {
    globalBanner.hidden = true;
    return;
  }
  globalBanner.textContent = message;
  globalBanner.className = `global-banner ${type === 'error' ? 'banner-error' : 'banner-success'}`;
  globalBanner.hidden = false;
}

function translateFirebaseError(error) {
  const code = (error && error.code) || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'כתובת האימייל שהוזנה אינה תקינה.';
    case 'auth/user-disabled':
      return 'חשבון משתמש זה נחסם.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'אימייל או סיסמה שגויים. אנא בדוק את הפרטים ונסה שוב.';
    case 'auth/email-already-in-use':
      return 'כתובת האימייל הזו כבר רשומה במערכת. עבור ללשונית "התחברות".';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי – יש לבחור סיסמה באורך 6 תווים לפחות.';
    case 'auth/popup-closed-by-user':
      return 'חלון ההתחברות של Google נסגר לפני השלמת הפעולה.';
    case 'auth/too-many-requests':
      return 'בוצעו יותר מדי ניסיונות כושלים. אנא המתן מספר דקות ונסה שוב.';
    default:
      return (error && error.message) || 'אירעה שגיאה בתהליך ההתחברות. אנא נסה שוב.';
  }
}

async function authorizedFetch(url, options = {}) {
  if (!currentUser) {
    throw new Error('משתמש לא מחובר');
  }
  const idToken = await currentUser.getIdToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${idToken}`
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, {
    ...options,
    headers
  });
}

// ===============================================================
// Subscription State & UI Rendering
// ===============================================================

function renderSubscriptionState(sub) {
  currentSubState = sub;
  authLoading.hidden = true;
  authSection.hidden = true;
  userBar.hidden = false;

  const priceIls = Number(sub.priceIls) || 39;
  const basePriceIls = Number(sub.basePriceIls) || priceIls;
  const discountPercent = Number(sub.discountPercent) || 0;
  const discountSuffix = discountPercent > 0 ? ` (${discountPercent}% הנחה)` : '';

  const initial = (sub.displayName || sub.email || 'S').trim().charAt(0).toUpperCase();
  userAvatar.textContent = initial;
  userEmailDisplay.textContent = sub.email || '';

  if (adminPanelBtn) {
    adminPanelBtn.hidden = !sub.isAdmin;
  }

  // Update dynamic price labels across buttons & paywall
  const upgradeTopSpan = upgradeTopBtn ? upgradeTopBtn.querySelector('span') : null;
  if (upgradeTopSpan) {
    upgradeTopSpan.textContent = `רכישת מנוי • ${priceIls} ₪/חודש${discountSuffix}`;
  }
  if (paywallPriceAmount) {
    paywallPriceAmount.textContent = `${priceIls} ₪`;
  }
  if (paywallBasePrice) {
    if (discountPercent > 0 && basePriceIls > priceIls) {
      paywallBasePrice.textContent = `${basePriceIls} ₪`;
      paywallBasePrice.hidden = false;
    } else {
      paywallBasePrice.hidden = true;
    }
  }
  if (paywallDiscountBadge) {
    if (discountPercent > 0) {
      paywallDiscountBadge.textContent = `${discountPercent}% הנחה`;
      paywallDiscountBadge.hidden = false;
    } else {
      paywallDiscountBadge.hidden = true;
    }
  }
  if (paywallSubscribeBtn) {
    paywallSubscribeBtn.textContent = `מעבר לתשלום מאובטח בטרנזילה • ${priceIls} ₪ לחודש${discountSuffix}`;
  }
  if (checkoutModalTitle) {
    checkoutModalTitle.textContent = `רכישת מנוי חודשי • ${priceIls} ₪ לחודש${discountSuffix}`;
  }
  if (manageUpgradeBtn) {
    manageUpgradeBtn.textContent = `שדרוג למנוי חודשי • ${priceIls} ₪ לחודש${discountSuffix}`;
  }

  sandboxBar.hidden = !(sub.sandboxControlsEnabled || sub.billingMode === 'mock');
  if (sandboxModeText) {
    if (sub.billingMode === 'tranzila') {
      sandboxModeText.textContent = `מחובר למסופי טרנזילה (${sub.checkoutTerminalName || 'shaher1'} / ${sub.stoTerminalName || 'shaher1tok'}). ניתן לדמות סיום 3 ימי ניסיון כדי לבדוק את מסך הסליקה.`;
    } else {
      sandboxModeText.textContent = 'ניתן לדמות סיום תקופת ניסיון ורכישת מנוי ללא חיוב אמיתי.';
    }
  }

  subscriptionBadge.className = 'subscription-badge';
  if (sub.subscriptionStatus === 'active') {
    subscriptionBadge.classList.add('badge-active');
    subscriptionBadge.textContent = 'מנוי חודשי פעיל';
    subscriptionSubtext.textContent = sub.currentPeriodEnd
      ? `חידוש אוטומטי ב-${formatDateHe(sub.currentPeriodEnd)} (${priceIls} ₪/חודש)`
      : `${priceIls} ₪ לחודש`;
    upgradeTopBtn.hidden = true;
  } else if (sub.subscriptionStatus === 'canceled' && sub.hasAccess) {
    subscriptionBadge.classList.add('badge-canceled');
    subscriptionBadge.textContent = 'מנוי בוטל • פעיל עד תום התקופה';
    subscriptionSubtext.textContent = `גישה פתוחה עד ${formatDateHe(sub.currentPeriodEnd)}`;
    upgradeTopBtn.hidden = false;
  } else if (sub.subscriptionStatus === 'trialing' && sub.hasAccess) {
    subscriptionBadge.classList.add('badge-trialing');
    subscriptionBadge.textContent = `תקופת ניסיון חינמית • נותרו ${sub.trialRemainingDays} ימים`;
    subscriptionSubtext.textContent = `מסתיים ב-${formatDateHe(sub.trialEndsAt)} (${sub.trialRemainingHours} שעות)${discountPercent > 0 ? ` • מחיר מיוחד: ${priceIls} ₪/חודש (${discountPercent}% הנחה)` : ''}`;
    upgradeTopBtn.hidden = false;
  } else {
    subscriptionBadge.classList.add('badge-expired');
    subscriptionBadge.textContent =
      sub.subscriptionStatus === 'past_due' ? 'נדרש עדכון אמצעי תשלום' : 'תקופת הניסיון הסתיימה';
    subscriptionSubtext.textContent = `נדרש מנוי חודשי (${priceIls} ₪${discountSuffix}) להמשך שימוש`;
    upgradeTopBtn.hidden = false;
  }

  if (sub.hasAccess) {
    paywallSection.hidden = true;
    generatorWorkspace.hidden = false;
    requestServerScriptGeneration();
  } else {
    generatorWorkspace.hidden = true;
    paywallSection.hidden = false;
    appScriptCodeTextarea.value = '';
    storylineCodeTextarea.value = '';
  }

  populateManageModal(sub);
}

function populateManageModal(sub) {
  if (!sub) return;
  const priceIls = Number(sub.priceIls) || 39;
  const discountPercent = Number(sub.discountPercent) || 0;
  const discountSuffix = discountPercent > 0 ? ` (${discountPercent}% הנחה)` : '';

  manageEmail.textContent = sub.email || '-';

  const statusLabels = {
    trialing: `תקופת ניסיון חינמית (נותרו ${sub.trialRemainingDays} ימים) • מחיר מנוי: ${priceIls} ₪/חודש${discountSuffix}`,
    active: `מנוי חודשי פעיל\n(${priceIls} ₪ לחודש${discountSuffix})`,
    canceled: 'בוטל (גישה פעילה עד סוף התקופה ששולמה)',
    past_due: 'חיוב חודשי נכשל – ממתין לעדכון אשראי',
    expired: `לא פעיל (תקופת הניסיון הסתיימה) • מחיר מנוי: ${priceIls} ₪/חודש${discountSuffix}`
  };
  manageStatus.textContent = statusLabels[sub.subscriptionStatus] || sub.subscriptionStatus;

  if (sub.subscriptionStatus === 'active' || sub.subscriptionStatus === 'canceled') {
    manageDate.textContent = formatDateHe(sub.currentPeriodEnd);
  } else {
    manageDate.textContent = formatDateHe(sub.trialEndsAt);
  }

  manageCard.textContent = sub.cardLast4
    ? `•••• ${sub.cardLast4} (${sub.cardExp || ''})`
    : 'טרם הוגדר כרטיס';

  if (sub.lastInvoiceUrl) {
    manageInvoiceRow.hidden = false;
    manageInvoiceLink.href = sub.lastInvoiceUrl;
  } else {
    manageInvoiceRow.hidden = true;
  }

  cancelConfirmBox.hidden = true;
  manageFeedback.hidden = true;

  if (sub.subscriptionStatus === 'active') {
    openCancelConfirmBtn.hidden = false;
    manageUpgradeBtn.hidden = true;
  } else {
    openCancelConfirmBtn.hidden = true;
    manageUpgradeBtn.hidden = false;
  }
}

async function fetchSubscriptionStatus() {
  if (!currentUser) return;
  try {
    const resp = await authorizedFetch('/api/subscription');
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'שגיאה בטעינת נתוני המנוי מהשרת');
    }
    renderSubscriptionState(data);
  } catch (err) {
    authLoading.hidden = true;
    showGlobalBanner(err.message, 'error');
  }
}

// ===============================================================
// Server-Side Protected Script Generation
// ===============================================================

function updateVariableNames() {
  variableNamesContainer.innerHTML = '';
  for (let i = 0; i < variableCount; i++) {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';

    const label = document.createElement('label');
    label.textContent = `שם משתנה ${i + 1}:`;

    const input = document.createElement('input');
    input.type = 'text';
    input.dir = 'ltr';
    input.placeholder = `Variable${i + 1}`;
    input.value = variableNames[i] || '';
    input.addEventListener('input', function (e) {
      variableNames[i] = e.target.value;
      scheduleServerScriptGeneration();
    });

    inputGroup.appendChild(label);
    inputGroup.appendChild(input);
    variableNamesContainer.appendChild(inputGroup);
  }
}

function scheduleServerScriptGeneration() {
  if (generateDebounceTimer) {
    clearTimeout(generateDebounceTimer);
  }
  generateDebounceTimer = setTimeout(() => {
    requestServerScriptGeneration();
  }, 180);
}

async function requestServerScriptGeneration() {
  if (!currentUser || !currentSubState || !currentSubState.hasAccess) {
    appScriptCodeTextarea.value = '';
    storylineCodeTextarea.value = '';
    return;
  }

  const activeNames = variableNames.map((n) => (n || '').trim()).filter(Boolean);
  if (variableCount <= 0 || activeNames.length === 0) {
    appScriptCodeTextarea.value = '';
    storylineCodeTextarea.value = '';
    return;
  }

  try {
    const resp = await authorizedFetch('/api/generate-scripts', {
      method: 'POST',
      body: JSON.stringify({
        variableNames: activeNames,
        webAppUrl: webAppUrlInput.value.trim()
      })
    });

    if (resp.status === 402) {
      // Trial or subscription expired on the server
      await fetchSubscriptionStatus();
      return;
    }

    const data = await resp.json();
    if (resp.ok) {
      appScriptCodeTextarea.value = data.appScriptCode || '';
      storylineCodeTextarea.value = data.storylineCode || '';
    }
  } catch (err) {
    console.error('Failed to generate scripts from server:', err);
  }
}

function copyToClipboard(textarea, notificationElement) {
  if (!textarea.value) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textarea.value);
  } else {
    textarea.select();
    document.execCommand('copy');
  }
  notificationElement.innerHTML = 'הטקסט הועתק ללוח!';
  notificationElement.style.display = 'block';

  setTimeout(function () {
    notificationElement.style.display = 'none';
  }, 2500);
}

// ===============================================================
// Tranzila Checkout & Subscription Cancellation Handlers
// ===============================================================

function recreateCleanTranzilaIframe() {
  const existing = document.getElementById('tranzila-payment-iframe');
  if (existing && existing.parentNode) {
    const freshIframe = document.createElement('iframe');
    freshIframe.id = 'tranzila-payment-iframe';
    freshIframe.name = 'tranzila-payment-iframe';
    freshIframe.title = 'טופס תשלום מאובטח טרנזילה';
    freshIframe.className = 'tranzila-iframe';
    freshIframe.src = 'about:blank';
    existing.parentNode.replaceChild(freshIframe, existing);
  }
}

async function openCheckoutModal() {
  manageModal.hidden = true;
  checkoutModal.hidden = false;
  checkoutLoading.hidden = false;
  tranzilaIframeWrapper.hidden = true;
  mockCheckoutSimulator.hidden = true;
  recreateCleanTranzilaIframe();

  const expectedPrice = (currentSubState && Number(currentSubState.priceIls)) || 39;
  if (checkoutLoadingText) {
    checkoutLoadingText.textContent = `מבצע אימות Handshake מול שרתי טרנזילה ונועל סכום עסקה (${expectedPrice} ₪)...`;
  }

  try {
    const resp = await authorizedFetch('/api/billing/create-checkout', {
      method: 'POST'
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'לא ניתן לאתחל עסקה מול טרנזילה');
    }

    activeCheckoutSession = data;
    checkoutLoading.hidden = true;

    const lockedAmount = Number(data.amount) || expectedPrice;
    const discountPct = Number(data.discountPercent) || 0;
    if (checkoutModalTitle) {
      checkoutModalTitle.textContent =
        discountPct > 0
          ? `רכישת מנוי חודשי • ${lockedAmount} ₪ לחודש (${discountPct}% הנחה)`
          : `רכישת מנוי חודשי • ${lockedAmount} ₪ לחודש`;
    }

    if (data.mode === 'tranzila' && data.iframe) {
      // Populate and submit POST form into a fresh Tranzila iFrame
      tranzilaIframeWrapper.hidden = false;
      tranzilaPostForm.action = data.iframe.actionUrl;
      tranzilaPostForm.innerHTML = '';

      for (const [key, val] of Object.entries(data.iframe.fields || {})) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(val);
        tranzilaPostForm.appendChild(input);
      }

      tranzilaPostForm.submit();
    } else {
      // Sandbox / Mock Simulator
      mockCheckoutSimulator.hidden = false;
      mockThtkDisplay.textContent = `thtk=${data.iframe?.fields?.thtk || ''}`;
    }
  } catch (err) {
    checkoutModal.hidden = true;
    showGlobalBanner(err.message, 'error');
  }
}

async function triggerMockWebhook(responseCode) {
  if (!activeCheckoutSession) return;
  mockApprovePaymentBtn.disabled = true;
  mockFailPaymentBtn.disabled = true;

  const sessionSum = Number(activeCheckoutSession.amount || 39).toFixed(2);

  try {
    const resp = await fetch(
      `/api/webhooks/tranzila?session_id=${encodeURIComponent(activeCheckoutSession.sessionId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeCheckoutSession.sessionId,
          Response: responseCode,
          sum: sessionSum,
          currency: 'ILS',
          index: `${Date.now()}`,
          ConfirmationCode: responseCode === '000' ? '0849201' : '0000000',
          TranzilaTK: 'TzkMockToken982341823',
          card_last_4: '4580',
          expdate: '0829',
          sto_external_id: `sto_${Date.now().toString().slice(-6)}`
        })
      }
    );

    const data = await resp.json();
    checkoutModal.hidden = true;

    if (resp.ok && data.status === 'active') {
      showGlobalBanner(
        'התשלום אושר בהצלחה! המנוי החודשי הופעל וחשבונית מס/קבלה הופקה דרך טרנזילה.',
        'success'
      );
      await fetchSubscriptionStatus();
    } else {
      showGlobalBanner(
        'העסקה נדחתה על-ידי חברת האשראי (Response=' + responseCode + '). לא בוצע חיוב.',
        'error'
      );
      await fetchSubscriptionStatus();
    }
  } catch (err) {
    showGlobalBanner('שגיאה בסימולציית Webhook: ' + err.message, 'error');
  } finally {
    mockApprovePaymentBtn.disabled = false;
    mockFailPaymentBtn.disabled = false;
  }
}

async function handleCancelSubscription() {
  const confirmBtn = cancelConfirmBox ? cancelConfirmBox.querySelector('#confirm-cancel-sub-btn') : confirmCancelSubBtn;
  if (confirmBtn) confirmBtn.disabled = true;
  manageFeedback.hidden = true;

  try {
    const resp = await authorizedFetch('/api/billing/cancel', {
      method: 'POST'
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'שגיאה בביטול המנוי');
    }

    manageModal.hidden = true;
    showGlobalBanner(data.message, 'success');
    await fetchSubscriptionStatus();
  } catch (err) {
    manageFeedback.textContent = err.message;
    manageFeedback.hidden = false;
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function renderManageCancelConfirmBox() {
  if (!cancelConfirmBox) return;
  cancelConfirmBox.innerHTML = `
    <p>
      <strong>האם לבטל את החידוש האוטומטי של המנוי?</strong><br>
      הוראת הקבע בטרנזילה תופסק מיד ולא תחויב בחודשים הבאים. הגישה שלך למחולל תישאר פתוחה במלואה עד לתום תקופת החיוב הנוכחית ששולמה.
    </p>
    <div class="cancel-confirm-buttons">
      <button id="confirm-cancel-sub-btn" class="btn-danger" type="button">כן, בטל מנוי</button>
      <button id="abort-cancel-sub-btn" class="btn-secondary" type="button">השאר מנוי פעיל</button>
    </div>
  `;
}

// ===============================================================
// System Administrator Panel Functions
// ===============================================================

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showAdminFeedback(message, type = 'success') {
  if (!adminFeedback) return;
  if (!message) {
    adminFeedback.hidden = true;
    return;
  }
  adminFeedback.textContent = message;
  adminFeedback.className = `global-banner ${type === 'error' ? 'banner-error' : 'banner-success'}`;
  adminFeedback.hidden = false;
}

async function openAdminModal() {
  if (!adminModal) return;
  adminModal.hidden = false;
  showAdminFeedback('');
  await loadAdminUsers();
}

async function loadAdminUsers() {
  if (!adminUsersTbody) return;
  adminLoading.hidden = false;
  adminRefreshBtn.disabled = true;

  try {
    const resp = await authorizedFetch('/api/admin/users', { method: 'GET' });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'שגיאה בטעינת רשימת המשתמשים');
    }

    adminUsersCache = Array.isArray(data.users) ? data.users : [];
    if (data.globalPricing) {
      adminGlobalPricingCache = data.globalPricing;
      if (adminGlobalBasePrice) {
        adminGlobalBasePrice.value = String(data.globalPricing.basePriceIls ?? 39);
      }
      if (adminGlobalDiscount) {
        adminGlobalDiscount.value = String(data.globalPricing.globalDiscountPercent ?? 0);
      }
      if (adminGlobalFinalPrice) {
        adminGlobalFinalPrice.value = String(data.globalPricing.effectivePriceIls ?? 39);
      }
    }

    const stats = data.stats || {};
    adminStatTotal.textContent = String(stats.totalUsers || 0);
    adminStatActive.textContent = String(stats.activeCount || 0);
    adminStatMrr.textContent = `MRR: ${stats.estimatedMrrIls || 0} ₪ / חודש`;
    adminStatTrialing.textContent = String(stats.trialingCount || 0);
    adminStatExpired.textContent = String((stats.canceledCount || 0) + (stats.expiredCount || 0));

    renderAdminTable();
  } catch (err) {
    showAdminFeedback(err.message, 'error');
  } finally {
    adminLoading.hidden = true;
    adminRefreshBtn.disabled = false;
  }
}

function renderAdminTable() {
  if (!adminUsersTbody) return;
  const query = (adminSearchInput.value || '').trim().toLowerCase();
  const statusFilter = adminStatusFilter.value || 'all';

  const filtered = adminUsersCache.filter((u) => {
    if (statusFilter !== 'all' && u.subscriptionStatus !== statusFilter) {
      return false;
    }
    if (!query) return true;
    const haystack = [u.email, u.displayName, u.uid, u.tranzilaStoId, u.cardLast4]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  if (filtered.length === 0) {
    adminUsersTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:28px;color:#64748b;">
          לא נמצאו משתמשים התואמים לחיפוש או לסינון שנבחר.
        </td>
      </tr>
    `;
    return;
  }

  adminUsersTbody.innerHTML = filtered
    .map((u) => {
      let badgeClass = 'badge-expired';
      let badgeLabel = 'פג תוקף / חסום';
      if (u.subscriptionStatus === 'active') {
        badgeClass = 'badge-active';
        badgeLabel = 'מנוי פעיל';
      } else if (u.subscriptionStatus === 'trialing') {
        badgeClass = 'badge-trialing';
        badgeLabel = `בניסיון (${u.trialRemainingDays} ימים)`;
      } else if (u.subscriptionStatus === 'canceled') {
        badgeClass = 'badge-canceled badge-stacked';
        badgeLabel = '<span>בוטל</span><span>(פעיל עד סוף תקופה)</span>';
      }

      const accessText = u.hasAccess ? '✓ גישה פתוחה למחולל' : '✕ גישה חסומה (Paywall)';
      const dateLabel =
        u.subscriptionStatus === 'active' || u.subscriptionStatus === 'canceled'
          ? `סיום תקופה: ${formatDateHe(u.currentPeriodEnd)}`
          : `סיום ניסיון: ${formatDateHe(u.trialEndsAt)}`;

      const stoInfo = u.tranzilaStoId ? `STO #${escapeHtml(u.tranzilaStoId)}` : 'ללא הו״ק';
      const cardInfo = u.cardLast4
        ? `•••• ${escapeHtml(u.cardLast4)}${u.cardExp ? ` (${escapeHtml(u.cardExp)})` : ''}`
        : '-';

      const basePrice = Number(u.basePriceIls) || Number(adminGlobalPricingCache.basePriceIls) || 39;
      const effectivePrice = Number(u.effectivePriceIls) || 39;
      const discountPct = Number(u.discountPercent) || 0;

      return `
        <tr data-uid="${escapeHtml(u.uid)}">
          <td>
            <div class="admin-user-cell">
              <div class="admin-user-name">
                <span>${escapeHtml(u.displayName || 'ללא שם')}</span>
                ${u.isAdmin ? '<span class="admin-role-tag">מנהל מערכת</span>' : ''}
              </div>
              <span class="admin-user-email" dir="ltr">${escapeHtml(u.email)}</span>
              <span class="admin-user-joined">נרשם: ${formatDateHe(u.createdAt)}</span>
            </div>
          </td>
          <td>
            <span class="subscription-badge ${badgeClass}">${badgeLabel}</span>
            <span class="admin-access-sub">${accessText}</span>
          </td>
          <td>
            <div>${dateLabel}</div>
          </td>
          <td>
            <div class="admin-user-pricing-box">
              <div class="admin-user-price-summary">
                <span>${effectivePrice} ₪/חודש</span>
                ${discountPct > 0 ? `<span class="admin-discount-tag">${discountPct}% הנחה</span>` : ''}
                ${u.hasCustomPricing ? '<span class="admin-custom-tag">מחיר אישי</span>' : ''}
              </div>
              <div class="admin-price-input-row">
                <label class="admin-price-mini-field" title="אחוז הנחה למשתמש זה">
                  <span>%</span>
                  <input
                    type="number"
                    class="admin-price-input"
                    data-discount-uid="${escapeHtml(u.uid)}"
                    data-base-price="${basePrice}"
                    min="0"
                    max="100"
                    step="1"
                    value="${discountPct}"
                  >
                </label>
                <label class="admin-price-mini-field" title="מחיר סופי לתשלום בשקלים">
                  <span>₪</span>
                  <input
                    type="number"
                    class="admin-price-input"
                    data-price-uid="${escapeHtml(u.uid)}"
                    data-base-price="${basePrice}"
                    min="1"
                    max="9999"
                    step="0.5"
                    value="${effectivePrice}"
                  >
                </label>
                <button
                  type="button"
                  class="btn-admin-price-save"
                  data-save-pricing-uid="${escapeHtml(u.uid)}"
                  data-save-pricing-email="${escapeHtml(u.email)}"
                >
                  שמור
                </button>
                ${
                  u.hasCustomPricing
                    ? `<button type="button" class="btn-admin-price-reset" data-reset-pricing-uid="${escapeHtml(u.uid)}" title="איפוס לתמחור המערכת">איפוס</button>`
                    : ''
                }
              </div>
            </div>
          </td>
          <td dir="ltr" style="text-align:right;">
            <div><strong>${stoInfo}</strong></div>
            <div style="font-size:0.78rem;color:#64748b;">${cardInfo}</div>
          </td>
          <td>
            <div class="admin-action-group" data-action-group-uid="${escapeHtml(u.uid)}">
              <select class="admin-row-select" data-select-uid="${escapeHtml(u.uid)}" aria-label="בחר פעולה על חשבון המשתמש">
                <option value="grant_active_30">הפעל מנוי חודשי (+30 יום)</option>
                <option value="grant_active_365">הפעל מנוי שנתי / VIP (+365 יום)</option>
                <option value="reset_trial_3">אפס / הארך ניסיון (3 ימים)</option>
                <option value="reset_trial_7">הארך תקופת ניסיון (7 ימים)</option>
                <option value="cancel_subscription">בטל מנוי והו״ק בטרנזילה</option>
                <option value="expire_access">חסום גישה מיידית (פג תוקף)</option>
                <option value="delete_user">מחק משתמש מהמערכת</option>
              </select>
              <button
                type="button"
                class="btn-admin-apply"
                data-apply-uid="${escapeHtml(u.uid)}"
                data-apply-email="${escapeHtml(u.email)}"
              >
                בצע
              </button>
            </div>
            <div class="cancel-confirm-box admin-inline-confirm" data-confirm-box-uid="${escapeHtml(u.uid)}" hidden></div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function saveGlobalPricing() {
  if (!adminSaveGlobalPricingBtn) return;
  const basePriceIls = Math.max(1, Number(adminGlobalBasePrice?.value) || 39);
  const globalDiscountPercent = Math.max(0, Math.min(100, Number(adminGlobalDiscount?.value) || 0));
  const customPriceIls = Math.max(1, Number(adminGlobalFinalPrice?.value) || basePriceIls);

  adminSaveGlobalPricingBtn.disabled = true;
  showAdminFeedback('');

  try {
    const resp = await authorizedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update_global_pricing',
        basePriceIls,
        globalDiscountPercent,
        customPriceIls
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'שגיאה בשמירת תמחור המערכת');
    }

    showAdminFeedback(data.message || 'תמחור המערכת נשמר בהצלחה.', 'success');
    await loadAdminUsers();
    await fetchSubscriptionStatus();
  } catch (err) {
    showAdminFeedback(err.message, 'error');
  } finally {
    adminSaveGlobalPricingBtn.disabled = false;
  }
}

async function saveUserPricing(targetUid, reset = false, btnElement = null) {
  if (!targetUid) return;
  const discountInput = adminUsersTbody?.querySelector(
    `input[data-discount-uid="${CSS.escape(targetUid)}"]`
  );
  const priceInput = adminUsersTbody?.querySelector(
    `input[data-price-uid="${CSS.escape(targetUid)}"]`
  );

  const payload = {
    action: 'set_user_pricing',
    targetUid,
    reset: Boolean(reset)
  };

  if (!reset) {
    payload.discountPercent = discountInput ? Number(discountInput.value) : 0;
    payload.customPriceIls = priceInput ? Number(priceInput.value) : undefined;
  }

  if (btnElement) btnElement.disabled = true;
  showAdminFeedback('');

  try {
    const resp = await authorizedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'שגיאה בעדכון מחיר המשתמש');
    }

    showAdminFeedback(data.message || 'המחיר האישי עודכן בהצלחה.', 'success');
    await loadAdminUsers();
    if (currentUser && targetUid === currentUser.uid) {
      await fetchSubscriptionStatus();
    }
  } catch (err) {
    showAdminFeedback(err.message, 'error');
  } finally {
    if (btnElement) btnElement.disabled = false;
  }
}

function closeAllAdminRowConfirmBoxes() {
  if (!adminUsersTbody) return;
  adminUsersTbody.querySelectorAll('[data-confirm-box-uid]').forEach((box) => {
    box.innerHTML = '';
    box.hidden = true;
  });
  adminUsersTbody.querySelectorAll('[data-action-group-uid]').forEach((group) => {
    group.hidden = false;
  });
}

function openAdminRowConfirmBox(targetUid, email, selectedValue) {
  if (!adminUsersTbody || !targetUid) return;
  closeAllAdminRowConfirmBoxes();

  const actionGroup = adminUsersTbody.querySelector(
    `[data-action-group-uid="${CSS.escape(targetUid)}"]`
  );
  const confirmBox = adminUsersTbody.querySelector(
    `[data-confirm-box-uid="${CSS.escape(targetUid)}"]`
  );
  if (!confirmBox) return;

  let titleHtml = '';
  let descHtml = '';
  let confirmBtnLabel = '';

  if (selectedValue === 'delete_user') {
    titleHtml = 'האם למחוק לצמיתות את המשתמש מהמערכת?';
    descHtml = `המשתמש <strong dir="ltr">${escapeHtml(email)}</strong> יימחק לצמיתות (כולל ביטול הוראת קבע בטרנזילה אם קיימת).`;
    confirmBtnLabel = 'כן, מחק משתמש';
  } else if (selectedValue === 'cancel_subscription') {
    titleHtml = 'האם לבטל את המנוי והוראת הקבע?';
    descHtml = `הוראת הקבע בטרנזילה עבור <strong dir="ltr">${escapeHtml(email)}</strong> תופסק והמנוי יעבור לסטטוס מבוטל.`;
    confirmBtnLabel = 'כן, בטל מנוי';
  } else {
    return;
  }

  if (actionGroup) {
    actionGroup.hidden = true;
  }

  confirmBox.innerHTML = `
    <p>
      <strong>${titleHtml}</strong><br>
      ${descHtml}
    </p>
    <div class="cancel-confirm-buttons">
      <button
        type="button"
        class="btn-danger btn-sm"
        data-confirm-exec-uid="${escapeHtml(targetUid)}"
        data-confirm-exec-email="${escapeHtml(email)}"
        data-confirm-exec-action="${escapeHtml(selectedValue)}"
      >
        ${confirmBtnLabel}
      </button>
      <button
        type="button"
        class="btn-secondary btn-sm"
        data-confirm-abort-uid="${escapeHtml(targetUid)}"
      >
        ביטול
      </button>
    </div>
  `;
  confirmBox.hidden = false;
}

async function executeAdminUserAction(targetUid, email, selectedValue, btnElement, isConfirmed = false) {
  let payload = { targetUid };

  if (selectedValue === 'grant_active_30') {
    payload.action = 'grant_active';
    payload.days = 30;
  } else if (selectedValue === 'grant_active_365') {
    payload.action = 'grant_active';
    payload.days = 365;
  } else if (selectedValue === 'reset_trial_3') {
    payload.action = 'reset_trial';
    payload.days = 3;
  } else if (selectedValue === 'reset_trial_7') {
    payload.action = 'reset_trial';
    payload.days = 7;
  } else if (selectedValue === 'cancel_subscription') {
    if (!isConfirmed) {
      openAdminRowConfirmBox(targetUid, email, selectedValue);
      return;
    }
    payload.action = 'cancel_subscription';
  } else if (selectedValue === 'expire_access') {
    payload.action = 'expire_access';
  } else if (selectedValue === 'delete_user') {
    if (!isConfirmed) {
      openAdminRowConfirmBox(targetUid, email, selectedValue);
      return;
    }
    payload.action = 'delete_user';
  } else {
    return;
  }

  if (btnElement) btnElement.disabled = true;
  showAdminFeedback('');

  try {
    const resp = await authorizedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'שגיאה בביצוע פעולת הניהול');
    }

    showAdminFeedback(data.message || 'הפעולה בוצעה בהצלחה.', 'success');
    await loadAdminUsers();

    // If admin modified their own account, refresh main header state too
    if (currentUser && targetUid === currentUser.uid) {
      await fetchSubscriptionStatus();
    }
  } catch (err) {
    showAdminFeedback(err.message, 'error');
    closeAllAdminRowConfirmBoxes();
  } finally {
    if (btnElement) btnElement.disabled = false;
  }
}

// ===============================================================
// Event Listeners
// ===============================================================

function setAuthTab(mode) {
  authMode = mode;
  authErrorBox.hidden = true;

  if (mode === 'register') {
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');
    authTitle.textContent = 'הרשמה וקבלת 3 ימי ניסיון חינם';
    registerNameGroup.hidden = false;
    if (registerConfirmPasswordGroup) registerConfirmPasswordGroup.hidden = false;
    if (authConfirmPasswordInput) authConfirmPasswordInput.required = true;
    forgotPasswordBtn.hidden = true;
    authSubmitBtn.textContent = 'צור חשבון והתחל 3 ימי ניסיון חינם';
    authPasswordInput.setAttribute('autocomplete', 'new-password');
  } else {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'false');
    authTitle.textContent = 'התחברות למחולל הסקריפטים';
    registerNameGroup.hidden = true;
    if (registerConfirmPasswordGroup) registerConfirmPasswordGroup.hidden = true;
    if (authConfirmPasswordInput) {
      authConfirmPasswordInput.required = false;
      authConfirmPasswordInput.value = '';
    }
    forgotPasswordBtn.hidden = false;
    authSubmitBtn.textContent = 'התחברות למערכת';
    authPasswordInput.setAttribute('autocomplete', 'current-password');
  }
}

tabLogin.addEventListener('click', () => setAuthTab('login'));
tabRegister.addEventListener('click', () => setAuthTab('register'));

googleLoginBtn.addEventListener('click', async () => {
  authErrorBox.hidden = true;
  googleLoginBtn.disabled = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    authErrorBox.textContent = translateFirebaseError(err);
    authErrorBox.hidden = false;
  } finally {
    googleLoginBtn.disabled = false;
  }
});

emailAuthForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authErrorBox.hidden = true;

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  const fullName = authNameInput.value.trim();

  if (!email || !password) {
    authErrorBox.textContent = 'נא להזין כתובת אימייל וסיסמה.';
    authErrorBox.hidden = false;
    return;
  }

  if (authMode === 'register') {
    const confirmPassword = authConfirmPasswordInput ? authConfirmPasswordInput.value : '';
    if (!confirmPassword) {
      authErrorBox.textContent = 'נא לאמת את הסיסמה בשדה אימות סיסמה.';
      authErrorBox.hidden = false;
      return;
    }
    if (password !== confirmPassword) {
      authErrorBox.textContent = 'הסיסמאות אינן תואמות.';
      authErrorBox.hidden = false;
      return;
    }
    if (password.length < 6) {
      authErrorBox.textContent = 'הסיסמה חלשה מדי – יש לבחור סיסמה באורך 6 תווים לפחות.';
      authErrorBox.hidden = false;
      return;
    }
  }

  authSubmitBtn.disabled = true;
  try {
    if (authMode === 'register') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (fullName && cred.user) {
        await updateProfile(cred.user, { displayName: fullName });
      }
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authErrorBox.textContent = translateFirebaseError(err);
    authErrorBox.hidden = false;
  } finally {
    authSubmitBtn.disabled = false;
  }
});

forgotPasswordBtn.addEventListener('click', async () => {
  const email = authEmailInput.value.trim();
  if (!email) {
    authErrorBox.textContent = 'הזן את כתובת האימייל שלך בשדה למעלה ולחץ שוב על "שכחת סיסמה?".';
    authErrorBox.hidden = false;
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showGlobalBanner('קישור לאיפוס סיסמה נשלח לכתובת האימייל שלך.', 'success');
  } catch (err) {
    authErrorBox.textContent = translateFirebaseError(err);
    authErrorBox.hidden = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  showGlobalBanner('');
  await signOut(auth);
});

if (adminPanelBtn) {
  adminPanelBtn.addEventListener('click', openAdminModal);
}

if (closeAdminModalBtn) {
  closeAdminModalBtn.addEventListener('click', () => {
    adminModal.hidden = true;
  });
}

if (adminRefreshBtn) {
  adminRefreshBtn.addEventListener('click', loadAdminUsers);
}

if (adminSearchInput) {
  adminSearchInput.addEventListener('input', renderAdminTable);
}

if (adminStatusFilter) {
  adminStatusFilter.addEventListener('change', renderAdminTable);
}

// Live two-way calculation for Global Pricing Bar
if (adminGlobalBasePrice && adminGlobalDiscount && adminGlobalFinalPrice) {
  const recalcGlobalFromDiscount = () => {
    const base = Math.max(1, Number(adminGlobalBasePrice.value) || 39);
    const disc = Math.max(0, Math.min(100, Number(adminGlobalDiscount.value) || 0));
    const finalPrice = Math.max(1, Math.round(base * (1 - disc / 100) * 100) / 100);
    adminGlobalFinalPrice.value = String(finalPrice);
  };
  const recalcGlobalFromFinalPrice = () => {
    const base = Math.max(1, Number(adminGlobalBasePrice.value) || 39);
    const finalPrice = Math.max(1, Number(adminGlobalFinalPrice.value) || base);
    const disc =
      base > finalPrice
        ? Math.max(0, Math.min(100, Math.round(((base - finalPrice) / base) * 10000) / 100))
        : 0;
    adminGlobalDiscount.value = String(disc);
  };
  adminGlobalBasePrice.addEventListener('input', recalcGlobalFromDiscount);
  adminGlobalDiscount.addEventListener('input', recalcGlobalFromDiscount);
  adminGlobalFinalPrice.addEventListener('input', recalcGlobalFromFinalPrice);
}

if (adminSaveGlobalPricingBtn) {
  adminSaveGlobalPricingBtn.addEventListener('click', saveGlobalPricing);
}

if (adminUsersTbody) {
  // Live two-way calculation between % discount and ₪ price in each user row
  adminUsersTbody.addEventListener('input', (e) => {
    const discountEl = e.target.closest('input[data-discount-uid]');
    if (discountEl) {
      const uid = discountEl.getAttribute('data-discount-uid');
      const base = Math.max(1, Number(discountEl.getAttribute('data-base-price')) || 39);
      const disc = Math.max(0, Math.min(100, Number(discountEl.value) || 0));
      const priceEl = adminUsersTbody.querySelector(`input[data-price-uid="${CSS.escape(uid)}"]`);
      if (priceEl) {
        const computed = Math.max(1, Math.round(base * (1 - disc / 100) * 100) / 100);
        priceEl.value = String(computed);
      }
      return;
    }

    const priceEl = e.target.closest('input[data-price-uid]');
    if (priceEl) {
      const uid = priceEl.getAttribute('data-price-uid');
      const base = Math.max(1, Number(priceEl.getAttribute('data-base-price')) || 39);
      const customPrice = Math.max(1, Number(priceEl.value) || base);
      const discountInput = adminUsersTbody.querySelector(
        `input[data-discount-uid="${CSS.escape(uid)}"]`
      );
      if (discountInput) {
        const computedDisc =
          base > customPrice
            ? Math.max(0, Math.min(100, Math.round(((base - customPrice) / base) * 10000) / 100))
            : 0;
        discountInput.value = String(computedDisc);
      }
    }
  });

  adminUsersTbody.addEventListener('click', (e) => {
    const savePriceBtn = e.target.closest('[data-save-pricing-uid]');
    if (savePriceBtn) {
      const targetUid = savePriceBtn.getAttribute('data-save-pricing-uid');
      saveUserPricing(targetUid, false, savePriceBtn);
      return;
    }

    const resetPriceBtn = e.target.closest('[data-reset-pricing-uid]');
    if (resetPriceBtn) {
      const targetUid = resetPriceBtn.getAttribute('data-reset-pricing-uid');
      saveUserPricing(targetUid, true, resetPriceBtn);
      return;
    }

    const confirmExecBtn = e.target.closest('[data-confirm-exec-uid]');
    if (confirmExecBtn) {
      const targetUid = confirmExecBtn.getAttribute('data-confirm-exec-uid');
      const email = confirmExecBtn.getAttribute('data-confirm-exec-email') || '';
      const actionType = confirmExecBtn.getAttribute('data-confirm-exec-action') || '';
      executeAdminUserAction(targetUid, email, actionType, confirmExecBtn, true);
      return;
    }

    const confirmAbortBtn = e.target.closest('[data-confirm-abort-uid]');
    if (confirmAbortBtn) {
      closeAllAdminRowConfirmBoxes();
      return;
    }

    const btn = e.target.closest('[data-apply-uid]');
    if (!btn) return;
    const targetUid = btn.getAttribute('data-apply-uid');
    const email = btn.getAttribute('data-apply-email') || '';
    const selectEl = adminUsersTbody.querySelector(`select[data-select-uid="${CSS.escape(targetUid)}"]`);
    if (!selectEl) return;
    executeAdminUserAction(targetUid, email, selectEl.value, btn, false);
  });
}

upgradeTopBtn.addEventListener('click', openCheckoutModal);
paywallSubscribeBtn.addEventListener('click', openCheckoutModal);
manageUpgradeBtn.addEventListener('click', openCheckoutModal);

closeCheckoutModalBtn.addEventListener('click', () => {
  checkoutModal.hidden = true;
  recreateCleanTranzilaIframe();
});

mockApprovePaymentBtn.addEventListener('click', () => triggerMockWebhook('000'));
mockFailPaymentBtn.addEventListener('click', () => triggerMockWebhook('004'));

manageSubBtn.addEventListener('click', () => {
  if (currentSubState) {
    populateManageModal(currentSubState);
  }
  manageModal.hidden = false;
});

closeManageModalBtn.addEventListener('click', () => {
  manageModal.hidden = true;
});

openCancelConfirmBtn.addEventListener('click', () => {
  renderManageCancelConfirmBox();
  openCancelConfirmBtn.hidden = true;
  cancelConfirmBox.hidden = false;
});

if (cancelConfirmBox) {
  cancelConfirmBox.addEventListener('click', (e) => {
    if (e.target.closest('#confirm-cancel-sub-btn')) {
      handleCancelSubscription();
    } else if (e.target.closest('#abort-cancel-sub-btn')) {
      cancelConfirmBox.innerHTML = '';
      cancelConfirmBox.hidden = true;
      openCancelConfirmBtn.hidden = false;
    }
  });
}

// Sandbox testing buttons
simExpireBtn.addEventListener('click', async () => {
  const resp = await authorizedFetch('/api/subscription', {
    method: 'POST',
    body: JSON.stringify({ action: 'simulate_expire_trial' })
  });
  if (resp.ok) {
    const data = await resp.json();
    renderSubscriptionState(data);
    showGlobalBanner('סימולציה: תקופת הניסיון בת 3 הימים הסתיימה והגישה למחולל נחסמה בשרת.', 'error');
  }
});

simResetBtn.addEventListener('click', async () => {
  const resp = await authorizedFetch('/api/subscription', {
    method: 'POST',
    body: JSON.stringify({ action: 'simulate_reset_trial' })
  });
  if (resp.ok) {
    const data = await resp.json();
    renderSubscriptionState(data);
    showGlobalBanner('סימולציה: תקופת הניסיון אופסה ל-3 ימים מלאים.', 'success');
  }
});

// Generator Input Listeners
copyAppScriptButton.addEventListener('click', function () {
  copyToClipboard(appScriptCodeTextarea, appScriptNotification);
});

copyStorylineCodeButton.addEventListener('click', function () {
  copyToClipboard(storylineCodeTextarea, storylineNotification);
});

variableCountInput.addEventListener('input', function (e) {
  variableCount = Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0));
  variableNames = Array.from({ length: variableCount }, (_, i) => variableNames[i] || '');
  updateVariableNames();
  scheduleServerScriptGeneration();
});

webAppUrlInput.addEventListener('input', scheduleServerScriptGeneration);

// Check URL query params after Tranzila redirect (?payment=success or ?payment=failed)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('payment') === 'success') {
  showGlobalBanner('התשלום התקבל! מאמת סטטוס מנוי מול השרת...', 'success');
  window.history.replaceState({}, document.title, window.location.pathname);
} else if (urlParams.get('payment') === 'failed') {
  showGlobalBanner('פעולת התשלום לא הושלמה או נדחתה. לא בוצע חיוב.', 'error');
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Listen for postMessage from Tranzila iFrame return callback
window.addEventListener('message', async (event) => {
  const data = event && event.data;
  if (!data || (data.source !== 'storyline-tranzila' && data.source !== 'pawza-tranzila')) return;

  const isApproved = data.status === 'success' || data.status === 'processing';

  setTimeout(async () => {
    try {
      if (activeCheckoutSession && activeCheckoutSession.sessionId) {
        const sessionSum = Number(activeCheckoutSession.amount || 39).toFixed(2);
        await fetch(
          `/api/webhooks/tranzila?session_id=${encodeURIComponent(activeCheckoutSession.sessionId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: activeCheckoutSession.sessionId,
              Response: isApproved ? '000' : 'ERR',
              sum: sessionSum,
              currency: 'ILS'
            })
          }
        );
      }
    } catch (_) {}

    checkoutModal.hidden = true;
    recreateCleanTranzilaIframe();

    if (isApproved) {
      showGlobalBanner(
        'התשלום אושר בהצלחה! המנוי החודשי הופעל וחשבונית מס/קבלה הופקה דרך טרנזילה.',
        'success'
      );
    } else {
      showGlobalBanner(
        'פעולת התשלום לא הושלמה או נדחתה על-ידי חברת האשראי. לא בוצע חיוב.',
        'error'
      );
    }
    await fetchSubscriptionStatus();
  }, 1100);
});

// Support Mailto Template Helper
function updateSupportMailto(email = '') {
  const floatingBtn = document.getElementById('floating-support-btn');
  if (!floatingBtn) return;
  const userEmailText = (email || '').trim() || '[נא לציין אימייל]';
  const subject = encodeURIComponent('בקשת סיוע / תמיכה טכנית - מחולל סקריפטים Storyline ל-Google Sheets');
  const body = encodeURIComponent(
    `שלום שחר,\n\nאני פונה לקבלת סיוע בשימוש במחולל הסקריפטים לסטוריליין:\n\n- כתובת האימייל שלי במערכת: ${userEmailText}\n- תיאור הצורך או התקלה: \n- מספר המשתנים בפרויקט: \n- צילום מסך או קישור ללומדה (אם רלוונטי): \n\nתודה רבה!`
  );
  floatingBtn.href = `mailto:shaharsolutions@gmail.com?subject=${subject}&body=${body}`;
}

// Observe Firebase Authentication State
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateSupportMailto(user ? user.email : '');
  if (user) {
    await fetchSubscriptionStatus();
  } else {
    currentSubState = null;
    authLoading.hidden = true;
    userBar.hidden = true;
    sandboxBar.hidden = true;
    paywallSection.hidden = true;
    generatorWorkspace.hidden = true;
    authSection.hidden = false;
    appScriptCodeTextarea.value = '';
    storylineCodeTextarea.value = '';
  }
});

updateSupportMailto('');
updateVariableNames();

// ===============================================================
// Interactive Hebrew Video Tutorial Player Controller
// ===============================================================

const TUTORIAL_SCENES_META = [
  {
    idx: 0,
    audio: '/storyline-googlesheets-script-generator/tutorial-audio/scene1.mp3',
    duration: 40.3,
    badge: 'שלב 1 מתוך 6 • Storyline 360',
    caption:
      'פתיחת חלון המשתנים (Manage Project Variables) ב-Storyline 360 ובדיקת האיות המדויק של שמות המשתנים: LearnerName, QuizScore, Department.'
  },
  {
    idx: 1,
    audio: '/storyline-googlesheets-script-generator/tutorial-audio/scene2.mp3',
    duration: 32.14,
    badge: 'שלב 2 מתוך 6 • מחולל הסקריפטים',
    caption:
      'בחירת מספר המשתנים (3), הקלדת השמות המדויקים (Case-Sensitive) והעתקת קוד ה-Google Apps Script שנוצר אוטומטית.'
  },
  {
    idx: 2,
    audio: '/storyline-googlesheets-script-generator/tutorial-audio/scene3.mp3',
    duration: 26.16,
    badge: 'שלב 3 מתוך 6 • Google Sheets',
    caption:
      'פתיחת Extensions > Apps Script בגיליון ה-Google Sheets, הדבקת הקוד מהמחולל ושמירת הפרויקט (Ctrl+S).'
  },
  {
    idx: 3,
    audio: '/storyline-googlesheets-script-generator/tutorial-audio/scene4.mp3',
    duration: 36.58,
    badge: 'שלב 4 מתוך 6 • פרסום Web App',
    caption:
      'לחיצה על Deploy > New deployment מסוג Web app, הגדרת Who has access: Anyone, והעתקת כתובת ה-Web App URL.'
  },
  {
    idx: 4,
    audio: '/storyline-googlesheets-script-generator/tutorial-audio/scene5.mp3',
    duration: 26.21,
    badge: 'שלב 5 מתוך 6 • קוד JavaScript',
    caption:
      'הדבקת כתובת ה-Web App URL במחולל והעתקת קוד ה-JavaScript המוכן עבור Storyline 360.'
  },
  {
    idx: 5,
    audio: '/storyline-googlesheets-script-generator/tutorial-audio/scene6.mp3',
    duration: 45.07,
    badge: 'שלב 6 מתוך 6 • טריגר ובדיקת אמת',
    caption:
      'יצירת טריגר Execute JavaScript ב-Storyline, פרסום הלומדה (Publish), וצפייה בנתונים מתעדכנים בזמן אמת ב-Google Sheets!'
  }
];

const TUTORIAL_SUBTITLE_CUES = {
  0: [
    { start: 0.1, end: 6.54, text: "שלום וברוכים הבאים להדרכה על מחולל הסקריפטים לסטוריליין, מבית שחר פתרונות דיגיטליים." },
    { start: 6.49, end: 16.84, text: "במדריך זה נלמד איך לחבר לומדה בארטיקולייט סטוריליין 360 ישירות לגיליון Google Sheets, ולשמור נתוני לומדים בזמן אמת וללא צורך בידע בתכנות." },
    { start: 16.84, end: 25.73, text: "לפני שנתחיל בעבודה עם מחולל הסקריפטים, ניכנס לפרויקט שלנו בתוך סטוריליין ונפתח את חלון ניהול המשתנים, Project Variables." },
    { start: 25.73, end: 35.74, text: "בדוגמה שלנו יצרנו שלושה משתנים שאנחנו רוצים לייצא: LearnerName לשם הלומד, QuizScore לציון המבחן, ולבסוף Department למחלקה בארגון." },
    { start: 35.74, end: 40.27, text: "שימו לב היטב לאותיות הגדולות והקטנות בשמות של המשתנים." }
  ],
  1: [
    { start: 0.1, end: 3.42, text: "כעת נעבור אל מחולל הסקריפטים באתר." },
    { start: 3.37, end: 8.99, text: "בשדה מספר המשתנים נזין שלוש, ומיד ייפתחו לנו שלוש תיבות טקסט." },
    { start: 8.99, end: 18.98, text: "נקליד בכל תיבה את שם המשתנה בדיוק כפי שהוא מופיע בתוך סטורי-ליין, כולל אותיות גדולות וקטנות: LearnerName, אחריו QuizScore, ולבסוף Department." },
    { start: 18.98, end: 28.13, text: "ברגע שהקלדנו את השמות, מחולל הסקריפטים מייצר עבורנו באופן אוטומטי בתיבה הראשונה את קוד Google Apps Script המותאם למשתנים שלנו." },
    { start: 28.13, end: 32.09, text: "נלחץ על כפתור העתק קוד כדי להעתיק אותו ללוח." }
  ],
  2: [
    { start: 0.1, end: 4.87, text: "נעבור לגיליון Google Sheets שבו נרצה לאסוף את נתוני הלומדים." },
    { start: 4.82, end: 9.77, text: "מומלץ לרשום בשורה הראשונה כותרות לעמודות לפי סדר המשתנים שלנו." },
    { start: 9.77, end: 16.01, text: "בתפריט העליון נלחץ על Extensions, או הרחבות, ונבחר באפשרות Apps Script." },
    { start: 16.01, end: 26.14, text: "בחלון עורך הקוד שנפתח, נמחק את הקוד הקיים, נדביק את הקוד שהעתקנו ממחולל הסקריפטים, ונלחץ על סמל הדיסקט או קונטרול S כדי לשמור את הפרויקט." }
  ],
  3: [
    { start: 0.1, end: 6.09, text: "כדי שהלומדה תוכל לשלוח נתונים לגיליון, נפרסם את הסקריפט כיישום אינטרנט." },
    { start: 6.04, end: 11.36, text: "נלחץ למעלה על הכפתור הכחול Deploy, ונבחר באפשרות New deployment." },
    { start: 11.37, end: 15.09, text: "נלחץ על גלגל השיניים ונבחר בסוג Web app." },
    { start: 15.08, end: 20.87, text: "בשדה ההרצה, Execute, נוודא שמוגדר Me, כלומר החשבון שלנו." },
    { start: 20.87, end: 29.72, text: "חשוב מאוד: תחת ההגדרה Who has access נבחר באפשרות Anyone, כדי שכל לומד יוכל לשלוח נתונים מהדפדפן שלו ללא חסימה." },
    { start: 29.72, end: 36.52, text: "נלחץ על Deploy, נאשר את ההרשאות בחשבון Google, ובסיום נעתיק את הכתובת Web app URL שנוצרה." }
  ],
  4: [
    { start: 0.1, end: 7.03, text: "נחזור אל מחולל הסקריפטים שלנו, ונדביק בתיבה המתאימה את הכתובת של Web app שהעתקנו בשלב הקודם." },
    { start: 6.98, end: 13.41, text: "מיד עם הדבקת הקישור, מחולל הסקריפטים משלים אוטומטית את קוד JavaScript בתיבה השנייה." },
    { start: 13.4, end: 22.01, text: "הקוד הזה שולף את ערכי המשתנים מתוך הנגן של סטורי-ליין באמצעות פקודת GetVar, ושולח אותם ברקע ישירות לכתובת הגיליון שלנו." },
    { start: 22.01, end: 26.14, text: "נלחץ על כפתור העתק קוד בתיבת הקוד של JavaScript." }
  ],
  5: [
    { start: 0.1, end: 8.25, text: "נחזור אל ארטיקולייט סטורי-ליין 360, לשקופית שבה נרצה לשלוח את הנתונים – למשל שקופית הסיום או כפתור הגשה." },
    { start: 8.2, end: 12.69, text: "ניצור טריגר חדש ונבחר באפשרות Execute JavaScript." },
    { start: 12.69, end: 19.16, text: "נלחץ על הקישור האדום של JavaScript, נדביק את הקוד שהעתקנו ממחולל הסקריפטים ונלחץ על אוקיי." },
    { start: 19.16, end: 25.02, text: "נגדיר שהטריגר יפעל למשל בעת לחיצה על כפתור השליחה, או כשציר הזמן מתחיל." },
    { start: 25.01, end: 34.07, text: "שימו לב: כדי לבדוק שהכול עובד, יש לבצע Publish לפורמט Web או למערכת LMS, ולא להסתפק בתצוגה מקדימה, Preview." },
    { start: 34.07, end: 41.13, text: "ברגע שהלומד מסיים ולוחץ על הכפתור – הנתונים מופיעים מיד בתוך שורה חדשה בגיליון Google Sheets שלנו!" },
    { start: 41.14, end: 45.05, text: "בהצלחה, ואנחנו כאן לרשותכם בכל שאלה." }
  ]
};

(function initTutorialPlayer() {
  const audioEl = document.getElementById('tutorial-audio-el');
  if (!audioEl) return;

  const startOverlay = document.getElementById('tutorial-start-overlay');
  const subtitlesOverlayEl = document.getElementById('tutorial-subtitles-overlay');
  const subtitlesTextEl = document.getElementById('tutorial-subtitles-text');
  const bigPlayBtn = document.getElementById('tutorial-big-play-btn');
  const playPauseBtn = document.getElementById('tut-play-pause-btn');
  const iconPlay = document.getElementById('tut-icon-play');
  const iconPause = document.getElementById('tut-icon-pause');
  const playLabel = document.getElementById('tut-play-label');
  const prevBtn = document.getElementById('tut-prev-btn');
  const nextBtn = document.getElementById('tut-next-btn');
  const seekSlider = document.getElementById('tut-seek-slider');
  const curTimeEl = document.getElementById('tut-current-time');
  const totTimeEl = document.getElementById('tut-total-time');
  const speedBtn = document.getElementById('tut-speed-btn');
  const muteBtn = document.getElementById('tut-mute-btn');
  const iconVol = document.getElementById('tut-icon-vol');
  const iconMuted = document.getElementById('tut-icon-muted');
  const stepBadgeEl = document.getElementById('tutorial-step-badge');
  const captionTextEl = document.getElementById('tutorial-caption-text');
  const captionsBtn = document.getElementById('tut-cc-btn');
  const fillDemoBtn = document.getElementById('tut-fill-demo-btn');
  const scrollToTutorialBtn = document.getElementById('scroll-to-tutorial-btn');
  const toggleCollapseBtn = document.getElementById('toggle-tutorial-collapse');
  const toggleCollapseLabel = document.getElementById('toggle-tutorial-label');
  const playerBody = document.getElementById('tutorial-player-body');

  const stepTabs = Array.from(document.querySelectorAll('.tutorial-step-tab'));
  const sceneEls = Array.from(document.querySelectorAll('.tutorial-scene'));

  let currentSceneIdx = 0;
  let playbackSpeedIdx = 0;
  let captionsEnabled = true; // Captions enabled by default
  const SPEEDS = [1, 1.25, 1.5];

  function formatMmSs(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function setElHidden(el, shouldHide) {
    if (!el) return;
    if (shouldHide) {
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    } else {
      el.removeAttribute('hidden');
      el.style.display = '';
    }
  }

  function updatePlayPauseUI(isPlaying) {
    setElHidden(iconPlay, isPlaying);
    setElHidden(iconPause, !isPlaying);
    if (playPauseBtn) {
      playPauseBtn.classList.toggle('is-playing', isPlaying);
    }
    if (playLabel) {
      if (isPlaying) {
        playLabel.textContent = 'השהה';
      } else {
        playLabel.textContent =
          audioEl.currentTime > 0 && !audioEl.ended ? 'המשך ניגון' : 'הפעל קריינות';
      }
    }
    if (isPlaying && startOverlay) {
      setElHidden(startOverlay, true);
    }
  }

  function updateTimeDrivenMicroAnimations(sceneIdx, currentTime) {
    if (sceneIdx === 0) {
      const rows = document.querySelectorAll('.sl-var-row');
      rows.forEach((r, i) => {
        const active =
          (i === 0 && currentTime >= 22 && currentTime < 28) ||
          (i === 1 && currentTime >= 26 && currentTime < 32) ||
          (i === 2 && currentTime >= 30);
        r.classList.toggle('highlight-active', active);
      });
    } else if (sceneIdx === 1) {
      const copyBtn = document.getElementById('anim-copy-gas-btn');
      const copyText = document.getElementById('anim-copy-gas-text');
      if (copyBtn && copyText) {
        const isCopied = currentTime >= 27;
        copyBtn.classList.toggle('copied-flash', isCopied);
        copyText.textContent = isCopied ? 'הועתק ללוח! ✓' : 'העתק קוד';
      }
    } else if (sceneIdx === 4) {
      const copyJsBtn = document.getElementById('anim-copy-js-btn');
      const copyJsText = document.getElementById('anim-copy-js-text');
      if (copyJsBtn && copyJsText) {
        const isCopied = currentTime >= 20;
        copyJsBtn.classList.toggle('copied-flash', isCopied);
        copyJsText.textContent = isCopied ? 'הועתק ללוח! ✓' : 'העתק קוד';
      }
    }
  }

  function updateSubtitles(sceneIdx, currentTime) {
    if (!subtitlesOverlayEl || !subtitlesTextEl) return;
    if (!captionsEnabled) {
      setElHidden(subtitlesOverlayEl, true);
      subtitlesTextEl.textContent = '';
      return;
    }
    if (audioEl.paused && (!currentTime || currentTime <= 0.05)) {
      setElHidden(subtitlesOverlayEl, true);
      subtitlesTextEl.textContent = '';
      return;
    }
    const cues = TUTORIAL_SUBTITLE_CUES[sceneIdx] || [];
    let activeCue = null;
    for (let i = cues.length - 1; i >= 0; i--) {
      const c = cues[i];
      const start = i === 0 ? 0 : c.start;
      const nextStart = i < cues.length - 1 ? cues[i + 1].start : Infinity;
      const end = Math.min(nextStart, c.end + 0.35);
      if (currentTime >= start && currentTime <= end) {
        activeCue = c;
        break;
      }
    }

    if (activeCue && activeCue.text) {
      if (subtitlesTextEl.textContent !== activeCue.text) {
        subtitlesTextEl.textContent = activeCue.text;
      }
      setElHidden(subtitlesOverlayEl, false);
    } else {
      setElHidden(subtitlesOverlayEl, true);
      subtitlesTextEl.textContent = '';
    }
  }

  function selectScene(idx, autoPlay = false) {
    const safeIdx = Math.max(0, Math.min(TUTORIAL_SCENES_META.length - 1, idx));
    currentSceneIdx = safeIdx;
    const meta = TUTORIAL_SCENES_META[safeIdx];

    stepTabs.forEach((tab, i) => {
      const isAct = i === safeIdx;
      tab.classList.toggle('active', isAct);
      tab.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });

    sceneEls.forEach((sc, i) => {
      sc.classList.toggle('active', i === safeIdx);
    });

    if (stepBadgeEl) stepBadgeEl.textContent = meta.badge;
    if (captionTextEl) captionTextEl.textContent = meta.caption;
    if (curTimeEl) curTimeEl.textContent = '00:00';
    if (totTimeEl) totTimeEl.textContent = formatMmSs(meta.duration);
    if (seekSlider) seekSlider.value = '0';

    audioEl.pause();
    audioEl.src = meta.audio;
    const targetRate = SPEEDS[playbackSpeedIdx];
    audioEl.defaultPlaybackRate = targetRate;
    audioEl.load();
    audioEl.playbackRate = targetRate;

    updateSubtitles(safeIdx, 0);

    if (autoPlay) {
      setElHidden(startOverlay, true);
      audioEl.play().then(() => {
        audioEl.playbackRate = SPEEDS[playbackSpeedIdx];
        updateSubtitles(safeIdx, audioEl.currentTime || 0);
      }).catch(() => {
        updatePlayPauseUI(false);
      });
    } else {
      updatePlayPauseUI(false);
    }
  }

  function togglePlayPause() {
    setElHidden(startOverlay, true);
    if (audioEl.paused) {
      audioEl.playbackRate = SPEEDS[playbackSpeedIdx];
      audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }

  if (bigPlayBtn) {
    bigPlayBtn.addEventListener('click', () => {
      setElHidden(startOverlay, true);
      selectScene(currentSceneIdx, true);
    });
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', togglePlayPause);
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const wasPlaying = !audioEl.paused;
      selectScene(currentSceneIdx - 1, wasPlaying);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const wasPlaying = !audioEl.paused;
      selectScene(currentSceneIdx + 1, wasPlaying);
    });
  }

  stepTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const idx = parseInt(tab.getAttribute('data-scene-idx'), 10) || 0;
      setElHidden(startOverlay, true);
      selectScene(idx, true);
    });
  });

  audioEl.addEventListener('play', () => {
    audioEl.playbackRate = SPEEDS[playbackSpeedIdx];
    updatePlayPauseUI(true);
    updateSubtitles(currentSceneIdx, audioEl.currentTime || 0);
  });
  audioEl.addEventListener('pause', () => {
    updatePlayPauseUI(false);
    updateSubtitles(currentSceneIdx, audioEl.currentTime || 0);
  });

  audioEl.addEventListener('loadedmetadata', () => {
    audioEl.playbackRate = SPEEDS[playbackSpeedIdx];
    if (audioEl.duration && isFinite(audioEl.duration) && totTimeEl) {
      totTimeEl.textContent = formatMmSs(audioEl.duration);
    }
  });

  audioEl.addEventListener('timeupdate', () => {
    const dur =
      audioEl.duration && isFinite(audioEl.duration)
        ? audioEl.duration
        : TUTORIAL_SCENES_META[currentSceneIdx].duration;
    const cur = audioEl.currentTime || 0;
    if (curTimeEl) curTimeEl.textContent = formatMmSs(cur);
    if (seekSlider && dur > 0) {
      seekSlider.value = String(Math.min(100, (cur / dur) * 100));
    }
    updateTimeDrivenMicroAnimations(currentSceneIdx, cur);
    updateSubtitles(currentSceneIdx, cur);
  });

  audioEl.addEventListener('ended', () => {
    updateSubtitles(currentSceneIdx, -1);
    if (currentSceneIdx < TUTORIAL_SCENES_META.length - 1) {
      selectScene(currentSceneIdx + 1, true);
    } else {
      updatePlayPauseUI(false);
    }
  });

  if (seekSlider) {
    seekSlider.addEventListener('input', () => {
      const dur =
        audioEl.duration && isFinite(audioEl.duration)
          ? audioEl.duration
          : TUTORIAL_SCENES_META[currentSceneIdx].duration;
      const pct = Number(seekSlider.value) || 0;
      const targetTime = (pct / 100) * dur;
      audioEl.currentTime = targetTime;
      updateSubtitles(currentSceneIdx, targetTime);
    });
  }

  if (speedBtn) {
    speedBtn.addEventListener('click', () => {
      playbackSpeedIdx = (playbackSpeedIdx + 1) % SPEEDS.length;
      const rate = SPEEDS[playbackSpeedIdx];
      audioEl.defaultPlaybackRate = rate;
      audioEl.playbackRate = rate;
      speedBtn.textContent = `${rate}x`;
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      audioEl.muted = !audioEl.muted;
      setElHidden(iconVol, audioEl.muted);
      setElHidden(iconMuted, !audioEl.muted);
    });
  }

  function setCaptionsState(enabled) {
    captionsEnabled = Boolean(enabled);
    if (captionsBtn) {
      captionsBtn.classList.toggle('active', captionsEnabled);
      captionsBtn.setAttribute('aria-pressed', captionsEnabled ? 'true' : 'false');
      captionsBtn.title = captionsEnabled ? 'הסתר כתוביות' : 'הצג כתוביות';
    }
    updateSubtitles(currentSceneIdx, audioEl.currentTime || 0);
  }

  if (captionsBtn) {
    captionsBtn.addEventListener('click', () => {
      setCaptionsState(!captionsEnabled);
    });
  }

  if (toggleCollapseBtn && playerBody) {
    const collapsePlaySvg = toggleCollapseBtn.querySelector('svg');
    toggleCollapseBtn.addEventListener('click', () => {
      const isHidden = !playerBody.hidden;
      playerBody.hidden = isHidden;
      toggleCollapseBtn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
      toggleCollapseBtn.className = isHidden
        ? 'btn-secondary btn-sm tutorial-collapse-btn'
        : 'btn-ghost btn-sm tutorial-collapse-btn';
      setElHidden(collapsePlaySvg, !isHidden);
      if (toggleCollapseLabel) {
        toggleCollapseLabel.textContent = isHidden ? 'פתח נגן הדרכה' : 'מזער נגן';
      }
      if (isHidden) {
        audioEl.pause();
      }
    });
  }

  if (scrollToTutorialBtn) {
    scrollToTutorialBtn.addEventListener('click', () => {
      const tutSec = document.getElementById('tutorial-section');
      if (playerBody && playerBody.hidden && toggleCollapseBtn) {
        toggleCollapseBtn.click();
      }
      if (tutSec) {
        tutSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      selectScene(0, true);
    });
  }

  if (fillDemoBtn) {
    fillDemoBtn.addEventListener('click', () => {
      if (generatorWorkspace && !generatorWorkspace.hidden) {
        variableCount = 3;
        variableCountInput.value = '3';
        variableNames = ['LearnerName', 'QuizScore', 'Department'];
        updateVariableNames();
        if (!webAppUrlInput.value.trim()) {
          webAppUrlInput.value =
            'https://script.google.com/macros/s/AKfycbx9_Storyline_Sheets_2026/exec';
        }
        scheduleServerScriptGeneration();
        generatorWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showGlobalBanner(
          'משתני הדוגמה (LearnerName, QuizScore, Department) הוזנו במחולל והקוד הופק אוטומטית!',
          'success'
        );
      } else {
        authSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showGlobalBanner(
          'התחבר או הירשם (3 ימים חינם) כדי למלא את משתני הדוגמה ולהפיק את הקוד במחולל.',
          'success'
        );
      }
    });
  }

  // Initialize captions state (enabled by default)
  setCaptionsState(true);
})();


