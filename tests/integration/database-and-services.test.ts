import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { db, generateStudentId, generateRoomInviteCode } from '../../server/src/db/index.js';

describe('StudySync Integration & Database Persistence Suite', () => {
  let testUserId = '';
  let testUserEmail = '';
  let testStudentId = '';
  let testGroupId = '';
  let testRoomId = '';

  beforeAll(() => {
    testUserId = crypto.randomUUID();
    testStudentId = generateStudentId();
    testUserEmail = `integ_${Date.now()}@example.com`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Integration Test User', 'hashed_pass_placeholder', 1, 1, ?, ?)
    `).run(testUserId, testStudentId, testUserEmail, `integ_${Date.now()}`, now, now);
  });

  describe('1. SQLite Pragmas & Foreign Key Enforcement', () => {
    it('Enforces foreign key constraints: rejects orphan child records', () => {
      const nonExistentUserId = crypto.randomUUID();
      const fakeRoomId = crypto.randomUUID();
      const now = new Date().toISOString();

      expect(() => {
        db.prepare(`
          INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, joined_at)
          VALUES (?, ?, ?, 0, ?)
        `).run(crypto.randomUUID(), fakeRoomId, nonExistentUserId, now);
      }).toThrow();
    });

    it('Enforces unique constraint on user student_id', () => {
      const duplicateUserId = crypto.randomUUID();
      const now = new Date().toISOString();

      expect(() => {
        db.prepare(`
          INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
          VALUES (?, ?, 'dup@example.com', 'dup_user_unique', 'Duplicate User', 'hash', 1, 1, ?, ?)
        `).run(duplicateUserId, testStudentId, now, now);
      }).toThrow();
    });

    it('Enforces unique constraint on users email', () => {
      const duplicateUserId = crypto.randomUUID();
      const newStudentId = generateStudentId();
      const now = new Date().toISOString();

      expect(() => {
        db.prepare(`
          INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'different_username_here', 'Another User', 'hash', 1, 1, ?, ?)
        `).run(duplicateUserId, newStudentId, testUserEmail, now, now);
      }).toThrow();
    });
  });

  describe('2. Transactional Integrity & Rollback Verification', () => {
    it('Transaction commits all changes when execution succeeds', () => {
      const groupId = crypto.randomUUID();
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const now = new Date().toISOString();

      db.transaction(() => {
        db.prepare(`
          INSERT INTO study_groups (id, name, description, is_private, invite_code, created_by, created_at, updated_at)
          VALUES (?, 'Transaction Commit Group', 'Desc', 1, ?, ?, ?, ?)
        `).run(groupId, inviteCode, testUserId, now, now);

        db.prepare(`
          INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
          VALUES (?, ?, ?, 'owner', 'active', ?)
        `).run(crypto.randomUUID(), groupId, testUserId, now);
      })();

      const group = db.prepare('SELECT id, name FROM study_groups WHERE id = ?').get(groupId) as any;
      const member = db.prepare('SELECT id, role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, testUserId) as any;

      expect(group).toBeDefined();
      expect(group.name).toBe('Transaction Commit Group');
      expect(member).toBeDefined();
      expect(member.role).toBe('owner');
      testGroupId = groupId;
    });

    it('Transaction rolls back completely when an error occurs halfway', () => {
      const failedGroupId = crypto.randomUUID();
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const now = new Date().toISOString();

      expect(() => {
        db.transaction(() => {
          db.prepare(`
            INSERT INTO study_groups (id, name, description, is_private, invite_code, created_by, created_at, updated_at)
            VALUES (?, 'Failed Rollback Group', 'Desc', 1, ?, ?, ?, ?)
          `).run(failedGroupId, inviteCode, testUserId, now, now);

          // Force an intentional constraint error (foreign key to non-existent user)
          db.prepare(`
            INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
            VALUES (?, ?, ?, 'owner', 'active', ?)
          `).run(crypto.randomUUID(), failedGroupId, 'non_existent_user_99999', now);
        })();
      }).toThrow();

      // Verify that failedGroupId was NOT inserted (rollback successful!)
      const groupCheck = db.prepare('SELECT id FROM study_groups WHERE id = ?').get(failedGroupId);
      expect(groupCheck).toBeUndefined();
    });
  });

  describe('3. Collaborative Whiteboard Action Persistence & Sequencing', () => {
    it('Persists drawing actions with monotonic sequence numbers in database', () => {
      testRoomId = crypto.randomUUID();
      const now = new Date().toISOString();
      const roomInvite = generateRoomInviteCode();

      db.prepare(`
        INSERT INTO study_rooms (id, name, subject, topic, host_id, invite_code, is_active, teach_mode, created_at)
        VALUES (?, 'Whiteboard DB Room', 'CS', 'Algorithms', ?, ?, 1, 0, ?)
      `).run(testRoomId, testUserId, roomInvite, now);

      // Insert 3 sequential actions
      for (let seq = 1; seq <= 3; seq++) {
        const actionId = crypto.randomUUID();
        const payload = JSON.stringify({ type: 'draw', seq, color: '#0F172A', points: [[0, 0], [seq * 10, seq * 10]] });
        db.prepare(`
          INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
          VALUES (?, ?, ?, ?, 'draw', ?, ?)
        `).run(actionId, testRoomId, seq, testUserId, payload, now);
      }

      const actions = db.prepare(`
        SELECT sequence_number, action_type, payload FROM whiteboard_actions
        WHERE room_id = ? ORDER BY sequence_number ASC
      `).all(testRoomId) as any[];

      expect(actions.length).toBe(3);
      expect(actions[0].sequence_number).toBe(1);
      expect(actions[1].sequence_number).toBe(2);
      expect(actions[2].sequence_number).toBe(3);

      const maxSeqRow = db.prepare(`SELECT MAX(sequence_number) as max_seq FROM whiteboard_actions WHERE room_id = ?`).get(testRoomId) as any;
      expect(maxSeqRow.max_seq).toBe(3);
    });

    it('Whiteboard clear action persists in sequence without deleting past history records', () => {
      const now = new Date().toISOString();
      const clearActionId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
        VALUES (?, ?, 4, ?, 'clear', '{}', ?)
      `).run(clearActionId, testRoomId, testUserId, now);

      const totalActions = db.prepare(`SELECT COUNT(*) as cnt FROM whiteboard_actions WHERE room_id = ?`).get(testRoomId) as any;
      expect(totalActions.cnt).toBe(4);

      const latestAction = db.prepare(`
        SELECT sequence_number, action_type FROM whiteboard_actions
        WHERE room_id = ? ORDER BY sequence_number DESC LIMIT 1
      `).get(testRoomId) as any;
      expect(latestAction.sequence_number).toBe(4);
      expect(latestAction.action_type).toBe('clear');
    });
  });

  describe('4. Doubt Queue & Peer Tutoring Matchmaker', () => {
    it('Doubt queue: creates doubt and tracks single vote per user', () => {
      const doubtId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO doubts (id, room_id, group_id, author_id, question, topic, status, votes_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'How does Dijkstra handle negative weights?', 'Graph Algorithms', 'waiting', 0, ?, ?)
      `).run(doubtId, testRoomId, testGroupId, testUserId, now, now);

      // Cast vote
      db.prepare(`
        INSERT INTO doubt_votes (id, doubt_id, user_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(crypto.randomUUID(), doubtId, testUserId, now);

      db.prepare('UPDATE doubts SET votes_count = votes_count + 1 WHERE id = ?').run(doubtId);

      const doubt = db.prepare('SELECT * FROM doubts WHERE id = ?').get(doubtId) as any;
      expect(doubt.votes_count).toBe(1);
      expect(doubt.status).toBe('waiting');

      // Duplicate vote rejection
      expect(() => {
        db.prepare(`
          INSERT INTO doubt_votes (id, doubt_id, user_id, created_at)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), doubtId, testUserId, now);
      }).toThrow();
    });

    it('Peer tutoring matchmaker: finds overlapping teach and learn topics', () => {
      const learnerId = crypto.randomUUID();
      const teacherId = crypto.randomUUID();
      const now = new Date().toISOString();
      const rand = Date.now();

      db.prepare(`
        INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Learner Student', 'hash', 1, 1, ?, ?)
      `).run(learnerId, generateStudentId(), `learner_${rand}@example.com`, `learner_${rand}`, now, now);

      db.prepare(`
        INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Teacher Student', 'hash', 1, 1, ?, ?)
      `).run(teacherId, generateStudentId(), `teacher_${rand}@example.com`, `teacher_${rand}`, now, now);

      const uniqueSubject = `Math_${crypto.randomUUID().slice(0, 8)}`;
      const uniqueTopic = `Calc_${crypto.randomUUID().slice(0, 8)}`;

      // Teacher teaches Calculus
      db.prepare(`
        INSERT INTO user_topics (id, user_id, type, subject, topic, notes, created_at)
        VALUES (?, ?, 'teach', ?, ?, 'Ready to help', ?)
      `).run(crypto.randomUUID(), teacherId, uniqueSubject, uniqueTopic, now);

      // Learner needs help with Calculus
      db.prepare(`
        INSERT INTO user_topics (id, user_id, type, subject, topic, notes, created_at)
        VALUES (?, ?, 'learn', ?, ?, 'Struggling with Stoke theorem', ?)
      `).run(crypto.randomUUID(), learnerId, uniqueSubject, uniqueTopic, now);

      // Overlap query
      const matches = db.prepare(`
        SELECT t.user_id as teacher_id, l.user_id as learner_id, t.subject, t.topic
        FROM user_topics t
        JOIN user_topics l ON LOWER(t.subject) = LOWER(l.subject) AND LOWER(t.topic) = LOWER(l.topic)
        WHERE t.type = 'teach' AND l.type = 'learn' AND t.user_id != l.user_id
          AND t.subject = ? AND t.topic = ?
      `).all(uniqueSubject, uniqueTopic) as any[];

      expect(matches.length).toBe(1);
      expect(matches[0].teacher_id).toBe(teacherId);
      expect(matches[0].learner_id).toBe(learnerId);
    });
  });
});
