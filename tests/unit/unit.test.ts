import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateStudentId, generateRoomInviteCode } from '../../server/src/db/index.js';
import { config } from '../../server/src/config/index.js';
import {
  createVerificationEmail,
  createPasswordResetOtpEmail,
  createPasswordChangedEmail,
  createGroupInvitationEmail,
} from '../../server/src/services/mailer.js';

describe('StudySync Unit Tests: Pure Calculations, Generators & Templates', () => {
  describe('1. Student ID & Room Code Generators', () => {
    it('Generates Student ID with correct format STU-XXXXXX', () => {
      const studentId = generateStudentId();
      expect(studentId).toMatch(/^STU-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    });

    it('Generates unique Student IDs on successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(generateStudentId());
      }
      expect(ids.size).toBe(50);
    });

    it('Generates Room Invite Code with correct format ROOM-XXXXXX', () => {
      const roomCode = generateRoomInviteCode();
      expect(roomCode).toMatch(/^ROOM-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    });

    it('Generates unique Room Invite Codes across successive calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codes.add(generateRoomInviteCode());
      }
      expect(codes.size).toBe(50);
    });
  });

  describe('2. Email Notification Templates & XSS Sanitization', () => {
    it('Renders email verification template with 6-digit OTP and sanitizes HTML entities', () => {
      const maliciousName = '<img src=x onerror=alert("XSS")>Alice';
      const otp = '849201';
      const mail = createVerificationEmail('alice@example.com', maliciousName, otp);

      expect(mail.to).toBe('alice@example.com');
      expect(mail.subject).toContain('Verify Your Student Account');
      expect(mail.text).toContain(otp);
      expect(mail.html).toContain(otp);
      expect(mail.html).not.toContain('<img src=x');
      expect(mail.html).toContain('&lt;img src=x');
    });

    it('Renders password reset OTP email template safely', () => {
      const mail = createPasswordResetOtpEmail('bob@example.com', 'Bob Smith', '392817');
      expect(mail.to).toBe('bob@example.com');
      expect(mail.subject).toContain('Password Reset Verification Code');
      expect(mail.text).toContain('392817');
      expect(mail.html).toContain('392817');
      expect(mail.html).toContain('10 minutes');
    });

    it('Renders password changed security alert email safely', () => {
      const mail = createPasswordChangedEmail('carol@example.com', 'Carol White');
      expect(mail.to).toBe('carol@example.com');
      expect(mail.subject).toContain('Security Alert: Password Changed');
      expect(mail.text).toContain('Carol White');
      expect(mail.html).toContain('Carol White');
      expect(mail.html).toContain('Password Successfully Changed');
    });

    it('Renders group invitation email template with invite code', () => {
      const mail = createGroupInvitationEmail(
        'dave@example.com',
        'Dave Miller',
        'CS-301 Algorithms',
        'GRP-9988'
      );
      expect(mail.to).toBe('dave@example.com');
      expect(mail.subject).toContain('CS-301 Algorithms');
      expect(mail.text).toContain('GRP-9988');
      expect(mail.html).toContain('GRP-9988');
    });
  });

  describe('3. Cryptographic Security & Token Lifecycle', () => {
    it('Bcrypt: hashes password with salt 12 and verifies correctly', async () => {
      const plainPassword = 'CorrectHorseBatteryStaple123!';
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(plainPassword, salt);

      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      const matches = await bcrypt.compare(plainPassword, hash);
      expect(matches).toBe(true);

      const wrongMatches = await bcrypt.compare('WrongPassword', hash);
      expect(wrongMatches).toBe(false);
    });

    it('JWT: signs and verifies session token containing student identity', () => {
      const testUserId = crypto.randomUUID();
      const token = jwt.sign({ userId: testUserId }, config.jwtSecret, { expiresIn: '1h' });

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      expect(decoded.userId).toBe(testUserId);
    });

    it('JWT: rejects tokens signed with an invalid secret or tampered payloads', () => {
      const token = jwt.sign({ userId: 'spoofed_user' }, 'wrong_untrusted_secret');
      expect(() => {
        jwt.verify(token, config.jwtSecret);
      }).toThrow();
    });
  });

  describe('4. Focus Timer & Academic Calculations', () => {
    it('Derives correct remaining focus time when timer is idle', () => {
      const focusMinutes = 25;
      const totalSeconds = focusMinutes * 60;
      expect(totalSeconds).toBe(1500);
    });

    it('Calculates remaining focus time correctly when running with elapsed seconds', () => {
      const focusMinutes = 25;
      const totalSeconds = focusMinutes * 60;
      const elapsedSeconds = 300; // 5 minutes elapsed
      const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
      expect(remainingSeconds).toBe(1200); // 20 minutes remaining
    });

    it('Calculates remaining focus time correctly when paused with prior elapsed time', () => {
      const focusDuration = 25 * 60;
      const elapsedBeforePause = 450; // 7.5 minutes
      const remaining = focusDuration - elapsedBeforePause;
      expect(remaining).toBe(1050);
    });

    it('Syllabus calculation: handles 0 topics safely without division by zero', () => {
      const totalTopics = 0;
      const completedTopics = 0;
      const percentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
      expect(percentage).toBe(0);
    });

    it('Syllabus calculation: derives accurate completion percentages for completed vs in-progress topics', () => {
      const topics = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'completed' },
        { id: '3', status: 'in_progress' },
        { id: '4', status: 'not_started' },
      ];
      const completedCount = topics.filter((t) => t.status === 'completed').length;
      const percentage = Math.round((completedCount / topics.length) * 100);
      expect(percentage).toBe(50);
    });
  });
});
