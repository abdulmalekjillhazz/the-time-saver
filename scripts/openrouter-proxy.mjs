import http from 'node:http';
import https from 'node:https';

const UPSTREAM_HOST = 'openrouter.ai';
const PORT = Number(process.env.OPENROUTER_PROXY_PORT || 4096);
const HOST = process.env.OPENROUTER_PROXY_HOST || '127.0.0.1';
const API_KEY = process.env.OPENROUTER_API_KEY || '';

function upstreamPath(pathname) {
  if (pathname === '/v1' || pathname.startsWith('/v1/')) {
    return `/api${pathname}`;
  }
  return pathname;
}

const server = http.createServer((req, res) => {
  req.allowedHeaders =
    req.headers['access-control-request-headers'] ||
    'Authorization,Content-Type,HTTP-Referer,X-Title,Accept';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.allowedHeaders,
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, upstream: `https://${UPSTREAM_HOST}`, auth: API_KEY ? 'env' : 'passthrough' }));
    return;
  }

  const target = new URL(req.url, `https://${UPSTREAM_HOST}`);
  const path = upstreamPath(target.pathname);

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers.origin;
  delete headers['content-length'];
  if (!headers.authorization && API_KEY) headers.authorization = `Bearer ${API_KEY}`;
  headers.host = UPSTREAM_HOST;

  const upstream = https.request(
    { host: UPSTREAM_HOST, path: path + target.search, method: req.method, headers },
    (up) => {
      const outHeaders = { ...up.headers };
      delete outHeaders.connection;
      delete outHeaders['transfer-encoding'];
      outHeaders['access-control-allow-origin'] = '*';
      res.writeHead(up.statusCode || 502, outHeaders);
      up.pipe(res);
    }
  );

  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    }
    res.end(JSON.stringify({ error: { message: `upstream error: ${err.message}`, type: 'proxy_error' } }));
  });

  req.pipe(upstream);
});

server.listen(PORT, HOST, () => {
  console.log(`OpenRouter beta proxy listening on http://${HOST}:${PORT}`);
  console.log(`Upstream: https://${UPSTREAM_HOST}  auth: ${API_KEY ? 'OPENROUTER_API_KEY' : 'client Authorization header'}`);
});
