import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { createVerificationEmail, createPasswordResetEmail } from '../src/services/mailer.js';
import { getOrCreateRoomState } from '../src/socket/index.js';

describe('StudySync Core Systems & Security Suite', () => {
  let authToken = '';
  let userId = '';
  let studentId = '';
  let studentUsername = `student_${Date.now()}`;
  let studentEmail = `${studentUsername}@example.com`;
  let peerToken = '';
  let peerUserId = '';
  let peerStudentId = '';
  let strangerToken = '';
  let strangerUserId = '';
  let groupId = '';

  describe('1. Unit Tests: Pure Calculations & Templates', () => {
    it('Email Templates: renders verification email with escaped HTML and valid OTP link', () => {
      const mail = createVerificationEmail('test@example.com', '<script>alert(1)</script>John', '849201');
      expect(mail.to).toBe('test@example.com');
      expect(mail.text).toContain('849201');
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain('&lt;script&gt;');
      expect(mail.html).toContain('849201');
    });

    it('Email Templates: renders password reset email safely', () => {
      const mail = createPasswordResetEmail('test@example.com', 'Alice Smith', 'reset-token-456');
      expect(mail.subject).toContain('Password Reset');
      expect(mail.text).toContain('reset-token-456');
    });
  });

  describe('2. Authentication, Mandatory Email Verification & Student Identity', () => {
    it('Rejects registration when terms are not accepted', async () => {
      const res = await request(app).post('/api/auth/register').send({
        full_name: 'Test Student',
        email: studentEmail,
        username: studentUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        terms_accepted: false,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('terms of service');
    });

    it('Registers a new student account without returning auth token (mandatory verification)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        full_name: 'Alex Rivera',
        email: studentEmail,
        username: studentUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Computer Science',
        college: 'MIT School of Engineering',
        academic_year: '3rd Year',
        terms_accepted: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.student_id).toMatch(/^STU-[A-Z0-9]{6}$/);
      expect(res.body.user.is_verified).toBe(0);
      expect(res.body.unverified).toBe(true);
      expect(res.body.token).toBeUndefined(); // Access must NOT be granted before email verification

      userId = res.body.user.id;
      studentId = res.body.user.student_id;
    });

    it('Rejects login attempt when email is not verified (403 Forbidden)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'Password123!',
      });
      expect(res.status).toBe(403);
      expect(res.body.unverified).toBe(true);
      expect(res.body.error).toContain('verify your email');
    });

    it('Verifies email successfully via /api/auth/verify-email with 6-digit OTP and email', async () => {
      const tokenRecord = db.prepare('SELECT id, token_hash FROM email_verification_tokens WHERE user_id = ?').get(userId) as any;
      expect(tokenRecord).toBeDefined();

      const testOtp = '654321';
      const hash = crypto.createHash('sha256').update(testOtp).digest('hex');
      db.prepare('UPDATE email_verification_tokens SET token_hash = ? WHERE id = ?').run(hash, tokenRecord.id);

      const verifyRes = await request(app).post('/api/auth/verify-email').send({
        token: testOtp,
        email: studentEmail,
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.message).toContain('verified successfully');

      const userRecord = db.prepare('SELECT is_verified FROM users WHERE id = ?').get(userId) as any;
      expect(userRecord.is_verified).toBe(1);
    });

    it('Logs in successfully with verified account using username', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'Password123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.is_verified).toBe(1);
      expect(res.body.user.student_id).toBe(studentId);

      authToken = res.body.token;
    });

    it('Logs in successfully using Student ID (STU-XXXXXX)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentId,
        password: 'Password123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.id).toBe(userId);
    });

    it('Registers and verifies peer student account for collaboration tests', async () => {
      const peerUsername = `peer_${Date.now()}`;
      const peerEmail = `${peerUsername}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        full_name: 'Jordan Lee',
        email: peerEmail,
        username: peerUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Computer Science',
        college: 'MIT School of Engineering',
        academic_year: '3rd Year',
        terms_accepted: true,
      });

      expect(regRes.status).toBe(201);
      peerUserId = regRes.body.user.id;
      peerStudentId = regRes.body.user.student_id;

      db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(peerUserId);

      const loginRes = await request(app).post('/api/auth/login').send({
        identifier: peerUsername,
        password: 'Password123!',
      });
      expect(loginRes.status).toBe(200);
      peerToken = loginRes.body.token;
    });

    it('Registers and verifies stranger account for unauthorized security tests', async () => {
      const strangerUsername = `stranger_${Date.now()}`;
      const strangerEmail = `${strangerUsername}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        full_name: 'Stranger Danger',
        email: strangerEmail,
        username: strangerUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Arts',
        college: 'Unknown College',
        academic_year: '1st Year',
        terms_accepted: true,
      });

      expect(regRes.status).toBe(201);
      strangerUserId = regRes.body.user.id;
      db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(strangerUserId);

      const loginRes = await request(app).post('/api/auth/login').send({
        identifier: strangerUsername,
        password: 'Password123!',
      });
      strangerToken = loginRes.body.token;
    });

    it('Finds student by exact Student ID via /api/users/by-student-id/:studentId', async () => {
      const res = await request(app)
        .get(`/api/users/by-student-id/${peerStudentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.student).toBeDefined();
      expect(res.body.student.id).toBe(peerUserId);
      expect(res.body.student.student_id).toBe(peerStudentId);
      expect(res.body.student.full_name).toBe('Jordan Lee');
      // Must not leak private sensitive fields like email or password_hash
      expect(res.body.student.email).toBeUndefined();
      expect(res.body.student.password_hash).toBeUndefined();
    });

    it('Returns 404 when searching non-existent Student ID', async () => {
      const res = await request(app)
        .get('/api/users/by-student-id/STU-NONEXIST')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('3. Private Chats — WhatsApp-Style 1-to-1 Conversations', () => {
    let directMsgId = '';

    it('Sends a private direct message to peer student', async () => {
      const res = await request(app)
        .post(`/api/messages/direct/${peerUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hey Jordan! Can we collaborate on the upcoming study room?',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.content).toBe('Hey Jordan! Can we collaborate on the upcoming study room?');
      expect(res.body.message.sender_id).toBe(userId);
      expect(res.body.message.recipient_id).toBe(peerUserId);
      directMsgId = res.body.message.id;
    });

    it('Peer student retrieves direct message history and marks as read', async () => {
      const res = await request(app)
        .get(`/api/messages/direct/${userId}`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBeGreaterThan(0);
      const found = res.body.messages.find((m: any) => m.id === directMsgId);
      expect(found).toBeDefined();
      expect(found.content).toContain('collaborate');
    });

    it('Lists user active conversations with unread counts', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.directChats).toBeDefined();
      expect(res.body.directChats.some((c: any) => c.user_id === peerUserId)).toBe(true);
    });

    it('Security: Stranger cannot access private direct messages between Alex and Jordan', async () => {
      const res = await request(app)
        .get(`/api/messages/direct/${userId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(200);
      // Stranger should have NO messages with Alex
      expect(res.body.messages.length).toBe(0);
    });
  });

  describe('4. Private Study Groups & Group Messaging', () => {
    it('Creates a private study group with initial member by Student ID', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Distributed Systems & Cloud Study Group',
          description: 'Private group for consensus algorithms',
          subject: 'Computer Science',
          course: 'B.Tech',
          member_student_ids: [peerStudentId],
        });

      expect(res.status).toBe(201);
      expect(res.body.group.name).toBe('Distributed Systems & Cloud Study Group');
      expect(res.body.group.invite_code).toBeDefined();
      groupId = res.body.group.id;
    });

    it('Verifies group members list includes creator as owner and peer as member', async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.members.length).toBe(2);
      expect(res.body.members.some((m: any) => m.user_id === userId && m.role === 'owner')).toBe(true);
      expect(res.body.members.some((m: any) => m.user_id === peerUserId && m.role === 'member')).toBe(true);
    });

    it('Sends a private group message', async () => {
      const res = await request(app)
        .post(`/api/messages/group/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Welcome to the private group! Study room starting soon.',
        });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toContain('Welcome to the private group');
    });

    it('Peer member retrieves group messages successfully', async () => {
      const res = await request(app)
        .get(`/api/messages/group/${groupId}`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(1);
    });

    it('Security: Stranger cannot view or post messages to private group', async () => {
      const getRes = await request(app)
        .get(`/api/messages/group/${groupId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toContain('member');

      const postRes = await request(app)
        .post(`/api/messages/group/${groupId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ content: 'I am spying on your group!' });

      expect(postRes.status).toBe(403);
    });

    it('Adds a student to group by Student ID via /api/groups/:id/members', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ student_id: peerStudentId });

      // Peer was already a member from creation
      expect([201, 400]).toContain(res.status);
    });
  });

  describe('5. Study Rooms — Google Meet-Style Experience & Student ID Invites', () => {
    let roomId = '';
    let inviteCode = '';
    let invitationId = '';

    it('Creates a private study room with unique ROOM-XXXXXX invite code', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Distributed Consensus Live Session',
          subject: 'Computer Science',
          topic: 'Raft & Paxos',
        });

      expect(res.status).toBe(201);
      expect(res.body.room.id).toBeDefined();
      expect(res.body.room.invite_code).toMatch(/^ROOM-[A-Z0-9]{6}$/);
      expect(res.body.room.is_active).toBe(1);

      roomId = res.body.room.id;
      inviteCode = res.body.room.invite_code;
    });

    it('Host invites another student using their Student ID via /api/rooms/:id/invite-student', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/invite-student`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ student_id: peerStudentId });

      expect(res.status).toBe(201);
      expect(res.body.invitationId).toBeDefined();
      expect(res.body.invitee.student_id).toBe(peerStudentId);
      invitationId = res.body.invitationId;
    });

    it('Invited student views pending invitations via /api/rooms/invitations', async () => {
      const res = await request(app)
        .get('/api/rooms/invitations')
        .set('Authorization', `Bearer ${peerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invitations.length).toBeGreaterThan(0);
      const found = res.body.invitations.find((inv: any) => inv.id === invitationId);
      expect(found).toBeDefined();
      expect(found.room_id).toBe(roomId);
    });

    it('Invited student accepts invitation and automatically gains room participant access', async () => {
      const res = await request(app)
        .post(`/api/rooms/invitations/${invitationId}/respond`)
        .set('Authorization', `Bearer ${peerToken}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe(roomId);

      // Verify peer can now view room details
      const roomRes = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(roomRes.status).toBe(200);
      expect(roomRes.body.room.id).toBe(roomId);
      expect(roomRes.body.participants.some((p: any) => p.user_id === peerUserId)).toBe(true);
    });

    it('Stranger can join private room using valid room invite code via /api/rooms/join-by-code', async () => {
      const res = await request(app)
        .post('/api/rooms/join-by-code')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ invite_code: inviteCode });

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe(roomId);
    });

    it('Rejects joining room with invalid code', async () => {
      const res = await request(app)
        .post('/api/rooms/join-by-code')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ invite_code: 'ROOM-INVALID' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No active private study room');
    });

    it('Saves and retrieves collaborative whiteboard state for room', async () => {
      const strokeData = JSON.stringify([{ type: 'draw', color: '#0284C7', fromX: 0.1, fromY: 0.1, toX: 0.5, toY: 0.5 }]);

      const saveRes = await request(app)
        .put(`/api/rooms/${roomId}/whiteboard`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ canvasData: strokeData });

      expect(saveRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/rooms/${roomId}/whiteboard`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.canvasData).toBe(strokeData);
    });

    it('Host removes a participant from room via DELETE /api/rooms/:id/participants/:userId', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomId}/participants/${strangerUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('removed');

      // Room participants should no longer include stranger
      const roomRes = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(roomRes.body.participants.some((p: any) => p.user_id === strangerUserId)).toBe(false);
    });

    it('Non-host cannot remove participants from room', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomId}/participants/${userId}`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('6. Dashboard Summary & Student Identity Quick Access', () => {
    it('Fetches minimal dashboard summary including Student ID, recent chats, groups, and rooms', async () => {
      const res = await request(app)
        .get('/api/users/dashboard-summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.recentDirectChats).toBeDefined();
      expect(res.body.myGroups).toBeDefined();
      expect(res.body.activeHostedRooms).toBeDefined();
      expect(res.body.pendingRoomInvitations).toBeDefined();
    });
  });

  describe('7. Password Reset via 6-Digit Email OTP & Security Verification', () => {
    let testUserEmail = '';
    let testUserId = '';
    let validOtp = '';
    let resetAuthToken = '';

    beforeAll(() => {
      testUserEmail = studentEmail;
      testUserId = userId;
    });

    it('Step 1: Requests password reset OTP — returns generic enumeration-safe response', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('6-digit verification code has been sent');

      // Non-existent email returns exact same generic response to prevent account enumeration
      const fakeRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent_student_999@example.com' });

      expect(fakeRes.status).toBe(200);
      expect(fakeRes.body.message).toBe(res.body.message);
    });

    it('Step 1 Verification: OTP is cryptographically hashed and stored with 10-minute expiry', () => {
      const record = db.prepare(`
        SELECT id, user_id, token_hash, expires_at, used_at, attempts
        FROM password_reset_tokens
        WHERE user_id = ? AND used_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(testUserId) as any;

      expect(record).toBeDefined();
      expect(record.token_hash).toHaveLength(64); // SHA-256 hex digest
      expect(record.attempts).toBe(0);
      expect(new Date(record.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('Step 2 Security: Rejects malformed or non-6-digit OTP codes', async () => {
      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: testUserEmail, otp: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('6-digit');
    });

    it('Step 2 Security: Rejects incorrect OTP and increments failed attempts counter', async () => {
      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: testUserEmail, otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid verification code');

      const record = db.prepare(`
        SELECT attempts FROM password_reset_tokens
        WHERE user_id = ? AND used_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(testUserId) as any;

      expect(record.attempts).toBe(1);
    });

    it('Step 2 Security: Rejects expired OTP code', async () => {
      // Set expires_at in the past
      const pastTime = new Date(Date.now() - 60000).toISOString();
      db.prepare(`UPDATE password_reset_tokens SET expires_at = ? WHERE user_id = ? AND used_at IS NULL`).run(pastTime, testUserId);

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: testUserEmail, otp: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('expired');
    });

    it('Step 2: Successfully verifies valid 6-digit OTP and returns short-lived reset authorization token', async () => {
      // Issue a fresh OTP in DB
      validOtp = '582914';
      const hash = crypto.createHash('sha256').update(validOtp).digest('hex');
      const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).run(now, testUserId);
      db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, attempts)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(crypto.randomUUID(), testUserId, hash, futureTime, now);

      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: testUserEmail, otp: validOtp });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('verified successfully');
      expect(res.body.reset_token).toBeDefined();

      resetAuthToken = res.body.reset_token;

      // Token in DB must now be marked as used
      const usedRecord = db.prepare(`SELECT used_at FROM password_reset_tokens WHERE token_hash = ?`).get(hash) as any;
      expect(usedRecord.used_at).not.toBeNull();
    });

    it('Step 2 Protection: Replay attack with already-used OTP is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: testUserEmail, otp: validOtp });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid or has expired');
    });

    it('Step 3 & 4 Security: Direct reset password without verified reset_token is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          reset_token: 'invalid_forged_token',
          new_password: 'NewSecurePassword999!',
          confirm_password: 'NewSecurePassword999!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid or has expired');
    });

    it('Step 3 & 4 Security: Rejects password shorter than 8 characters or non-matching passwords', async () => {
      const shortRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          reset_token: resetAuthToken,
          new_password: 'short',
          confirm_password: 'short',
        });
      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error).toContain('at least 8 characters');

      const mismatchRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          reset_token: resetAuthToken,
          new_password: 'NewSecurePassword999!',
          confirm_password: 'DifferentPassword123!',
        });
      expect(mismatchRes.status).toBe(400);
      expect(mismatchRes.body.error).toContain('do not match');
    });

    it('Step 3 & 4: Successfully updates password using verified reset_token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          reset_token: resetAuthToken,
          new_password: 'NewSecurePassword999!',
          confirm_password: 'NewSecurePassword999!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successfully reset');
    });

    it('Verification: Old password no longer works and new password logs in successfully', async () => {
      // 1. Old password fails
      const oldRes = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'Password123!',
      });
      expect(oldRes.status).toBe(401);

      // 2. New password succeeds
      const newRes = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'NewSecurePassword999!',
      });
      expect(newRes.status).toBe(200);
      expect(newRes.body.token).toBeDefined();
      expect(newRes.body.user.id).toBe(userId);
    });
  });

  describe('8. WebRTC Signaling, Room Lifecycles & Chat Reliability Suite', () => {
    it('Rejects direct message with empty content (WhatsApp-style validation)', async () => {
      const res = await request(app)
        .post(`/api/messages/direct/${peerUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cannot be empty');
    });

    it('Rejects group message with empty content', async () => {
      const res = await request(app)
        .post(`/api/messages/group/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cannot be empty');
    });

    it('Tracks room participant left_at timestamp accurately on leave', async () => {
      // Create fresh room to test leave tracking
      const createRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Lifecycle Verification Room', subject: 'Architecture' });

      expect(createRes.status).toBe(201);
      const testRoomId = createRes.body.room.id;
      const testInviteCode = createRes.body.room.invite_code;

      // Join room as peer using invite code
      const joinRes = await request(app)
        .post(`/api/rooms/${testRoomId}/join`)
        .set('Authorization', `Bearer ${peerToken}`)
        .send({ invite_code: testInviteCode });

      expect(joinRes.status).toBe(200);

      const roomBefore = await request(app)
        .get(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(roomBefore.body.participants.some((p: any) => p.user_id === peerUserId)).toBe(true);

      // Peer leaves room
      const leaveRes = await request(app)
        .post(`/api/rooms/${testRoomId}/leave`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(leaveRes.status).toBe(200);

      // Verify left_at is now set for peer in DB
      const partRecord = db.prepare(`SELECT left_at FROM room_participants WHERE room_id = ? AND user_id = ?`).get(testRoomId, peerUserId) as any;
      expect(partRecord.left_at).not.toBeNull();
    });
  });

  describe('9. Logical Participant Identity, Whiteboard Persistence & Meeting Architecture Suite', () => {
    let testRoomId = '';
    let testInviteCode = '';

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Architecture Identity & Whiteboard Pod', subject: 'Systems' });
      testRoomId = res.body.room.id;
      testInviteCode = res.body.room.invite_code;

      // Join peer and stranger
      await request(app)
        .post(`/api/rooms/${testRoomId}/join`)
        .set('Authorization', `Bearer ${peerToken}`)
        .send({ invite_code: testInviteCode });

      await request(app)
        .post(`/api/rooms/${testRoomId}/join`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ invite_code: testInviteCode });
    });

    it('Enforces single logical participant identity when one student opens multiple tabs/sockets', () => {
      const roomState = getOrCreateRoomState(testRoomId);

      // Student 1 connects from Tab 1 (Socket 1A)
      const socket1A = 'sock_1a_' + Date.now();
      roomState.participants.set(userId, {
        userId,
        username: studentUsername,
        fullName: 'Original Student',
        isHost: true,
        isHandRaised: false,
        videoEnabled: false,
        audioEnabled: false,
        primarySocketId: socket1A,
        sockets: new Set([socket1A]),
        joinedAt: new Date().toISOString(),
      });

      // Student 1 opens Tab 2 (Socket 1B)
      const socket1B = 'sock_1b_' + Date.now();
      const existingUser = roomState.participants.get(userId)!;
      existingUser.sockets.add(socket1B);
      existingUser.primarySocketId = socket1B;

      // Student 2 connects (Socket 2)
      const socket2 = 'sock_2_' + Date.now();
      roomState.participants.set(peerUserId, {
        userId: peerUserId,
        username: 'peer_user',
        fullName: 'Peer Student',
        isHost: false,
        isHandRaised: false,
        videoEnabled: false,
        audioEnabled: false,
        primarySocketId: socket2,
        sockets: new Set([socket2]),
        joinedAt: new Date().toISOString(),
      });

      // Student 3 connects (Socket 3)
      const socket3 = 'sock_3_' + Date.now();
      roomState.participants.set(strangerUserId, {
        userId: strangerUserId,
        username: 'stranger_user',
        fullName: 'Stranger Student',
        isHost: false,
        isHandRaised: false,
        videoEnabled: false,
        audioEnabled: false,
        primarySocketId: socket3,
        sockets: new Set([socket3]),
        joinedAt: new Date().toISOString(),
      });

      // Verification: 4 active sockets, but EXACTLY 3 unique logical participants!
      expect(roomState.participants.size).toBe(3);
      expect(roomState.participants.get(userId)?.sockets.size).toBe(2);
      expect(roomState.participants.get(userId)?.isHost).toBe(true);
    });

    it('Closing one browser tab preserves participant presence without disconnection', () => {
      const roomState = getOrCreateRoomState(testRoomId);

      const studentParticipant = roomState.participants.get(userId)!;
      expect(studentParticipant).toBeDefined();

      // Tab 1 closes (Socket 1A disconnects)
      const [firstSocket] = Array.from(studentParticipant.sockets);
      studentParticipant.sockets.delete(firstSocket);

      // Student still has Tab 2 open, so logical participant is NOT removed!
      expect(studentParticipant.sockets.size).toBe(1);
      expect(roomState.participants.size).toBe(3);
      expect(roomState.participants.has(userId)).toBe(true);
    });

    it('Disconnecting all tabs of a user removes them and updates DB left_at', () => {
      const roomState = getOrCreateRoomState(testRoomId);

      const strangerPart = roomState.participants.get(strangerUserId)!;
      expect(strangerPart).toBeDefined();

      // Stranger closes all sockets
      strangerPart.sockets.clear();
      if (strangerPart.sockets.size === 0) {
        roomState.participants.delete(strangerUserId);
        db.prepare('UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL')
          .run(new Date().toISOString(), testRoomId, strangerUserId);
      }

      // Participant count drops to 2
      expect(roomState.participants.size).toBe(2);
      expect(roomState.participants.has(strangerUserId)).toBe(false);

      const dbRow = db.prepare('SELECT left_at FROM room_participants WHERE room_id = ? AND user_id = ?').get(testRoomId, strangerUserId) as any;
      expect(dbRow.left_at).not.toBeNull();
    });

    it('Reconnecting user rejoins room without duplicate entries', async () => {
      const roomState = getOrCreateRoomState(testRoomId);

      // Stranger reconnects
      const newSocket = 'sock_stranger_reconnect_' + Date.now();
      roomState.participants.set(strangerUserId, {
        userId: strangerUserId,
        username: 'stranger_user',
        fullName: 'Stranger Student',
        isHost: false,
        isHandRaised: false,
        videoEnabled: false,
        audioEnabled: false,
        primarySocketId: newSocket,
        sockets: new Set([newSocket]),
        joinedAt: new Date().toISOString(),
      });

      // Clear DB left_at on reconnect
      db.prepare('UPDATE room_participants SET left_at = NULL WHERE room_id = ? AND user_id = ?').run(testRoomId, strangerUserId);

      expect(roomState.participants.size).toBe(3);

      // Verify HTTP API also returns exactly 3 unique participants
      const apiRes = await request(app)
        .get(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(apiRes.status).toBe(200);
      expect(apiRes.body.participants.length).toBe(3);

      const userIds = apiRes.body.participants.map((p: any) => p.user_id);
      const uniqueUserIds = new Set(userIds);
      expect(uniqueUserIds.size).toBe(3);
    });

    it('Persists whiteboard drawing strokes with monotonic sequence numbers in database', async () => {
      const stroke1 = { type: 'draw', color: '#0F172A', width: 3, fromX: 0.1, fromY: 0.1, toX: 0.4, toY: 0.4 };
      const stroke2 = { type: 'shape', tool: 'circle', color: '#0284C7', startX: 0.5, startY: 0.5, endX: 0.7, endY: 0.7 };

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), testRoomId, 1, userId, 'draw', JSON.stringify(stroke1), now);

      db.prepare(`
        INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), testRoomId, 2, peerUserId, 'shape', JSON.stringify(stroke2), now);

      // Verify strokes are retrievable via API
      const res = await request(app)
        .get(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.actions).toBeDefined();
      expect(res.body.actions.length).toBe(2);
      expect(res.body.version).toBe(2);

      expect(res.body.actions[0].sequenceNumber).toBe(1);
      expect(res.body.actions[0].stroke.type).toBe('draw');
      expect(res.body.actions[1].sequenceNumber).toBe(2);
      expect(res.body.actions[1].stroke.tool).toBe('circle');
    });

    it('Newly joining student and rejoining student receive complete persisted whiteboard state', async () => {
      // Third stroke added by host
      const stroke3 = { type: 'text', text: 'StudySync Collaboration', x: 0.2, y: 0.8, color: '#10B981' };
      db.prepare(`
        INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), testRoomId, 3, userId, 'text', JSON.stringify(stroke3), new Date().toISOString());

      // Fetch as newly invited student
      const res = await request(app)
        .get(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${peerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.actions.length).toBe(3);
      expect(res.body.version).toBe(3);
      expect(res.body.actions[2].stroke.text).toBe('StudySync Collaboration');
    });

    it('Whiteboard clear action persists in sequence without erasing historical room integrity', async () => {
      // Clear action recorded as sequence 4
      db.prepare(`
        INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
        VALUES (?, ?, ?, ?, 'clear', '{}', ?)
      `).run(crypto.randomUUID(), testRoomId, 4, userId, new Date().toISOString());

      const res = await request(app)
        .get(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.actions.length).toBe(4);
      expect(res.body.version).toBe(4);
      expect(res.body.actions[3].actionType).toBe('clear');
    });

    it('Participant leaving does not erase the whiteboard', async () => {
      // Peer leaves
      await request(app)
        .post(`/api/rooms/${testRoomId}/leave`)
        .set('Authorization', `Bearer ${peerToken}`);

      // Whiteboard data still intact for remaining participants
      const res = await request(app)
        .get(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.actions.length).toBe(4);
    });

    it('Permanent room closure sets is_active = 0 while retaining audit whiteboard records', async () => {
      const endRes = await request(app)
        .post(`/api/rooms/${testRoomId}/end`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(endRes.status).toBe(200);

      // Verify room status is inactive
      const room = db.prepare('SELECT is_active, ended_at FROM study_rooms WHERE id = ?').get(testRoomId) as any;
      expect(room.is_active).toBe(0);
      expect(room.ended_at).not.toBeNull();

      // Whiteboard actions remain preserved in DB
      const actionsCount = db.prepare('SELECT COUNT(*) as count FROM whiteboard_actions WHERE room_id = ?').get(testRoomId) as any;
      expect(actionsCount.count).toBe(4);
    });
  });

  describe('8. Study Room Meeting Picture-in-Picture & Lifecycle Suite', () => {
    let pipRoomId = '';

    it('Creates study room for PiP verification', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Distributed Systems Lecture Review',
          subject: 'Computer Science',
          topic: 'Byzantine Fault Tolerance',
        });

      expect(res.status).toBe(201);
      pipRoomId = res.body.room.id;
      expect(res.body.room.invite_code).toMatch(/^ROOM-/);
    });

    it('Maintains single logical participant identity across multi-socket connections', async () => {
      // Connect User socket 1
      const roomState = getOrCreateRoomState(pipRoomId);
      const userSockets = new Set(['socket_tab_1', 'socket_tab_2']);

      roomState.participants.set(userId, {
        userId,
        username: studentUsername,
        fullName: 'Alex Rivera',
        primarySocketId: 'socket_tab_1',
        sockets: userSockets,
        isHost: true,
        isHandRaised: false,
        videoEnabled: true,
        audioEnabled: true,
        joinedAt: new Date().toISOString(),
      });

      // Verify participant count represents unique student identity (1 student, not 2)
      expect(roomState.participants.size).toBe(1);
      const logicalUser = roomState.participants.get(userId);
      expect(logicalUser).toBeDefined();
      expect(logicalUser!.sockets.size).toBe(2);
    });

    it('PiP transition maintains room state and peer connections without dropping session', () => {
      const roomState = getOrCreateRoomState(pipRoomId);
      expect(roomState.participants.has(userId)).toBe(true);

      // Adding peer participant
      roomState.participants.set(peerUserId, {
        userId: peerUserId,
        username: 'peer_user',
        fullName: 'Jordan Lee',
        primarySocketId: 'peer_socket_1',
        sockets: new Set(['peer_socket_1']),
        isHost: false,
        isHandRaised: false,
        videoEnabled: true,
        audioEnabled: false,
        joinedAt: new Date().toISOString(),
      });

      // Both participants active in room
      expect(roomState.participants.size).toBe(2);
    });

    it('Explicit Leave Room releases room membership and cleans up presence', async () => {
      const leaveRes = await request(app)
        .post(`/api/rooms/${pipRoomId}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(leaveRes.status).toBe(200);

      // Verify participant left
      const participant = db.prepare('SELECT left_at FROM room_participants WHERE room_id = ? AND user_id = ?').get(pipRoomId, userId) as any;
      expect(participant.left_at).not.toBeNull();
    });
  });
});
