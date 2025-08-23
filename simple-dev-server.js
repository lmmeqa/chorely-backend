const http = require('http');
const { spawn } = require('child_process');

console.log('🚀 Starting Chorely development server...');

let wranglerPort = null;

// Start Wrangler dev server on localhost
const wrangler = spawn('npx', ['wrangler', 'dev'], {
  stdio: 'pipe',
  shell: true,
  env: { ...process.env }
});

wrangler.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Wrangler] ${output}`);
  
  // Extract the port Wrangler is actually running on
  const portMatch = output.match(/Ready on http:\/\/localhost:(\d+)/);
  if (portMatch) {
    wranglerPort = parseInt(portMatch[1]);
    console.log(`✅ Wrangler server is ready on port ${wranglerPort}!`);
  }
});

wrangler.stderr.on('data', (data) => {
  console.log(`[Wrangler Error] ${data.toString()}`);
});

// Create proxy server that binds to all interfaces
const proxy = http.createServer((req, res) => {
  if (!wranglerPort) {
    console.error('❌ Wrangler not ready yet');
    res.writeHead(503);
    res.end('Service not ready');
    return;
  }

  const options = {
    hostname: 'localhost',
    port: wranglerPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('❌ Proxy error:', err.message);
    res.writeHead(500);
    res.end('Proxy error: ' + err.message);
  });

  req.pipe(proxyReq);
});

// Bind to all interfaces
const PORT = 8787;
proxy.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Proxy server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from your phone: http://10.0.0.14:${PORT}`);
  console.log(`💻 Access from your computer: http://localhost:${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  wrangler.kill();
  proxy.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  wrangler.kill();
  proxy.close();
  process.exit(0);
});
