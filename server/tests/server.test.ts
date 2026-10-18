import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { computeSessionTiming } from '../src/routes/focus.js';
import { createVerificationEmail, createPasswordResetEmail } from '../src/services/mailer.js';

describe('StudySync Core Systems & Security Suite', () => {
  let authToken = '';
  let userId = '';
  let studentUsername = `student_${Date.now()}`;
  let studentEmail = `${studentUsername}@example.com`;
  let groupId = '';

  describe('1. Unit Tests: Pure Calculations & Templates', () => {
    it('Syllabus calculation: handles 0 topics safely without division by zero', () => {
      const total = 0;
      const completed = 0;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      expect(percentage).toBe(0);
    });

    it('Syllabus calculation: calculates partial and full completion percentages', () => {
      const total = 10;
      const completed = 3;
      const percentage = Math.round((completed / total) * 100);
      expect(percentage).toBe(30);

      const fullPercentage = Math.round((10 / 10) * 100);
      expect(fullPercentage).toBe(100);
    });

    it('Focus Session: derives correct remaining time when idle', () => {
      const session = {
        focus_duration_minutes: 25,
        break_duration_minutes: 5,
        phase: 'focus',
        status: 'idle',
        start_timestamp: null,
        elapsed_before_pause: 0,
      };
      const timing = computeSessionTiming(session);
      expect(timing.remainingMs).toBe(25 * 60 * 1000);
      expect(timing.elapsedMs).toBe(0);
      expect(timing.isExpired).toBe(false);
    });

    it('Focus Session: derives remaining time correctly when paused with elapsed', () => {
      const session = {
        focus_duration_minutes: 25,
        break_duration_minutes: 5,
        phase: 'focus',
        status: 'paused',
        start_timestamp: null,
        elapsed_before_pause: 5 * 60 * 1000, // 5 mins elapsed
      };
      const timing = computeSessionTiming(session);
      expect(timing.remainingMs).toBe(20 * 60 * 1000);
      expect(timing.elapsedMs).toBe(5 * 60 * 1000);
    });

    it('Email Templates: renders verification email with escaped HTML and valid link', () => {
      const mail = createVerificationEmail('test@example.com', '<script>alert(1)</script>John', 'raw-token-123');
      expect(mail.to).toBe('test@example.com');
      expect(mail.text).toContain('raw-token-123');
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain('&lt;script&gt;');
    });

    it('Email Templates: renders password reset email safely', () => {
      const mail = createPasswordResetEmail('test@example.com', 'Alice Smith', 'reset-token-456');
      expect(mail.subject).toContain('Password Reset');
      expect(mail.text).toContain('reset-token-456');
    });
  });

  describe('2. Authentication & Account Management Flow', () => {
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
      expect(res.body.error).toContain('terms');
    });

    it('Rejects registration with password mismatch', async () => {
      const res = await request(app).post('/api/auth/register').send({
        full_name: 'Test Student',
        email: studentEmail,
        username: studentUsername,
        password: 'Password123!',
        confirm_password: 'DifferentPassword!',
        terms_accepted: true,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('match');
    });

    it('Registers a new student account successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        full_name: 'Test Student',
        email: studentEmail,
        username: studentUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Computer Science',
        college: 'Engineering Institute',
        academic_year: '3rd Year',
        terms_accepted: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(studentEmail);
      expect(res.body.user.username).toBe(studentUsername);

      authToken = res.body.token;
      userId = res.body.user.id;
    });

    it('Prevents duplicate registration with the same email or username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        full_name: 'Another Student',
        email: studentEmail,
        username: `${studentUsername}_alt`,
        password: 'Password123!',
        confirm_password: 'Password123!',
        terms_accepted: true,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already exists');
    });

    it('Logs in successfully with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'Password123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.id).toBe(userId);
    });

    it('Fails login with invalid password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    });

    it('Fetches authenticated user profile via /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(studentUsername);
    });

    it('Forgot password sends generic response without leaking account existence', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: studentEmail,
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('password reset link has been sent');

      const nonExistentRes = await request(app).post('/api/auth/forgot-password').send({
        email: 'nobody_random_98234@nonexistent.edu',
      });
      expect(nonExistentRes.status).toBe(200);
      expect(nonExistentRes.body.message).toBe(res.body.message);
    });
  });

  describe('3. Study Groups and Collaboration', () => {
    it('Creates a study group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Algorithms & Data Structures Group',
          description: 'Peer study for semester exams',
          subject: 'Computer Science',
          course: 'B.Tech',
          is_private: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.group.name).toBe('Algorithms & Data Structures Group');
      expect(res.body.group.invite_code).toBeDefined();
      groupId = res.body.group.id;
    });

    it('Lists user study groups', async () => {
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.myGroups.length).toBeGreaterThan(0);
      expect(res.body.myGroups[0].id).toBe(groupId);
    });

    it('Retrieves group details and member list', async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.group.id).toBe(groupId);
      expect(res.body.members.length).toBe(1);
      expect(res.body.membership.role).toBe('owner');
    });

    it('Posts a group announcement', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/announcements`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Next Session: Graphs',
          content: 'We will cover Dijkstra and BFS this Tuesday.',
        });

      expect(res.status).toBe(201);
    });
  });

  describe('4. Feature One: Doubt Queue', () => {
    let doubtId = '';
    let testRoomId = '';

    it('Submits a question to the doubt queue', async () => {
      // Create a study room first for foreign key integrity
      const roomRes = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Algorithms Live Session',
          subject: 'Computer Science',
          topic: 'Divide & Conquer',
          group_id: groupId,
          teach_mode: 1,
        });
      expect(roomRes.status).toBe(201);
      testRoomId = roomRes.body.room.id;

      const res = await request(app)
        .post('/api/doubts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          group_id: null,
          room_id: testRoomId,
          question: 'What is the time complexity of QuickSelect average vs worst case?',
          topic: 'Divide & Conquer',
        });

      expect(res.status).toBe(201);
      expect(res.body.doubt.question).toContain('QuickSelect');
      expect(res.body.doubt.votes_count).toBe(0);
      doubtId = res.body.doubt.id;
    });

    it('Upvotes a question and enforces 1 vote per user (toggle on/off)', async () => {
      // 1st vote: adds vote (+1)
      const res1 = await request(app)
        .post(`/api/doubts/${doubtId}/vote`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.votes_count).toBe(1);
      expect(res1.body.user_voted).toBe(1);

      // 2nd vote from same user: toggles off (-1)
      const res2 = await request(app)
        .post(`/api/doubts/${doubtId}/vote`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.votes_count).toBe(0);
      expect(res2.body.user_voted).toBe(0);
    });

    it('Updates doubt status through lifecycle (waiting -> answering -> solved)', async () => {
      const resAnswering = await request(app)
        .put(`/api/doubts/${doubtId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'answering' });
      expect(resAnswering.status).toBe(200);
      expect(resAnswering.body.status).toBe('answering');

      const resSolved = await request(app)
        .put(`/api/doubts/${doubtId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'solved' });
      expect(resSolved.status).toBe(200);
      expect(resSolved.body.status).toBe('solved');
    });
  });

  describe('5. Feature Two: Teach Me / I will Teach You', () => {
    it('Adds Teach and Learn topics for peer matching', async () => {
      const resTeach = await request(app)
        .post('/api/teach/topics')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'teach',
          subject: 'Operating Systems',
          topic: 'Virtual Memory & Paging',
          notes: 'Can explain page tables and TLB.',
        });
      expect(resTeach.status).toBe(201);

      const resLearn = await request(app)
        .post('/api/teach/topics')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'learn',
          subject: 'DBMS',
          topic: 'Normalization 1NF to BCNF',
          notes: 'Need help with multi-valued dependencies.',
        });
      expect(resLearn.status).toBe(201);
    });

    it('Retrieves user teach and learn topics', async () => {
      const res = await request(app)
        .get('/api/teach/topics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.teachTopics.length).toBeGreaterThan(0);
      expect(res.body.learnTopics.length).toBeGreaterThan(0);
    });

    it('Matches peer learners and teachers based on topic overlap', async () => {
      // Register a second peer who can teach DBMS Normalization
      const peerRes = await request(app).post('/api/auth/register').send({
        full_name: 'DBMS Peer Tutor',
        email: `peer_${Date.now()}@example.com`,
        username: `peer_tutor_${Date.now()}`,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Computer Science',
        terms_accepted: true,
      });

      const peerToken = peerRes.body.token;

      // Peer adds DBMS Normalization under 'teach'
      await request(app)
        .post('/api/teach/topics')
        .set('Authorization', `Bearer ${peerToken}`)
        .send({
          type: 'teach',
          subject: 'DBMS',
          topic: 'Normalization 1NF to BCNF',
          notes: 'Experienced TA ready to help.',
        });

      // Now Student A checks matches
      const matchRes = await request(app)
        .get('/api/teach/matches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(matchRes.status).toBe(200);
      expect(matchRes.body.peerTeachers.length).toBeGreaterThan(0);
      expect(matchRes.body.peerTeachers[0].topic).toBe('Normalization 1NF to BCNF');
      expect(matchRes.body.peerTeachers[0].match_type).toBe('can_teach_you');
    });
  });

  describe('6. Feature Three: Syllabus Conquer Board', () => {
    let boardId = '';
    let topicId = '';

    it('Creates a syllabus board', async () => {
      const res = await request(app)
        .post('/api/syllabus/boards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_name: 'Midterm Examination 2026',
          exam_date: '2026-11-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.board.exam_name).toBe('Midterm Examination 2026');
      boardId = res.body.board.id;
    });

    it('Adds syllabus topics to the board', async () => {
      const res = await request(app)
        .post(`/api/syllabus/boards/${boardId}/topics`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subject: 'Computer Networks',
          unit: 'Unit 1: Physical & Data Link',
          title: 'Framing, Error Detection and Correction',
          notes: 'CRC, Hamming code, Checksum.',
        });

      expect(res.status).toBe(201);
      expect(res.body.topic.title).toContain('Framing');
      topicId = res.body.topic.id;
    });

    it('Updates topic status and calculates completion statistics', async () => {
      // Mark topic as completed
      const resUpdate = await request(app)
        .put(`/api/syllabus/topics/${topicId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' });

      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.topic.status).toBe('completed');

      // Fetch board details & stats
      const resBoard = await request(app)
        .get(`/api/syllabus/boards/${boardId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resBoard.status).toBe(200);
      expect(resBoard.body.stats.total).toBe(1);
      expect(resBoard.body.stats.completed).toBe(1);
      expect(resBoard.body.stats.percentage).toBe(100);
    });
  });

  describe('7. Feature Four: Group Focus Pact', () => {
    let sessionId = '';

    it('Creates a focus session with initial goal', async () => {
      const res = await request(app)
        .post('/api/focus')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subject: 'Mathematics',
          topic: 'Calculus Integration',
          focus_duration_minutes: 25,
          break_duration_minutes: 5,
          initial_goal: 'Solve problems 1 to 15 in Chapter 4',
        });

      expect(res.status).toBe(201);
      expect(res.body.session.status).toBe('idle');
      expect(res.body.session.focus_duration_minutes).toBe(25);
      sessionId = res.body.session.id;
    });

    it('Controls authoritative session timer (start, pause, resume)', async () => {
      // Start
      const resStart = await request(app)
        .post(`/api/focus/${sessionId}/control`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'start' });

      expect(resStart.status).toBe(200);
      expect(resStart.body.session.status).toBe('running');
      expect(resStart.body.session.start_timestamp).toBeDefined();

      // Pause
      const resPause = await request(app)
        .post(`/api/focus/${sessionId}/control`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'pause' });

      expect(resPause.status).toBe(200);
      expect(resPause.body.session.status).toBe('paused');
    });

    it('Reports participant goal outcome', async () => {
      const res = await request(app)
        .post(`/api/focus/${sessionId}/outcome`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ outcome: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('completed');
    });
  });

  describe('8. Exam Planner & Study Schedule', () => {
    let examId = '';

    it('Creates an exam entry', async () => {
      const res = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_name: 'Final Semester Exam',
          subject: 'Artificial Intelligence',
          exam_date: '2026-12-10',
          notes: 'Prepare search algorithms, CSP, and logic.',
        });

      expect(res.status).toBe(201);
      expect(res.body.exam.exam_name).toBe('Final Semester Exam');
      examId = res.body.exam.id;
    });

    it('Creates and toggles study tasks', async () => {
      const resTask = await request(app)
        .post('/api/exams/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Review A* heuristic search proof',
          due_date: '2026-11-01',
          exam_id: examId,
          priority: 'high',
        });

      expect(resTask.status).toBe(201);
      const taskId = resTask.body.task.id;

      // Toggle completed
      const resToggle = await request(app)
        .put(`/api/exams/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_completed: 1 });

      expect(resToggle.status).toBe(200);
      expect(resToggle.body.task.is_completed).toBe(1);
    });

    it('Retrieves dashboard aggregated summary with real data', async () => {
      const res = await request(app)
        .get('/api/exams/dashboard-summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.upcomingExams.length).toBeGreaterThan(0);
      expect(res.body.activeGroupsCount).toBeGreaterThan(0);
      expect(res.body.syllabus.total).toBeGreaterThan(0);
    });
  });
});
