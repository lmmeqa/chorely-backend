const http = require('http');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

console.log('🚀 Starting Chorely network development server...');

// Start Wrangler dev server on localhost
const wrangler = spawn('npx', ['wrangler', 'dev'], {
  stdio: 'pipe',
  shell: true,
  env: { ...process.env }
});

wrangler.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Wrangler] ${output}`);
  
  // Check if Wrangler is ready
  if (output.includes('Ready on http://localhost:8787')) {
    console.log('✅ Wrangler server is ready!');
  }
});

wrangler.stderr.on('data', (data) => {
  console.log(`[Wrangler Error] ${data.toString()}`);
});

// Create proxy server that binds to all interfaces
const proxy = http.createServer((req, res) => {
  console.log(`📨 ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
  
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
    console.error('❌ Proxy error:', err.message);
    res.writeHead(500);
    res.end('Proxy error: ' + err.message);
  });

  req.pipe(proxyReq);
});

// Try different ports if 8787 doesn't work
const tryPort = (port) => {
  proxy.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Proxy server running on http://0.0.0.0:${port}`);
    console.log(`📱 Access from your phone: http://10.0.0.14:${port}`);
    console.log(`💻 Access from your computer: http://localhost:${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
      tryPort(port + 1);
    } else {
      console.error('❌ Failed to start server:', err.message);
    }
  });
};

// Start with port 8787
tryPort(8787);

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
