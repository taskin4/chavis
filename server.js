const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const WebSocket = require('ws');

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

// In-memory storage for view count (in production, use a database)
let viewCount = 654; // Starting with your current count

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
    console.log(`Broadcasting to ${sseClients.size} SSE clients`);
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

    console.log('Broadcasting message:', message);

    sseClients.forEach(client => {
      try {
        client.write(`data: ${message}\n\n`);
        console.log('Message sent to SSE client');
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

// Rate limiting (simple implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

function rateLimit(req, res, next) {
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

app.post('/api/views/increment', rateLimit, (req, res) => {
  try {
    viewCount += 1;
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

app.put('/api/views', rateLimit, (req, res) => {
  try {
    const { views } = req.body;
    
    if (typeof views !== 'number' || views < 0) {
      return res.status(400).json({ 
        error: 'Invalid view count',
        message: 'View count must be a non-negative number'
      });
    }
    
    viewCount = views;
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

// Serve static files (if you want to serve your frontend from the same server)
app.use(express.static(path.join(__dirname)));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested resource was not found'
  });
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
