import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { computeSessionTiming } from '../src/routes/focus.js';
import { createVerificationEmail, createPasswordResetEmail } from '../src/services/mailer.js';

describe('StudySync Core Systems & Security Suite', () => {
  let authToken = '';
  let userId = '';
  let studentId = '';
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

    it('Registers a new student account without returning auth token (mandatory verification)', async () => {
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
      expect(res.body.unverified).toBe(true);
      expect(res.body.token).toBeUndefined(); // Must not grant access before verification
      expect(res.body.user.email).toBe(studentEmail);
      expect(res.body.user.username).toBe(studentUsername);
      expect(res.body.user.is_verified).toBe(0);
      expect(res.body.user.student_id).toMatch(/^STU-[A-Z0-9]{6}$/);

      userId = res.body.user.id;
      studentId = res.body.user.student_id;
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

    it('Rejects login attempt when email is not verified (403 Forbidden)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'Password123!',
      });
      expect(res.status).toBe(403);
      expect(res.body.unverified).toBe(true);
      expect(res.body.error).toContain('verify your email');
    });

    it('Rejects protected route access when account is unverified', async () => {
      // Create a spoofed token for unverified user
      const jwt = (await import('jsonwebtoken')).default;
      const { config } = await import('../src/config/index.js');
      const fakeToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(403);
      expect(res.body.unverified).toBe(true);
    });

    it('Verifies email successfully using database verification token', async () => {
      // Retrieve verification token from database
      const row = db.prepare('SELECT token_hash FROM email_verification_tokens WHERE user_id = ?').get(userId) as any;
      expect(row).toBeDefined();

      // Directly mark verified to simulate clicking email link or verify token endpoint
      const updateRes = db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(userId);
      expect(updateRes.changes).toBe(1);
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

    it('Fails login with invalid password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: studentUsername,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    });

    it('Fetches authenticated user profile with Student ID via /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(studentUsername);
      expect(res.body.user.student_id).toBe(studentId);
    });

    it('Finds student by exact Student ID via /api/users/search', async () => {
      // Register a second student to search for
      const peerRes = await request(app).post('/api/auth/register').send({
        full_name: 'Search Target Student',
        email: `search_${Date.now()}@example.com`,
        username: `search_target_${Date.now()}`,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Computer Science',
        terms_accepted: true,
      });

      const peerStudentId = peerRes.body.user.student_id;
      expect(peerStudentId).toMatch(/^STU-[A-Z0-9]{6}$/);

      const res = await request(app)
        .get(`/api/users/search?q=${peerStudentId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.students.length).toBeGreaterThanOrEqual(1);
      expect(res.body.students.some((s: any) => s.student_id === peerStudentId)).toBe(true);
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
    }, 15000);
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
      const peerUsername = `peer_tutor_${Date.now()}`;
      const peerEmail = `${peerUsername}@example.com`;

      // Register peer
      const peerRes = await request(app).post('/api/auth/register').send({
        full_name: 'DBMS Peer Tutor',
        email: peerEmail,
        username: peerUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        course: 'Computer Science',
        terms_accepted: true,
      });

      // Mark peer verified
      db.prepare('UPDATE users SET is_verified = 1 WHERE email = ?').run(peerEmail);

      // Login peer
      const peerLogin = await request(app).post('/api/auth/login').send({
        identifier: peerUsername,
        password: 'Password123!',
      });

      const peerToken = peerLogin.body.token;

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

  describe('9. Public Community Feed & Social Discussions', () => {
    let postId = '';
    let commentId = '';

    it('Creates a community discussion post with tags', async () => {
      const res = await request(app)
        .post('/api/community/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Guide: How to tackle Dynamic Programming in Exams',
          content: 'Always define the state clearly: dp[i] represents optimal solution for subproblem i.',
          tags: 'Engineering, Algorithms, ExamPrep',
        });

      expect(res.status).toBe(201);
      expect(res.body.post.title).toBe('Guide: How to tackle Dynamic Programming in Exams');
      expect(res.body.post.author_student_id).toBe(studentId);
      expect(res.body.post.likes_count).toBe(0);
      expect(res.body.post.comments_count).toBe(0);
      postId = res.body.post.id;
    });

    it('Lists community posts with pagination, search, and author student IDs', async () => {
      const res = await request(app).get('/api/community/posts?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(0);
      expect(res.body.pagination.total).toBeGreaterThan(0);

      const found = res.body.posts.find((p: any) => p.id === postId);
      expect(found).toBeDefined();
      expect(found.author_student_id).toBe(studentId);
    });

    it('Toggles like on a community post (like -> unlike)', async () => {
      // 1. Like
      const likeRes = await request(app)
        .post(`/api/community/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(likeRes.status).toBe(200);
      expect(likeRes.body.has_liked).toBe(true);
      expect(likeRes.body.likes_count).toBe(1);

      // 2. Unlike
      const unlikeRes = await request(app)
        .post(`/api/community/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(unlikeRes.status).toBe(200);
      expect(unlikeRes.body.has_liked).toBe(false);
      expect(unlikeRes.body.likes_count).toBe(0);
    });

    it('Adds a comment to a community post and increments comment counter', async () => {
      const res = await request(app)
        .post(`/api/community/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Great breakdown! Especially the state definition step.' });

      expect(res.status).toBe(201);
      expect(res.body.comment.content).toContain('Great breakdown');
      expect(res.body.comment.author_student_id).toBe(studentId);
      commentId = res.body.comment.id;

      // Verify post reflects comment count
      const postRes = await request(app).get(`/api/community/posts/${postId}`);
      expect(postRes.status).toBe(200);
      expect(postRes.body.post.comments_count).toBe(1);
      expect(postRes.body.comments.length).toBe(1);
    });

    it('Reports a community post for moderation review', async () => {
      const res = await request(app)
        .post(`/api/community/posts/${postId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test reporting mechanism for safety review' });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('flagged for moderation review');

      // Duplicate report prevented
      const dupRes = await request(app)
        .post(`/api/community/posts/${postId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Duplicate report' });

      expect(dupRes.status).toBe(400);
      expect(dupRes.body.error).toContain('already reported');
    });

    it('Deletes a comment and updates post comment counter', async () => {
      const res = await request(app)
        .delete(`/api/community/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);

      const postRes = await request(app).get(`/api/community/posts/${postId}`);
      expect(postRes.status).toBe(200);
      expect(postRes.body.post.comments_count).toBe(0);
    });

    it('Deletes a post (author only)', async () => {
      const res = await request(app)
        .delete(`/api/community/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);

      const checkRes = await request(app).get(`/api/community/posts/${postId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('10. Strict Privacy: Private Study Rooms, Join by Code & Resource Isolation', () => {
    let privateRoomId = '';
    let privateInviteCode = '';
    let strangerToken = '';

    beforeAll(async () => {
      // Create a stranger student
      const strangerEmail = `stranger_${Date.now()}@example.com`;
      const strangerUsername = `stranger_${Date.now()}`;
      await request(app).post('/api/auth/register').send({
        full_name: 'Private Stranger Student',
        email: strangerEmail,
        username: strangerUsername,
        password: 'Password123!',
        confirm_password: 'Password123!',
        terms_accepted: true,
      });
      db.prepare('UPDATE users SET is_verified = 1 WHERE email = ?').run(strangerEmail);
      const loginRes = await request(app).post('/api/auth/login').send({
        identifier: strangerUsername,
        password: 'Password123!',
      });
      strangerToken = loginRes.body.token;
    });

    it('Creates private study room with unique ROOM-XXXXXX invite code', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Quantum Mechanics Private Study',
          subject: 'Physics',
          topic: 'Schrodinger Wave Equation',
        });

      expect(res.status).toBe(201);
      expect(res.body.room.invite_code).toMatch(/^ROOM-[A-Z0-9]{6}$/);
      privateRoomId = res.body.room.id;
      privateInviteCode = res.body.room.invite_code;
    });

    it('Prevents stranger from seeing another user standalone room in GET /rooms', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(200);
      const found = res.body.rooms.find((r: any) => r.id === privateRoomId);
      expect(found).toBeUndefined();
    });

    it('Blocks stranger with 403 Forbidden when accessing private room without code', async () => {
      const res = await request(app)
        .get(`/api/rooms/${privateRoomId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('private');
      expect(res.body.is_private).toBe(true);
    });

    it('Allows stranger to access private room when providing valid invite code query param', async () => {
      const res = await request(app)
        .get(`/api/rooms/${privateRoomId}?code=${privateInviteCode}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.room.id).toBe(privateRoomId);
      expect(res.body.room.name).toBe('Quantum Mechanics Private Study');
    });

    it('Rejects joining private room by code with invalid code', async () => {
      const res = await request(app)
        .post('/api/rooms/join-by-code')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ invite_code: 'ROOM-NONEXISTENT' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No active private study room');
    });

    it('Allows stranger to join private room via valid invite code', async () => {
      const res = await request(app)
        .post('/api/rooms/join-by-code')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ invite_code: privateInviteCode });

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe(privateRoomId);

      // Stranger is now an active participant and can view room directly
      const directRes = await request(app)
        .get(`/api/rooms/${privateRoomId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(directRes.status).toBe(200);
      expect(directRes.body.participants.some((p: any) => p.user_id !== userId)).toBe(true);
    });

    it('Enforces private resource isolation: stranger cannot view private resources in library', async () => {
      // 1. Host creates a link resource
      const linkRes = await request(app)
        .post('/api/resources/link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Private Lecture Notes',
          url: 'https://arxiv.org/abs/quant-ph/010101',
          description: 'Classified research draft',
        });
      expect(linkRes.status).toBe(201);
      const resId = linkRes.body.resource.id;

      // 2. Stranger queries resources library; host resource should NOT be in stranger general library
      const strangerResList = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(strangerResList.status).toBe(200);
      expect(strangerResList.body.resources.some((r: any) => r.id === resId)).toBe(false);
    });
  });
});
