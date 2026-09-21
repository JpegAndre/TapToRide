const { env } = require('process');

const target = env.ASPNETCORE_HTTPS_PORT ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
  env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'https://localhost:7116';

// A stopped server is routine for this app, but the terminal polls /api/health
// every few seconds, so the dev server would print an ECONNREFUSED stack trace
// several times a minute. Answer the client with a clean 503 instead and log a
// single line per state change.
const OFFLINE_CODES = ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'ETIMEDOUT'];

let offline = false;

function handleProxyError(err, req, res) {
  if (!OFFLINE_CODES.includes(err.code)) {
    console.error(`[proxy] ${req && req.url} failed: ${err.message}`);
    return;
  }

  if (!offline) {
    offline = true;
    console.log(`[proxy] ${target} is offline — fares queue locally, still polling`);
  }

  // res is a socket for websocket upgrades, which has no writeHead.
  if (res && typeof res.writeHead === 'function' && !res.headersSent && !res.writableEnded) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'offline' }));
  }
}

const PROXY_CONFIG = [
  {
    context: [
      "/api",
    ],
    target,
    secure: false,
    configure: (proxy) => {
      proxy.on('proxyRes', () => {
        if (offline) {
          offline = false;
          console.log(`[proxy] ${target} is back online`);
        }
      });

      
      setTimeout(() => {
        proxy.removeAllListeners('error');
        proxy.on('error', handleProxyError);
      }, 0);
    }
  }
]

module.exports = PROXY_CONFIG;
