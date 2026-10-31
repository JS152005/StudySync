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

    // Create 6-digit OTP verification token
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const tokenHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, tokenHash, expiresAt, now);

    console.log(`[AUTH] Verification OTP for ${normalizedEmail}: ${rawOtp}`);

    // Send verification email asynchronously
    sendEmail(createVerificationEmail(normalizedEmail, full_name.trim(), rawOtp)).catch((err) =>
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

// 5. FORGOT PASSWORD (6-Digit Email OTP)
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
      // Generate cryptographically secure 6-digit OTP
      const rawOtp = crypto.randomInt(100000, 1000000).toString();
      const tokenHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes lifetime
      const now = new Date().toISOString();

      // Invalidate existing unused tokens for this user
      db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).run(now, user.id);

      db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, attempts)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, now);

      console.log(`[AUTH] Password Reset OTP for ${user.email}: ${rawOtp}`);

      await sendEmail(createPasswordResetEmail(user.email, user.full_name, rawOtp));
    }

    // Always return generic response to prevent account enumeration
    res.json({
      message: 'If an account exists with that email address, a 6-digit verification code has been sent.',
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    res.json({
      message: 'If an account exists with that email address, a 6-digit verification code has been sent.',
    });
  }
});

// 5B. VERIFY PASSWORD RESET OTP (Step 2: Returns short-lived reset authorization token)
router.post('/verify-reset-otp', (req, res): void => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: 'Email and 6-digit verification code are required.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanedOtp = String(otp).trim().replace(/[\s-]+/g, '');

    if (cleanedOtp.length !== 6 || !/^\d{6}$/.test(cleanedOtp)) {
      res.status(400).json({ error: 'Verification code must be a 6-digit number.' });
      return;
    }

    const user = db.prepare('SELECT id, full_name, email FROM users WHERE email = ? AND is_active = 1').get(normalizedEmail) as { id: string; full_name: string; email: string } | undefined;
    if (!user) {
      res.status(400).json({ error: 'Verification code is invalid or has expired.' });
      return;
    }

    const record = db.prepare(`
      SELECT id, user_id, token_hash, expires_at, used_at, attempts
      FROM password_reset_tokens
      WHERE user_id = ? AND used_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id) as any;

    if (!record || new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: 'Verification code is invalid or has expired.' });
      return;
    }

    if (record.attempts >= 5) {
      res.status(400).json({ error: 'Too many failed attempts. Please request a new verification code.' });
      return;
    }

    const submittedHash = crypto.createHash('sha256').update(cleanedOtp).digest('hex');
    if (submittedHash !== record.token_hash) {
      db.prepare(`UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = ?`).run(record.id);
      res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
      return;
    }

    const now = new Date().toISOString();
    // Mark OTP as verified/used
    db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).run(now, record.id);

    // Issue short-lived cryptographic reset authorization token (15 minutes)
    const reset_token = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'password_reset' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'Verification code verified successfully. Please set your new password.',
      reset_token,
    });
  } catch (err: any) {
    console.error('[VERIFY RESET OTP ERROR]', err);
    res.status(500).json({ error: 'Failed to verify reset code.' });
  }
});

// 6. RESET PASSWORD (Requires verified short-lived reset authorization token)
router.post('/reset-password', async (req, res): Promise<void> => {
  try {
    const { reset_token, token, new_password, confirm_password } = req.body;
    const effectiveToken = reset_token || token;

    if (!effectiveToken || !new_password) {
      res.status(400).json({ error: 'Reset authorization token and new password are required.' });
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

    let targetUserId = '';
    let targetEmail = '';
    let targetName = '';
    const now = new Date().toISOString();

    // 1. Try decoding as JWT reset_token
    try {
      const decoded = jwt.verify(effectiveToken, config.jwtSecret) as { userId: string; purpose: string };
      if (decoded && decoded.purpose === 'password_reset' && decoded.userId) {
        const user = db.prepare('SELECT id, email, full_name FROM users WHERE id = ? AND is_active = 1').get(decoded.userId) as any;
        if (user) {
          targetUserId = user.id;
          targetEmail = user.email;
          targetName = user.full_name;
        }
      }
    } catch {
      // 2. Fallback: check if effectiveToken matches a valid raw token in password_reset_tokens (for backwards compatibility)
      const tokenHash = crypto.createHash('sha256').update(effectiveToken).digest('hex');
      const resetRecord = db.prepare(`
        SELECT r.id, r.user_id, r.expires_at, r.used_at, u.email, u.full_name
        FROM password_reset_tokens r
        JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = ?
      `).get(tokenHash) as any;

      if (resetRecord && !resetRecord.used_at && new Date(resetRecord.expires_at) >= new Date()) {
        targetUserId = resetRecord.user_id;
        targetEmail = resetRecord.email;
        targetName = resetRecord.full_name;
        db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).run(now, resetRecord.id);
      }
    }

    if (!targetUserId) {
      res.status(400).json({ error: 'This password reset authorization is invalid or has expired. Please verify your OTP again.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    // Atomically update password and invalidate all tokens for this user
    const updateTx = db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(newPasswordHash, now, targetUserId);
      db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).run(now, targetUserId);
    });
    updateTx();

    sendEmail(createPasswordChangedEmail(targetEmail, targetName)).catch(console.error);

    res.json({ message: 'Password has been successfully reset. You may now log in with your new password.' });
  } catch (err: any) {
    console.error('[RESET PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// 7. VERIFY EMAIL (6-Digit OTP / Token)
router.post('/verify-email', (req, res): void => {
  try {
    const rawToken = req.body?.token ? String(req.body.token).trim() : '';
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : '';

    if (!rawToken) {
      res.status(400).json({ error: 'Verification code is required.' });
      return;
    }

    const cleanedToken = rawToken.replace(/[\s-]+/g, '');
    const tokenHash = crypto.createHash('sha256').update(cleanedToken).digest('hex');
    const now = new Date().toISOString();

    let record: any = null;

    if (email) {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
      if (user) {
        record = db.prepare(`
          SELECT id, user_id, expires_at FROM email_verification_tokens
          WHERE user_id = ? AND token_hash = ?
        `).get(user.id, tokenHash) as any;
      }
    }

    if (!record) {
      record = db.prepare(`
        SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = ?
      `).get(tokenHash) as any;
    }

    if (!record || new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: 'Verification code is invalid or has expired.' });
      return;
    }

    db.transaction(() => {
      db.prepare(`UPDATE users SET is_verified = 1, updated_at = ? WHERE id = ?`).run(now, record.user_id);
      db.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ?`).run(record.user_id);
    })();

    res.json({ message: 'Email verified successfully! You now have full access to StudySync.' });
  } catch (err: any) {
    console.error('[VERIFY EMAIL ERROR]', err);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// 8. RESEND VERIFICATION EMAIL (6-Digit OTP)
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
      res.json({ message: 'If an unverified account exists with that email address, a verification code has been sent.' });
      return;
    }

    if (user.is_verified === 1) {
      res.status(400).json({ error: 'Your email address is already verified. You may log in directly.' });
      return;
    }

    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const tokenHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    db.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ?`).run(user.id);
    db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, now);

    console.log(`[AUTH] Resent Verification OTP for ${user.email}: ${rawOtp}`);

    await sendEmail(createVerificationEmail(user.email, user.full_name, rawOtp));

    res.json({ message: 'A fresh 6-digit verification code has been sent to your email.' });
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
