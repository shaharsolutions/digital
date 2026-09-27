const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT_DIR = __dirname;

function loadEnvFile(filename) {
  const filePath = path.join(ROOT_DIR, filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const PORT = process.env.PORT || 3080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const apiRoutes = {
  '/api/subscription': require('./api/subscription'),
  '/api/generate-scripts': require('./api/generate-scripts'),
  '/api/billing/create-checkout': require('./api/billing/create-checkout'),
  '/api/billing/cancel': require('./api/billing/cancel'),
  '/api/webhooks/tranzila': require('./api/webhooks/tranzila'),
  '/api/admin/users': require('./api/admin/users')
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

  // Handle /api/* serverless routes
  if (apiRoutes[pathname]) {
    try {
      const rawBody = await readRequestBody(req);
      let parsedBody = rawBody;
      if (rawBody && (req.headers['content-type'] || '').includes('application/json')) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (_) {}
      }

      req.query = parsedUrl.query || {};
      req.body = parsedBody;

      res.status = function (code) {
        res.statusCode = code;
        return res;
      };
      res.json = function (obj) {
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(obj));
        return res;
      };
      res.send = function (body) {
        res.end(body);
        return res;
      };

      await apiRoutes[pathname](req, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
    return;
  }

  // Redirect /storyline-googlesheets-script-generator (without trailing slash) to include trailing slash
  if (parsedUrl.pathname === '/storyline-googlesheets-script-generator') {
    res.writeHead(302, { Location: '/storyline-googlesheets-script-generator/' });
    res.end();
    return;
  }

  // Serve static files
  let relPath = decodeURIComponent(parsedUrl.pathname);
  if (relPath.endsWith('/')) {
    relPath += 'index.html';
  }

  const filePath = path.join(ROOT_DIR, relPath);
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/storyline-googlesheets-script-generator/`);
});
