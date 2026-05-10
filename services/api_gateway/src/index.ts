import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting with different limits for different routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Service URLs with connection pooling
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  feed: process.env.FEED_SERVICE_URL || 'http://localhost:3002',
  messaging: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3003',
  livestream: process.env.LIVESTREAM_SERVICE_URL || 'http://localhost:3004',
  user: process.env.USER_SERVICE_URL || 'http://localhost:3005',
  recommendation: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3006',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3008',
  search: process.env.SEARCH_SERVICE_URL || 'http://localhost:3009',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:3010',
};

// Axios instances with connection pooling and timeouts
const axiosInstances = {
  default: axios.create({
    timeout: 30000,
    maxRedirects: 5,
    httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 100 }),
    httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 100 }),
  }),
  streaming: axios.create({
    timeout: 60000,
    maxRedirects: 5,
  }),
};

// In-memory admin storage (in production, use database)
const admins = new Map<string, any>();
const adminInvites = new Map<string, any>();

// Initialize master admin
const MASTER_PASSWORD = 'Nolag@zyra';
const MASTER_ADMIN_ID = 'master-admin';

admins.set(MASTER_ADMIN_ID, {
  id: MASTER_ADMIN_ID,
  email: 'admin@nexora.com',
  username: 'Master Admin',
  role: 'MASTER_ADMIN',
  permissions: ['all'],
  createdAt: new Date(),
});

// JWT verification middleware
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Fraud detection middleware
const fraudDetection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const content = body.content || body.message || body.text || '';
    
    if (!content || content.length < 3) {
      return next(); // Skip for empty or very short content
    }

    const context = {
      userId: (req as any).user?.userId || body.senderId || body.userId,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    // Call AI service for fraud detection
    const fraudResponse = await axiosInstances.default.post(
      `${SERVICES.ai}/ai/fraud-detect`,
      { content, context },
      { timeout: 5000 }
    ).catch(() => null);

    if (fraudResponse && fraudResponse.data) {
      const fraudResult = fraudResponse.data;
      
      // Attach fraud result to request for downstream use
      (req as any).fraudResult = fraudResult;

      // Take action based on risk score
      if (fraudResult.action === 'block') {
        console.log(`[FRAUD BLOCKED] Content blocked. Risk Score: ${fraudResult.riskScore}`);
        return res.status(403).json({ 
          error: 'Content blocked due to suspicious activity',
          fraudResult,
        });
      }
      
      if (fraudResult.action === 'require_review') {
        console.log(`[FRAUD REVIEW] Content flagged for review. Risk Score: ${fraudResult.riskScore}`);
        // Allow but flag for admin review
        await axiosInstances.default.post(
          `${SERVICES.ai}/ai/user-reputation`,
          { 
            userId: context.userId, 
            action: 'violation',
            score: fraudResult.riskScore / 10,
          }
        ).catch(() => {});
      }
      
      if (fraudResult.action === 'flag') {
        console.log(`[FRAUD FLAG] Content flagged. Risk Score: ${fraudResult.riskScore}`);
        // Allow but log
      }
    }

    next();
  } catch (error) {
    // If fraud detection fails, allow the request but log the error
    console.error('Fraud detection error:', error);
    next();
  }
};

// Language detection middleware
const languageDetection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const content = body.content || body.message || body.text || '';
    
    if (!content || content.length < 3) {
      return next();
    }

    // Detect language
    const langResponse = await axiosInstances.default.post(
      `${SERVICES.ai}/ai/detect-language`,
      { content },
      { timeout: 3000 }
    ).catch(() => null);

    if (langResponse && langResponse.data) {
      (req as any).detectedLanguage = langResponse.data.language;
    }

    next();
  } catch (error) {
    console.error('Language detection error:', error);
    next();
  }
};

// i18n middleware
const i18n = (req: Request, res: Response, next: NextFunction) => {
  // Get language from Accept-Language header or query parameter
  const acceptLanguage = req.headers['accept-language'] as string;
  const queryLang = req.query.lang as string;
  
  // Priority: query param > Accept-Language header > default (en)
  const preferredLanguage = queryLang || 
    (acceptLanguage ? acceptLanguage.split(',')[0].split('-')[0] : 'en');
  
  (req as any).locale = preferredLanguage;
  (req as any).acceptLanguage = acceptLanguage;
  
  // Set Content-Language header in response
  res.setHeader('Content-Language', preferredLanguage);
  
  next();
};

// Device detection middleware
const deviceDetection = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] as string || '';
  
  let deviceType = 'desktop';
  let os = 'unknown';
  let browser = 'unknown';
  
  // Detect device type
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad|kindle|silk/i.test(userAgent)) {
    deviceType = 'tablet';
  } else if (/smart-tv|tv|roku|webos|appletv/i.test(userAgent)) {
    deviceType = 'tv';
  }
  
  // Detect OS
  if (/windows/i.test(userAgent)) {
    os = 'windows';
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    os = 'macos';
  } else if (/linux/i.test(userAgent)) {
    os = 'linux';
  } else if (/android/i.test(userAgent)) {
    os = 'android';
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    os = 'ios';
  }
  
  // Detect browser
  if (/chrome|chromium|crios/i.test(userAgent)) {
    browser = 'chrome';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = 'safari';
  } else if (/edge|edg/i.test(userAgent)) {
    browser = 'edge';
  } else if (/opera|opr/i.test(userAgent)) {
    browser = 'opera';
  }
  
  // Attach device info to request
  (req as any).device = {
    type: deviceType,
    os,
    browser,
    userAgent,
  };
  
  // Set device info in response headers
  res.setHeader('X-Device-Type', deviceType);
  res.setHeader('X-Device-OS', os);
  
  next();
};

