import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';

import { config } from './config/index.js';
import { initDatabase } from './db/index.js';
import { setupSocketHandlers } from './socket/index.js';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import groupsRouter from './routes/groups.js';
import messagesRouter from './routes/messages.js';
import roomsRouter from './routes/rooms.js';

// 1. Initialize SQLite Database
initDatabase();

// 2. Initialize Express and HTTP Server
const app = express();
const server = http.createServer(app);

// 3. Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

setupSocketHandlers(io);
app.set('io', io);

// 4. Security & Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible WebRTC media and inline styles for strict palette
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Stricter limiter for sensitive auth operations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// 5. Mount Core API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/rooms', roomsRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'StudySync API', timestamp: new Date().toISOString() });
});

// 6. Serve Frontend in Production or SPA Fallback
const clientDistPath = path.resolve(process.cwd(), 'client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('StudySync Client build not found. Please build the client first.');
    }
  });
});

// 7. Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred on the server.',
  });
});

// 8. Start HTTP Server
if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(`🚀 StudySync Server is running on port ${config.port}`);
    console.log(`🌐 Base URL: ${config.appBaseUrl}`);
    console.log(`🎨 Strict Palette: White, Alice Blue, Lavender`);
    console.log(`=========================================`);
  });
}

export { app, server };
