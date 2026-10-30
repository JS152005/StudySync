import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, generateStudentId } from '../db/index.js';
import { config } from '../config/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  sendEmail,
  createVerificationEmail,
  createPasswordResetEmail,
  createPasswordChangedEmail,
} from '../services/mailer.js';

const router = Router();

// Helper: generate JWT
function generateSessionToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
}

// Helper: set auth cookie
function setAuthCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// 1. REGISTER
router.post('/register', async (req, res): Promise<void> => {
  try {
    const {
      full_name,
      email,
      username,
      password,
      confirm_password,
      course,
      college,
      academic_year,
      terms_accepted,
    } = req.body;

    // Validation
    if (!terms_accepted) {
      res.status(400).json({ error: 'You must accept the terms of service and privacy policy.' });
      return;
    }

    if (!full_name || !email || !username || !password) {
      res.status(400).json({ error: 'Full name, email, username, and password are required.' });
      return;
    }

    if (password !== confirm_password) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    // Check unique constraints
    const existing = db.prepare(`
      SELECT id, email, username FROM users WHERE email = ? OR username = ?
    `).get(normalizedEmail, normalizedUsername) as { id: string; email: string; username: string } | undefined;

    if (existing) {
      if (existing.email === normalizedEmail) {
        res.status(400).json({ error: 'An account with this email address already exists.' });
        return;
      }
      res.status(400).json({ error: 'This username or Student ID is already taken.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Generate unique student ID
    let studentId = generateStudentId();
    let existingStudent = db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId);
    while (existingStudent) {
      studentId = generateStudentId();
      existingStudent = db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId);
    }

    const insertUser = db.prepare(`
      INSERT INTO users (
        id, student_id, email, username, full_name, password_hash,
        course, college, academic_year, is_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    insertUser.run(
      userId,
      studentId,
      normalizedEmail,
      normalizedUsername,
      full_name.trim(),
      password_hash,
      course?.trim() || '',
      college?.trim() || '',
      academic_year?.trim() || '',
      now,
      now
    );

    // Create verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, tokenHash, expiresAt, now);

    // Send verification email asynchronously
    sendEmail(createVerificationEmail(normalizedEmail, full_name.trim(), rawToken)).catch((err) =>
      console.error('[AUTH] Failed to send verification email:', err)
    );

    // Mandatory email verification: do NOT set session cookie or return token!
    res.status(201).json({
      message: 'Account registered successfully. Please verify your email before logging in.',
      unverified: true,
      email: normalizedEmail,
      user: {
        id: userId,
        student_id: studentId,
        email: normalizedEmail,
        username: normalizedUsername,
        full_name: full_name.trim(),
        course: course?.trim() || '',
        college: college?.trim() || '',
        academic_year: academic_year?.trim() || '',
        is_verified: 0,
      },
    });
  } catch (err: any) {
    console.error('[AUTH REGISTER ERROR]', err);
    res.status(500).json({ error: 'Internal server error while creating account.' });
  }
});

// 2. LOGIN
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Email, Username or Student ID and password are required.' });
      return;
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = db.prepare(`
      SELECT * FROM users
      WHERE (LOWER(email) = ? OR LOWER(username) = ? OR LOWER(student_id) = ?) AND is_active = 1
    `).get(cleanId, cleanId, cleanId) as any;

    if (!user) {
      res.status(401).json({ error: 'Invalid email, username, student ID or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email, username, student ID or password.' });
      return;
    }

    // Enforce email verification
    if (user.is_verified !== 1) {
      res.status(403).json({
        error: 'Please verify your email address before logging in.',
        unverified: true,
        email: user.email,
      });
      return;
    }

    const token = generateSessionToken(user.id);
    setAuthCookie(res, token);

    res.json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        student_id: user.student_id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        course: user.course,
        college: user.college,
        academic_year: user.academic_year,
        bio: user.bio,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
      },
    });
  } catch (err: any) {
    console.error('[AUTH LOGIN ERROR]', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 3. LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

// 4. GET CURRENT USER
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// 5. FORGOT PASSWORD
router.post('/forgot-password', async (req, res): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare(`SELECT id, full_name, email FROM users WHERE email = ? AND is_active = 1`).get(normalizedEmail) as { id: string; full_name: string; email: string } | undefined;

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
      const now = new Date().toISOString();

      // Invalidate existing unused tokens for this user
      db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).run(now, user.id);

      db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, now);

      await sendEmail(createPasswordResetEmail(user.email, user.full_name, rawToken));
    }

    // Always return generic response to prevent account enumeration
    res.json({
      message: 'If an account exists with that email address, a password reset link has been sent.',
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    res.json({
      message: 'If an account exists with that email address, a password reset link has been sent.',
    });
  }
});

// 6. RESET PASSWORD
router.post('/reset-password', async (req, res): Promise<void> => {
  try {
    const { token, new_password, confirm_password } = req.body;

    if (!token || !new_password) {
      res.status(400).json({ error: 'Token and new password are required.' });
      return;
    }

    if (new_password !== confirm_password) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    const resetRecord = db.prepare(`
      SELECT r.id, r.user_id, r.expires_at, r.used_at, u.email, u.full_name
      FROM password_reset_tokens r
      JOIN users u ON u.id = r.user_id
      WHERE r.token_hash = ?
    `).get(tokenHash) as any;

    if (!resetRecord || resetRecord.used_at || new Date(resetRecord.expires_at) < new Date()) {
      res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    // Atomically update password and mark token used
    const updateTx = db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(newPasswordHash, now, resetRecord.user_id);
      db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).run(now, resetRecord.id);
    });
    updateTx();

    sendEmail(createPasswordChangedEmail(resetRecord.email, resetRecord.full_name)).catch(console.error);

    res.json({ message: 'Password has been successfully reset. You may now log in with your new password.' });
  } catch (err: any) {
    console.error('[RESET PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// 7. VERIFY EMAIL
router.post('/verify-email', (req, res): void => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    const record = db.prepare(`
      SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = ?
    `).get(tokenHash) as any;

    if (!record || new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: 'Verification link is invalid or has expired.' });
      return;
    }

    db.transaction(() => {
      db.prepare(`UPDATE users SET is_verified = 1, updated_at = ? WHERE id = ?`).run(now, record.user_id);
      db.prepare(`DELETE FROM email_verification_tokens WHERE id = ?`).run(record.id);
    })();

    res.json({ message: 'Email verified successfully! You now have full access to StudySync.' });
  } catch (err: any) {
    console.error('[VERIFY EMAIL ERROR]', err);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// 8. RESEND VERIFICATION EMAIL
router.post('/resend-verification', async (req: AuthRequest, res): Promise<void> => {
  try {
    const bodyEmail = req.body?.email?.trim().toLowerCase();
    let user: any = null;

    if (bodyEmail) {
      user = db.prepare('SELECT id, full_name, email, is_verified FROM users WHERE email = ? AND is_active = 1').get(bodyEmail);
    } else {
      const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : req.cookies?.token;
      if (token) {
        try {
          const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
          user = db.prepare('SELECT id, full_name, email, is_verified FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
        } catch {
          // ignore
        }
      }
    }

    if (!user) {
      res.json({ message: 'If an unverified account exists with that email address, a verification link has been sent.' });
      return;
    }

    if (user.is_verified === 1) {
      res.status(400).json({ error: 'Your email address is already verified. You may log in directly.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    db.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ?`).run(user.id);
    db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, now);

    await sendEmail(createVerificationEmail(user.email, user.full_name, rawToken));

    res.json({ message: 'Verification email has been resent.' });
  } catch (err: any) {
    console.error('[RESEND VERIFICATION ERROR]', err);
    res.status(500).json({ error: 'Failed to resend verification email.' });
  }
});