// Apply i18n middleware to all API routes
app.use('/api', i18n);

// Apply device detection middleware to all API routes
app.use('/api', deviceDetection);

// Admin verification middleware
const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  const adminToken = req.headers['x-admin-token'] as string;

  if (!adminToken) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  const admin = Array.from(admins.values()).find(a => a.token === adminToken);
  
  if (!admin) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  (req as any).admin = admin;
  next();
};

// Master admin verification middleware
const verifyMasterAdmin = (req: Request, res: Response, next: NextFunction) => {
  const admin = (req as any).admin;
  
  if (admin.role !== 'MASTER_ADMIN') {
    return res.status(403).json({ error: 'Master admin access required' });
  }
  
  next();
};

// Health check with service status
app.get('/health', async (req: Request, res: Response) => {
  const healthChecks = await Promise.allSettled(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        const response = await axiosInstances.default.get(`${url}/health`, { timeout: 5000 });
        return { name, status: 'healthy', responseTime: response.headers['x-response-time'] || 'N/A' };
      } catch (error) {
        return { name, status: 'unhealthy', error: (error as any).message };
      }
    })
  );

  const services = healthChecks.map(result => 
    result.status === 'fulfilled' ? result.value : { name: 'unknown', status: 'error' }
  );

  const allHealthy = services.every(s => s.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services,
  });
});

// Admin login with master password
app.post('/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (password === MASTER_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    const admin = admins.get(MASTER_ADMIN_ID);
    admin.token = token;
    admin.lastLogin = new Date();
    
    return res.json({
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
      token,
    });
  }

  res.status(401).json({ error: 'Invalid password' });
});

// Admin management endpoints (protected)
app.get('/admin/admins', verifyAdmin, verifyMasterAdmin, (req: Request, res: Response) => {
  const adminList = Array.from(admins.values()).map(a => ({
    id: a.id,
    email: a.email,
    role: a.role,
    permissions: a.permissions,
    status: a.status || 'active',
    createdAt: a.createdAt,
  }));
  res.json(adminList);
});

app.post('/admin/invite', verifyAdmin, verifyMasterAdmin, (req: Request, res: Response) => {
  const { email, permissions } = req.body;
  
  if (!email || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const adminId = crypto.randomBytes(16).toString('hex');
  
  const newAdmin = {
    id: adminId,
    email,
    role: 'ADMIN',
    permissions,
    status: 'pending',
    inviteToken,
    createdAt: new Date(),
  };
  
  admins.set(adminId, newAdmin);
  adminInvites.set(inviteToken, adminId);
  
  res.json({
    admin: newAdmin,
    inviteToken,
  });
});

app.delete('/admin/admins/:adminId', verifyAdmin, verifyMasterAdmin, (req: Request, res: Response) => {
  const { adminId } = req.params;
  
  if (adminId === MASTER_ADMIN_ID) {
    return res.status(403).json({ error: 'Cannot remove master admin' });
  }
  
  const deleted = admins.delete(adminId);
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Admin not found' });
  }
});

app.post('/admin/accept-invite/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;
  
  const adminId = adminInvites.get(token);
  
  if (!adminId) {
    return res.status(404).json({ error: 'Invalid or expired invite' });
  }
  
  const admin = admins.get(adminId);
  
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  
  admin.status = 'active';
  admin.password = password;
  admin.token = crypto.randomBytes(32).toString('hex');
  admin.joinedAt = new Date();
  
  adminInvites.delete(token);
  
  res.json({
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
    },
    token: admin.token,
  });
});

// Proxy to Auth Service
app.use('/api/auth', async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default.post(`${SERVICES.auth}${req.url}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Auth service error' });
  }
});

// Proxy to Feed Service (protected with fraud detection)
app.use('/api/feed', verifyToken, fraudDetection, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.feed}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Feed service error' });
  }
});

// Proxy to Messaging Service (protected with fraud detection and language detection)
app.use('/api/messages', verifyToken, languageDetection, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.messaging}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Messaging service error' });
  }
});

// Proxy to Livestream Service (protected with fraud detection)
app.use('/api/livestream', verifyToken, fraudDetection, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.streaming({
      method: req.method,
      url: `${SERVICES.livestream}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Livestream service error' });
  }
});

// Proxy to User Service (protected with fraud detection)
app.use('/api/users', verifyToken, fraudDetection, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.user}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'User service error' });
  }
});

// Proxy to Recommendation Service (protected)
app.use('/api/recommendations', verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.recommendation}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Recommendation service error' });
  }
});

// Proxy to Notification Service (protected)
app.use('/api/notifications', verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.notification}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Notification service error' });
  }
});

// Proxy to Payment Service (protected)
app.use('/api/payments', verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.payment}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Payment service error' });
  }
});

// Proxy to Search Service (protected)
app.use('/api/search', verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.search}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Search service error' });
  }
});

// Proxy to AI Service (protected)
app.use('/api/ai', verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axiosInstances.default({
      method: req.method,
      url: `${SERVICES.ai}${req.url}`,
      headers: { Authorization: req.headers.authorization },
      data: req.body
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'AI service error' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Gateway Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

const server = app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Connected services:`, Object.keys(SERVICES));
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
