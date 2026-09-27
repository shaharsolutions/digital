const {
  verifyFirebaseIdToken,
  getOrCreateUser,
  evaluateAccessState
} = require('./_lib/firebaseAdmin');

/**
 * Sanitizes Storyline variable names while preserving exact case sensitivity.
 */
function sanitizeVariableName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/[^\w$]/g, '');
}

function buildAppScriptCode(cleanNames) {
  if (!cleanNames.length) return '';
  const paramLines = cleanNames
    .map((name) => `var ${name} = e.parameter.${name};`)
    .join('\n  ');

  return `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  ${paramLines}

  sheet.appendRow([${cleanNames.join(', ')}]);
  return ContentService.createTextOutput("Success");
}`;
}

function buildStorylineCode(cleanNames, webAppUrl) {
  if (!webAppUrl || !cleanNames.length) return '';
  const safeUrl = String(webAppUrl).trim().replace(/"/g, '\\"');

  const inputBlocks = cleanNames
    .map(
      (name) => `var input_${name} = document.createElement("input");
input_${name}.type = "hidden";
input_${name}.name = "${name}";
input_${name}.value = player.GetVar("${name}");
form.appendChild(input_${name});`
    )
    .join('\n');

  return `var player = GetPlayer();

var form = document.createElement("form");
form.method = "POST";
form.action = "${safeUrl}";
form.style.display = "none";

${inputBlocks}

document.body.appendChild(form);

var xhr = new XMLHttpRequest();
xhr.open(form.method, form.action, true);
xhr.onload = function() {
  if (xhr.status >= 200 && xhr.status < 300) {
    var notificationElement = document.getElementById('storyline-notification');
    if (notificationElement) {
      notificationElement.innerHTML = 'הנתונים הועברו בהצלחה!';
      notificationElement.style.display = 'block';
    }
    console.log('Data submitted successfully');
  }
};
xhr.send(new FormData(form));`;
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
    const access = evaluateAccessState(userDoc);

    if (!access.hasAccess) {
      return res.status(402).json({
        error: 'SUBSCRIPTION_REQUIRED',
        subscriptionStatus: access.effectiveStatus,
        message: 'תקופת הניסיון הסתיימה. כדי להמשיך להפיק קוד יש לרכוש מנוי חודשי (39 ₪ לחודש).'
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const rawNames = Array.isArray(body.variableNames) ? body.variableNames.slice(0, 50) : [];
    const cleanNames = rawNames.map(sanitizeVariableName).filter(Boolean);
    const webAppUrl = typeof body.webAppUrl === 'string' ? body.webAppUrl.trim() : '';

    const appScriptCode = buildAppScriptCode(cleanNames);
    const storylineCode = buildStorylineCode(cleanNames, webAppUrl);

    return res.status(200).json({
      appScriptCode,
      storylineCode,
      subscriptionStatus: access.effectiveStatus,
      trialRemainingMs: access.trialRemainingMs
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Internal Server Error'
    });
  }
};
