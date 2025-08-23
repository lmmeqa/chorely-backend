const http = require('http');
const { spawn } = require('child_process');

// Start Wrangler dev server
const wrangler = spawn('npx', ['wrangler', 'dev'], {
  stdio: 'pipe',
  shell: true
});

wrangler.stdout.on('data', (data) => {
  console.log(`[Wrangler] ${data.toString()}`);
});

wrangler.stderr.on('data', (data) => {
  console.log(`[Wrangler Error] ${data.toString()}`);
});

// Create a simple proxy server
const proxy = http.createServer((req, res) => {
  const options = {
    hostname: 'localhost',
    port: 8787,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });

  req.pipe(proxyReq);
});

// Bind to all interfaces
const PORT = 8787;
proxy.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from your phone: http://YOUR_LOCAL_IP:${PORT}`);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  wrangler.kill();
  proxy.close();
  process.exit(0);
});
