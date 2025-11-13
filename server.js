require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - Disable CSP for external connections
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://chavis.com.tr'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'Z9NGhaAHo24u199lNBQSS7BQfATSTR456pd5lS4lJO4',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: parseInt(process.env.SESSION_TTL_MS) || 3600000
  }
}));

app.set('trust proxy', 1);

// View count storage file
const VIEW_COUNT_FILE = path.join(__dirname, 'viewcount.json');

// Load view count from file
let viewCount = 654;
try {
  if (fs.existsSync(VIEW_COUNT_FILE)) {
    const data = fs.readFileSync(VIEW_COUNT_FILE, 'utf8');
    const parsed = JSON.parse(data);
    viewCount = parsed.count || 654;
    console.log(`Loaded view count from file: ${viewCount}`);
  }
} catch (error) {
  console.error('Error loading view count:', error);
}

// Save view count to file
function saveViewCount() {
  try {
    fs.writeFileSync(VIEW_COUNT_FILE, JSON.stringify({ count: viewCount }, null, 2));
  } catch (error) {
    console.error('Error saving view count:', error);
  }
}

// Discord status cache
let discordStatusCache = {
  data: null,
  lastUpdate: 0,
  cacheTime: 30000 // 30 seconds cache
};

// SSE clients for real-time updates
const sseClients = new Set();

// Discord WebSocket connection manager
class DiscordStatusManager {
  constructor(userId) {
    this.userId = userId;
    this.ws = null;
    this.heartbeatInterval = null;
    this.status = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket('wss://api.lanyard.rest/socket');
      
      this.ws.on('open', () => {
        console.log('Connected to Discord Lanyard WebSocket');
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data) => {
        const json = JSON.parse(data.toString());
        this.handleMessage(json);
      });

      this.ws.on('close', () => {
        console.log('Discord WebSocket closed');
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('Discord WebSocket error:', error.message);
      });
    } catch (error) {
      console.error('Failed to connect to Discord WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  handleMessage(data) {
    switch (data.op) {
      case 1: // Hello
        this.startHeartbeat(data.d.heartbeat_interval);
        this.subscribe();
        break;
      case 0: // Event
        if (data.t === 'INIT_STATE' || data.t === 'PRESENCE_UPDATE') {
          this.status = data.d;
          discordStatusCache.data = data.d;
          discordStatusCache.lastUpdate = Date.now();
          console.log(`Discord status updated: ${data.d.discord_status}`);
          
          // Broadcast to all SSE clients
          this.broadcastToClients(data.d);
        }
        break;
    }
  }

  startHeartbeat(interval) {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 3 }));
      }
    }, interval);
  }

  subscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        op: 2,
        d: { subscribe_to_id: this.userId }
      }));
      console.log(`Subscribed to Discord user: ${this.userId}`);
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  getStatus() {
    return this.status;
  }

  broadcastToClients(data) {
    const message = JSON.stringify({
      success: true,
      data: {
        discord_status: data.discord_status,
        discord_user: {
          username: data.discord_user.username,
          global_name: data.discord_user.global_name,
          avatar: data.discord_user.avatar,
          id: data.discord_user.id
        },
        activities: data.activities || []
      }
    });

    sseClients.forEach(client => {
      try {
        client.write(`data: ${message}\n\n`);
      } catch (error) {
        console.error('Error broadcasting to SSE client:', error);
        sseClients.delete(client);
      }
    });
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.ws) this.ws.close();
  }
}

// Initialize Discord status manager
const discordManager = new DiscordStatusManager('750800056453693472');

// Initialize Discord bot
let discordBot = null;
try {
  discordBot = require('./bot');
} catch (error) {
  console.error('Failed to load Discord bot:', error.message);
}

// Config file paths
const WHITELIST_FILE = path.join(__dirname, 'config', 'whitelist.json');
const SOCIAL_LINKS_FILE = path.join(__dirname, 'config', 'social-links.json');

// Load whitelist
function loadWhitelist() {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const data = fs.readFileSync(WHITELIST_FILE, 'utf8');
      return JSON.parse(data);
    }
    return { ips: ['127.0.0.1'] };
  } catch (error) {
    console.error('Error loading whitelist:', error);
    return { ips: ['127.0.0.1'] };
  }
}

// Save whitelist
function saveWhitelist(data) {
  try {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving whitelist:', error);
    return false;
  }
}

