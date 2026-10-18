import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

const dbPath = path.resolve(process.cwd(), config.databasePath);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize native SQLite database from Node 22
const rawDb = new DatabaseSync(dbPath);

// Enable WAL mode and foreign key enforcement
rawDb.exec('PRAGMA journal_mode = WAL;');
rawDb.exec('PRAGMA foreign_keys = ON;');

export interface DBInterface {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): any;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
  pragma(pragmaStr: string): void;
}

export const db: DBInterface = {
  exec(sql: string) {
    rawDb.exec(sql);
  },
  prepare(sql: string) {
    const stmt = rawDb.prepare(sql);
    return {
      run(...params: any[]) {
        return stmt.run(...params);
      },
      get(...params: any[]) {
        return stmt.get(...params);
      },
      all(...params: any[]) {
        return stmt.all(...params);
      },
    };
  },
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      rawDb.exec('BEGIN;');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT;');
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK;');
        throw err;
      }
    };
  },
  pragma(pragmaStr: string) {
    rawDb.exec(`PRAGMA ${pragmaStr};`);
  },
};

export function initDatabase() {
  const schema = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      course TEXT,
      college TEXT,
      academic_year TEXT,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      is_verified INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      availability TEXT DEFAULT 'available',
      privacy_email INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    -- Email Verification Tokens
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Password Reset Tokens
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Friendships and Connection Requests
    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'declined', 'blocked')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, friend_id)
    );

    CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

    -- Study Groups
    CREATE TABLE IF NOT EXISTS study_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      course TEXT DEFAULT '',
      is_private INTEGER DEFAULT 0,
      invite_code TEXT UNIQUE,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    -- Group Members
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'moderator', 'member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending_approval')),
      joined_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );

    -- Group Announcements
    CREATE TABLE IF NOT EXISTS group_announcements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Direct and Group Messages
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_type TEXT NOT NULL CHECK(conversation_type IN ('direct', 'group')),
      group_id TEXT,
      sender_id TEXT NOT NULL,
      recipient_id TEXT,
      content TEXT NOT NULL,
      attachment_url TEXT,
      attachment_name TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
    CREATE INDEX IF NOT EXISTS idx_messages_direct ON messages(sender_id, recipient_id);

    -- Live Study Rooms
    CREATE TABLE IF NOT EXISTS study_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT DEFAULT '',
      topic TEXT DEFAULT '',
      group_id TEXT,
      host_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      teach_mode INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE SET NULL,
      FOREIGN KEY(host_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Room Participants
    CREATE TABLE IF NOT EXISTS room_participants (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_hand_raised INTEGER DEFAULT 0,
      joined_at TEXT NOT NULL,
      left_at TEXT,
      FOREIGN KEY(room_id) REFERENCES study_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Collaborative Whiteboard
    CREATE TABLE IF NOT EXISTS whiteboard_sessions (
      id TEXT PRIMARY KEY,
      room_id TEXT UNIQUE NOT NULL,
      canvas_data TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(room_id) REFERENCES study_rooms(id) ON DELETE CASCADE
    );

    -- Feature One: Doubt Queue
    CREATE TABLE IF NOT EXISTS doubts (
      id TEXT PRIMARY KEY,
      room_id TEXT,
      group_id TEXT,
      author_id TEXT NOT NULL,
      question TEXT NOT NULL,
      topic TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'answering', 'solved')),
      votes_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(room_id) REFERENCES study_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_doubts_room ON doubts(room_id);
    CREATE INDEX IF NOT EXISTS idx_doubts_group ON doubts(group_id);

    -- Doubt Votes
    CREATE TABLE IF NOT EXISTS doubt_votes (
      id TEXT PRIMARY KEY,
      doubt_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(doubt_id) REFERENCES doubts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(doubt_id, user_id)
    );

    -- Feature Two: Teach Me / I'll Teach You (User Topics)
    CREATE TABLE IF NOT EXISTS user_topics (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('teach', 'learn')),
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_topics ON user_topics(subject, topic);

    -- Peer Requests (Teach/Learn study requests)
    CREATE TABLE IF NOT EXISTS peer_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Feature Three: Syllabus Conquer Boards
    CREATE TABLE IF NOT EXISTS syllabus_boards (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      user_id TEXT,
      exam_name TEXT NOT NULL,
      exam_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Syllabus Topics
    CREATE TABLE IF NOT EXISTS syllabus_topics (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      unit TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed')),
      assigned_to TEXT,
      notes TEXT DEFAULT '',
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(board_id) REFERENCES syllabus_boards(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_syllabus_topics_board ON syllabus_topics(board_id);

    -- Feature Four: Group Focus Pact
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      host_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT DEFAULT '',
      focus_duration_minutes INTEGER NOT NULL DEFAULT 25,
      break_duration_minutes INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'paused', 'break', 'completed')),
      phase TEXT NOT NULL DEFAULT 'focus' CHECK(phase IN ('focus', 'break')),
      start_timestamp INTEGER,
      pause_timestamp INTEGER,
      elapsed_before_pause INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(host_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Focus Participant Goals
    CREATE TABLE IF NOT EXISTS focus_participant_goals (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      goal_text TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending', 'completed', 'partially_completed', 'not_completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(session_id, user_id)
    );

    -- Exam Planner & Examinations
    CREATE TABLE IF NOT EXISTS examinations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Study Tasks
    CREATE TABLE IF NOT EXISTS study_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_id TEXT,
      board_topic_id TEXT,
      title TEXT NOT NULL,
      due_date TEXT,
      is_completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(exam_id) REFERENCES examinations(id) ON DELETE SET NULL,
      FOREIGN KEY(board_topic_id) REFERENCES syllabus_topics(id) ON DELETE SET NULL
    );

    -- Resources
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      group_id TEXT,
      room_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      file_type TEXT NOT NULL CHECK(file_type IN ('pdf', 'image', 'document', 'whiteboard', 'note', 'link')),
      file_url TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      original_name TEXT,
      is_public INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES study_groups(id) ON DELETE SET NULL,
      FOREIGN KEY(room_id) REFERENCES study_rooms(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);
    CREATE INDEX IF NOT EXISTS idx_resources_group ON resources(group_id);
  `;

  rawDb.exec(schema);
  console.log('[DB] Database schema initialized successfully with node:sqlite.');
}
