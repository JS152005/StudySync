import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

export interface AuthenticatedUser {
  id: string;
  student_id: string;
  email: string;
  username: string;
  full_name: string;
  course?: string;
  college?: string;
  academic_year?: string;
  bio?: string;
  avatar_url?: string;
  is_verified: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    let token = '';

    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    if (!decoded || !decoded.userId) {
      res.status(401).json({ error: 'Invalid or expired session token.' });
      return;
    }

    const stmt = db.prepare(`
      SELECT id, student_id, email, username, full_name, course, college, academic_year, bio, avatar_url, is_verified, is_active
      FROM users WHERE id = ?
    `);
    const user = stmt.get(decoded.userId) as (AuthenticatedUser & { is_active: number }) | undefined;

    if (!user || user.is_active === 0) {
      res.status(401).json({ error: 'User account is deactivated or not found.' });
      return;
    }

    if (user.is_verified !== 1) {
      res.status(403).json({ error: 'Please verify your email address before accessing StudySync.', unverified: true });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      if (decoded && decoded.userId) {
        const user = db.prepare(`
          SELECT id, student_id, email, username, full_name, course, college, academic_year, bio, avatar_url, is_verified
          FROM users WHERE id = ? AND is_active = 1
        `).get(decoded.userId) as AuthenticatedUser | undefined;

        if (user && user.is_verified === 1) {
          req.user = user;
        }
      }
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next();
}