// Load social links
function loadSocialLinks() {
  try {
    if (fs.existsSync(SOCIAL_LINKS_FILE)) {
      const data = fs.readFileSync(SOCIAL_LINKS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return { links: [] };
  } catch (error) {
    console.error('Error loading social links:', error);
    return { links: [] };
  }
}

// Save social links
function saveSocialLinks(data) {
  try {
    fs.writeFileSync(SOCIAL_LINKS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving social links:', error);
    return false;
  }
}

// Get client IP
function getClientIP(req) {
  let ip = req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           'unknown';
  
  // Convert IPv6 localhost to IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '::ffff:0:127.0.0.1') {
    ip = '127.0.0.1';
  }
  
  // Remove IPv6 prefix if present
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  
  return ip;
}

// Log function
function logAdminAction(action, ip, details = '') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${action} - IP: ${ip}${details ? ` - ${details}` : ''}`;
  console.log(logMessage);
  
  if (discordBot && discordBot.client && discordBot.client.isReady()) {
    const logChannelId = '1438549220310388847';
    const channel = discordBot.client.channels.cache.get(logChannelId);
    if (channel) {
      channel.send(`\`[${timestamp}]\` **${action}**\nIP: \`${ip}\`${details ? `\n${details}` : ''}`).catch(console.error);
    }
  }
}

