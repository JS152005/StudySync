import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../server/src/index.js';
import { db, generateStudentId, generateRoomInviteCode } from '../../server/src/db/index.js';

describe('StudySync API Endpoints Full Verification Suite', () => {
  let userToken = '';
  let userId = '';
  let userStudentId = '';
  let userEmail = '';
  let otherToken = '';
  let otherUserId = '';
  let otherStudentId = '';

  beforeAll(async () => {
    // Create and verify primary test user
    const username = `api_user_${Date.now()}`;
    userEmail = `${username}@example.com`;
    userStudentId = generateStudentId();
    userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const salt = '$2a$12$e80yq9c6560KfZg7pYkZ0uRk7gPj.C00HkO7jY56.66f0Z9zFkXkG'; // precomputed
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'API Primary User', ?, 1, 1, ?, ?)
    `).run(userId, userStudentId, userEmail, username, salt, now, now);

    // Login to obtain valid JWT token
    // For direct token creation:
    const jwt = (await import('jsonwebtoken')).default;
    const { config } = await import('../../server/src/config/index.js');
    userToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });

    // Create secondary test user
    const otherUsername = `api_other_${Date.now()}`;
    otherStudentId = generateStudentId();
    otherUserId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'API Other User', ?, 1, 1, ?, ?)
    `).run(otherUserId, otherStudentId, `${otherUsername}@example.com`, otherUsername, salt, now, now);

    otherToken = jwt.sign({ userId: otherUserId }, config.jwtSecret, { expiresIn: '7d' });
  });

  describe('1. System & Health Endpoints', () => {
    it('GET /api/health responds with status ok, service identifier, and ISO timestamp', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toContain('StudySync');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('2. Authentication Endpoint Validation & Guards', () => {
    it('POST /api/auth/register fails when mandatory fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'incomplete@example.com',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/auth/register rejects password shorter than 8 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        full_name: 'Short Pass User',
        email: `short_${Date.now()}@example.com`,
        username: `short_${Date.now()}`,
        password: 'short',
        confirm_password: 'short',
        terms_accepted: true,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 8 characters');
    });

    it('POST /api/auth/login fails with 401 when invalid password is provided', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: userEmail,
        password: 'CompletelyWrongPassword123!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('GET /api/auth/me rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/me returns authenticated student identity with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.student_id).toBe(userStudentId);
    });
  });

  describe('3. User Profiles & Exact Student ID Lookup', () => {
    it('GET /api/users/by-student-id/:studentId returns exact student profile', async () => {
      const res = await request(app)
        .get(`/api/users/by-student-id/${otherStudentId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.student).toBeDefined();
      expect(res.body.student.id).toBe(otherUserId);
      expect(res.body.student.student_id).toBe(otherStudentId);
    });

    it('GET /api/users/by-student-id/:studentId returns 400 when searching own Student ID', async () => {
      const res = await request(app)
        .get(`/api/users/by-student-id/${userStudentId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(400);
      expect(res.body.isSelf).toBe(true);
    });

    it('GET /api/users/by-student-id/:studentId returns 404 for unknown Student ID', async () => {
      const res = await request(app)
        .get('/api/users/by-student-id/STU-999999')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
    });

    it('PUT /api/users/profile updates student course, college and availability', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          full_name: 'API Primary User Updated',
          course: 'Software Engineering',
          college: 'Oxford Academic Institute',
          academic_year: 'Senior Year',
          bio: 'Automated test verified bio',
          availability: 'focusing',
          privacy_email: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.course).toBe('Software Engineering');
      expect(res.body.user.availability).toBe('focusing');
      expect(res.body.user.privacy_email).toBe(1);
    });
  });

  describe('4. Private Study Groups & Access Control', () => {
    let createdGroupId = '';

    it('POST /api/groups creates a private group with invite code', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Distributed Systems Group',
          subject: 'Computer Science',
          course: 'CS-401',
          description: 'Study group for consensus protocols',
        });

      expect(res.status).toBe(201);
      expect(res.body.group).toBeDefined();
      expect(res.body.group.name).toBe('Distributed Systems Group');
      expect(res.body.group.invite_code).toBeDefined();
      createdGroupId = res.body.group.id;
    });

    it('POST /api/groups rejects group creation with empty name', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('POST /api/groups/join-by-code rejects invalid invite code with 404', async () => {
      const res = await request(app)
        .post('/api/groups/join-by-code')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ invite_code: 'INVALID_CODE_XYZ' });
      expect(res.status).toBe(404);
    });
  });

  describe('5. Study Rooms & Invite Codes', () => {
    let testRoomId = '';
    let testRoomCode = '';

    it('POST /api/rooms creates a study room with unique ROOM-XXXXXX invite code', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Algorithm Mastery Room',
          subject: 'Algorithms',
          topic: 'Dynamic Programming',
        });

      expect(res.status).toBe(201);
      expect(res.body.room).toBeDefined();
      expect(res.body.room.invite_code).toMatch(/^ROOM-[A-Z0-9]{6}$/);
      testRoomId = res.body.room.id;
      testRoomCode = res.body.room.invite_code;
    });

    it('POST /api/rooms/join-by-code allows other student to join with valid room code', async () => {
      const res = await request(app)
        .post('/api/rooms/join-by-code')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ invite_code: testRoomCode });

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe(testRoomId);
    });

    it('POST /api/rooms/join-by-code returns 404 for non-existent room code', async () => {
      const res = await request(app)
        .post('/api/rooms/join-by-code')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ invite_code: 'ROOM-NONEXIST' });

      expect(res.status).toBe(404);
    });

    it('DELETE /api/rooms/:id/participants/:userId: non-host cannot kick participants', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${testRoomId}/participants/${userId}`)
        .set('Authorization', `Bearer ${otherToken}`); // Other is participant, not host

      expect(res.status).toBe(403);
    });
  });
});