// 9. CHANGE PASSWORD (Authenticated)
router.post('/change-password', requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    const user = req.user!;

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (new_password !== confirm_password) {
      res.status(400).json({ error: 'New passwords do not match.' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const dbUser = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(user.id) as { password_hash: string };
    const matches = await bcrypt.compare(current_password, dbUser.password_hash);
    if (!matches) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(new_password, salt);
    const now = new Date().toISOString();

    db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(newHash, now, user.id);

    sendEmail(createPasswordChangedEmail(user.email, user.full_name)).catch(console.error);

    res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    console.error('[CHANGE PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// 10. DELETE / DEACTIVATE ACCOUNT
router.post('/delete-account', requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { password } = req.body;
    const user = req.user!;

    const dbUser = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(user.id) as { password_hash: string };
    const matches = await bcrypt.compare(password, dbUser.password_hash);
    if (!matches) {
      res.status(400).json({ error: 'Incorrect password. Account deletion aborted.' });
      return;
    }

    // Soft delete or cascade delete
    db.prepare(`UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?`).run(new Date().toISOString(), user.id);
    res.clearCookie('token');
    res.json({ message: 'Account has been deactivated successfully.' });
  } catch (err: any) {
    console.error('[DELETE ACCOUNT ERROR]', err);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;