// IP Whitelist middleware
function checkIPWhitelist(req, res, next) {
  const clientIP = getClientIP(req);
  const whitelist = loadWhitelist();
  
  if (!whitelist.ips.includes(clientIP)) {
    logAdminAction('ADMIN_ACCESS_DENIED', clientIP, 'IP not in whitelist');
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Erişim Reddedildi</title>
        <style>
          body {
            font-family: ui-sans-serif, system-ui, sans-serif;
            background: oklch(17.22% .0041 75);
            color: oklch(94.7% .0414 75);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { color: oklch(70.4% .191 22); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>403 Forbidden</h1>
          <p>Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </body>
      </html>
    `);
  }
  
  next();
}

// Admin authentication middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting (simple implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

function simpleRateLimit(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const clientData = rateLimitMap.get(clientIP);
  
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  clientData.count++;
  next();
}

// API Routes
app.get('/api/views', (req, res) => {
  res.json({ views: viewCount });
});

app.post('/api/views/increment', simpleRateLimit, (req, res) => {
  try {
    viewCount += 1;
    saveViewCount();
    res.json({ 
      views: viewCount,
      message: 'View count incremented successfully'
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to increment view count'
    });
  }
});

app.put('/api/views', simpleRateLimit, (req, res) => {
  try {
    const { views } = req.body;
    
    if (typeof views !== 'number' || views < 0) {
      return res.status(400).json({ 
        error: 'Invalid view count',
        message: 'View count must be a non-negative number'
      });
    }
    
    viewCount = views;
    saveViewCount();
    res.json({ 
      views: viewCount,
      message: 'View count updated successfully'
    });
  } catch (error) {
    console.error('Error updating view count:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to update view count'
    });
  }
});

// SSE endpoint for real-time Discord status updates
app.get('/api/discord/status/stream', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Add client to the set
  sseClients.add(res);
  console.log(`SSE client connected. Total clients: ${sseClients.size}`);

  // Send initial status if available
  const status = discordManager.getStatus();
  if (status) {
    const message = JSON.stringify({
      success: true,
      data: {
        discord_status: status.discord_status,
        discord_user: {
          username: status.discord_user.username,
          global_name: status.discord_user.global_name,
          avatar: status.discord_user.avatar,
          id: status.discord_user.id
        },
        activities: status.activities || []
      }
    });
    res.write(`data: ${message}\n\n`);
  }

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`SSE client disconnected. Total clients: ${sseClients.size}`);
  });
});

// Discord status endpoint (for compatibility)
app.get('/api/discord/status', (req, res) => {
  try {
    const status = discordManager.getStatus();
    
    if (status) {
      res.json({ 
        success: true,
        data: {
          discord_status: status.discord_status,
          discord_user: {
            username: status.discord_user.username,
            global_name: status.discord_user.global_name,
            avatar: status.discord_user.avatar,
            id: status.discord_user.id
          },
          activities: status.activities || []
        }
      });
    } else {
      res.status(503).json({ 
        success: false,
        error: 'Discord status not available yet',
        message: 'Please try again in a few seconds'
      });
    }
  } catch (error) {
    console.error('Error fetching Discord status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch Discord status'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    views: viewCount,
    discordConnected: discordManager.ws && discordManager.ws.readyState === WebSocket.OPEN
  });
});

// Multer configuration for file uploads - use memory storage first, then move to correct location
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Admin routes
app.get('/987654321admin123456789', checkIPWhitelist, (req, res) => {
  const clientIP = getClientIP(req);
  logAdminAction('ADMIN_PAGE_ACCESS', clientIP, 'Whitelisted IP');
  
  if (req.session && req.session.isAdmin) {
    return res.sendFile(path.join(__dirname, 'admin', 'panel.html'));
  }
  
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.post('/987654321admin123456789/login', checkIPWhitelist, loginLimiter, (req, res) => {
  const clientIP = getClientIP(req);
  const { username, password } = req.body;
  
  const ADMIN_USERNAME = '0101377';
  const ADMIN_PASSWORD = '71x5W)6GcIpc.';
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    logAdminAction('ADMIN_LOGIN_SUCCESS', clientIP, 'Whitelisted IP');
    return res.json({ success: true, message: 'Login successful' });
  } else {
    logAdminAction('ADMIN_LOGIN_FAILED', clientIP, `Whitelisted IP - Invalid credentials`);
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/987654321admin123456789/logout', requireAdmin, (req, res) => {
  const clientIP = getClientIP(req);
  logAdminAction('ADMIN_LOGOUT', clientIP);
  req.session.destroy();
  res.json({ success: true });
});

app.get('/987654321admin123456789/api/status', checkIPWhitelist, requireAdmin, (req, res) => {
  const whitelist = loadWhitelist();
  res.json({ 
    isAdmin: true,
    whitelisted: whitelist.ips.includes(getClientIP(req))
  });
});

// File upload endpoint
app.post('/987654321admin123456789/api/upload', checkIPWhitelist, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileType = req.body?.fileType;
  const fileName = req.body?.fileName || req.file.originalname;
  const fileExt = path.extname(fileName).toLowerCase();
  
  // Validate file type
  if (!fileType) {
    return res.status(400).json({ error: 'fileType is required' });
  }
  
  if (fileType === 'media' && fileExt !== '.mp3') {
    return res.status(400).json({ error: 'Only .mp3 files allowed for media' });
  }
  
  if (fileType === 'images' && !['.png', '.gif', '.mp4'].includes(fileExt)) {
    return res.status(400).json({ error: 'Only .png, .gif, or .mp4 files allowed for images' });
  }
  
  // Determine destination directory
  let destDir;
  if (fileType === 'media') {
    destDir = path.join(__dirname, 'media');
  } else if (fileType === 'images') {
    destDir = path.join(__dirname, 'images');
  } else {
    return res.status(400).json({ error: 'Invalid fileType. Must be "media" or "images"' });
  }
  
  // Ensure directory exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Save file to correct location
  const filePath = path.join(destDir, fileName);
  fs.writeFileSync(filePath, req.file.buffer);
  
  const clientIP = getClientIP(req);
  logAdminAction('FILE_UPLOAD', clientIP, `File: ${fileName}`);
  
  res.json({ 
    success: true, 
    message: 'File uploaded successfully',
    fileName: fileName
  });
});

// Social links API
app.get('/987654321admin123456789/api/social-links', checkIPWhitelist, requireAdmin, (req, res) => {
  const data = loadSocialLinks();
  res.json(data);
});

app.post('/987654321admin123456789/api/social-links', checkIPWhitelist, requireAdmin, (req, res) => {
  const { links } = req.body;
  if (!Array.isArray(links)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  const data = { links };
  if (saveSocialLinks(data)) {
    const clientIP = getClientIP(req);
    logAdminAction('SOCIAL_LINKS_UPDATE', clientIP);
    res.json({ success: true, data });
  } else {
    res.status(500).json({ error: 'Failed to save social links' });
  }
});

app.post('/987654321admin123456789/api/social-links/icon', checkIPWhitelist, requireAdmin, upload.single('icon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileName = req.body?.fileName || req.file.originalname;
  const fileExt = path.extname(fileName).toLowerCase();
  
  // Validate file type (only PNG for icons)
  if (fileExt !== '.png') {
    return res.status(400).json({ error: 'Only .png files allowed for icons' });
  }
  
  // Ensure images directory exists
  const destDir = path.join(__dirname, 'images');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Save file
  const filePath = path.join(destDir, fileName);
  fs.writeFileSync(filePath, req.file.buffer);
  
  const clientIP = getClientIP(req);
  logAdminAction('SOCIAL_ICON_UPLOAD', clientIP, `File: ${fileName}`);
  
  res.json({ 
    success: true, 
    iconPath: `/images/${fileName}`
  });
});

// Whitelist API
app.get('/987654321admin123456789/api/whitelist', checkIPWhitelist, requireAdmin, (req, res) => {
  const data = loadWhitelist();
  res.json(data);
});

// Public API for social links (for frontend)
app.get('/api/social-links', (req, res) => {
  const data = loadSocialLinks();
  const enabledLinks = data.links
    .filter(link => link.enabled)
    .sort((a, b) => a.order - b.order);
  res.json({ links: enabledLinks });
});

// Serve static files (if you want to serve your frontend from the same server)
app.use(express.static(path.join(__dirname)));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
    }
  }
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler (must be last)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Not found',
      message: 'The requested resource was not found'
    });
  }
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Current view count: ${viewCount}`);
  console.log(`🔗 API endpoints:`);
  console.log(`   GET  /api/views - Get current view count`);
  console.log(`   POST /api/views/increment - Increment view count`);
  console.log(`   PUT  /api/views - Update view count`);
  console.log(`   GET  /api/health - Health check`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  discordManager.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  discordManager.destroy();
  process.exit(0);
});
