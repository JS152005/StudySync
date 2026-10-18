import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET ALL SYLLABUS BOARDS (for current user and their groups)
router.get('/boards', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;
    const { group_id } = req.query;

    let boards: any[] = [];
    if (group_id) {
      boards = db.prepare(`
        SELECT sb.*, g.name as group_name,
               (SELECT COUNT(*) FROM syllabus_topics WHERE board_id = sb.id) as total_topics,
               (SELECT COUNT(*) FROM syllabus_topics WHERE board_id = sb.id AND status = 'completed') as completed_topics,
               (SELECT COUNT(*) FROM syllabus_topics WHERE board_id = sb.id AND status = 'in_progress') as in_progress_topics
        FROM syllabus_boards sb
        LEFT JOIN study_groups g ON g.id = sb.group_id
        WHERE sb.group_id = ?
        ORDER BY sb.created_at DESC
      `).all(group_id);
    } else {
      boards = db.prepare(`
        SELECT sb.*, g.name as group_name,
               (SELECT COUNT(*) FROM syllabus_topics WHERE board_id = sb.id) as total_topics,
               (SELECT COUNT(*) FROM syllabus_topics WHERE board_id = sb.id AND status = 'completed') as completed_topics,
               (SELECT COUNT(*) FROM syllabus_topics WHERE board_id = sb.id AND status = 'in_progress') as in_progress_topics
        FROM syllabus_boards sb
        LEFT JOIN study_groups g ON g.id = sb.group_id
        WHERE sb.user_id = ? OR sb.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active')
        ORDER BY sb.created_at DESC
      `).all(currentUserId, currentUserId);
    }

    // Compute completion percentage safely
    const computedBoards = boards.map((b) => {
      const percentage = b.total_topics > 0 ? Math.round((b.completed_topics / b.total_topics) * 100) : 0;
      return {
        ...b,
        completion_percentage: percentage,
        remaining_topics: b.total_topics - b.completed_topics,
      };
    });

    res.json({ boards: computedBoards });
  } catch (err: any) {
    console.error('[GET BOARDS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve syllabus boards.' });
  }
});

// 2. CREATE SYLLABUS BOARD
router.post('/boards', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { exam_name, exam_date, group_id } = req.body;
    const currentUserId = req.user!.id;

    if (!exam_name || exam_name.trim().length === 0) {
      res.status(400).json({ error: 'Exam name is required.' });
      return;
    }

    const boardId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO syllabus_boards (id, group_id, user_id, exam_name, exam_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(boardId, group_id || null, currentUserId, exam_name.trim(), exam_date || null, now, now);

    const created = db.prepare(`SELECT * FROM syllabus_boards WHERE id = ?`).get(boardId);
    res.status(201).json({ board: created });
  } catch (err: any) {
    console.error('[CREATE BOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to create board.' });
  }
});

// 3. GET SYLLABUS BOARD DETAILS & TOPICS
router.get('/boards/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const board = db.prepare(`SELECT * FROM syllabus_boards WHERE id = ?`).get(id) as any;
    if (!board) {
      res.status(404).json({ error: 'Board not found.' });
      return;
    }

    const topics = db.prepare(`
      SELECT st.*, u.full_name as assigned_to_name, u.username as assigned_to_username
      FROM syllabus_topics st
      LEFT JOIN users u ON u.id = st.assigned_to
      WHERE st.board_id = ?
      ORDER BY st.subject ASC, st.unit ASC, st.order_index ASC, st.created_at ASC
    `).all(id);

    const total = topics.length;
    const completed = topics.filter((t: any) => t.status === 'completed').length;
    const inProgress = topics.filter((t: any) => t.status === 'in_progress').length;
    const notStarted = topics.filter((t: any) => t.status === 'not_started').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      board,
      topics,
      stats: {
        total,
        completed,
        inProgress,
        notStarted,
        remaining: total - completed,
        percentage,
      },
    });
  } catch (err: any) {
    console.error('[GET BOARD DETAILS ERROR]', err);
    res.status(500).json({ error: 'Failed to load board.' });
  }
});

// 4. ADD TOPIC TO BOARD
router.post('/boards/:id/topics', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { subject, unit, title, assigned_to, notes } = req.body;

    if (!subject || !unit || !title) {
      res.status(400).json({ error: 'Subject, unit, and topic title are required.' });
      return;
    }

    const topicId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO syllabus_topics (id, board_id, subject, unit, title, status, assigned_to, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'not_started', ?, ?, ?, ?)
    `).run(topicId, id, subject.trim(), unit.trim(), title.trim(), assigned_to || null, notes?.trim() || '', now, now);

    const created = db.prepare(`
      SELECT st.*, u.full_name as assigned_to_name, u.username as assigned_to_username
      FROM syllabus_topics st
      LEFT JOIN users u ON u.id = st.assigned_to
      WHERE st.id = ?
    `).get(topicId);

    res.status(201).json({ topic: created });
  } catch (err: any) {
    console.error('[ADD BOARD TOPIC ERROR]', err);
    res.status(500).json({ error: 'Failed to add topic.' });
  }
});

// 5. UPDATE TOPIC (Status, Assignee, Notes)
router.put('/topics/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { status, assigned_to, notes, title, unit, subject } = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare(`SELECT * FROM syllabus_topics WHERE id = ?`).get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Topic not found.' });
      return;
    }

    db.prepare(`
      UPDATE syllabus_topics SET
        status = COALESCE(?, status),
        assigned_to = COALESCE(?, assigned_to),
        notes = COALESCE(?, notes),
        title = COALESCE(?, title),
        unit = COALESCE(?, unit),
        subject = COALESCE(?, subject),
        updated_at = ?
      WHERE id = ?
    `).run(
      status || null,
      assigned_to !== undefined ? assigned_to : null,
      notes !== undefined ? notes : null,
      title || null,
      unit || null,
      subject || null,
      now,
      id
    );

    const updated = db.prepare(`
      SELECT st.*, u.full_name as assigned_to_name, u.username as assigned_to_username
      FROM syllabus_topics st
      LEFT JOIN users u ON u.id = st.assigned_to
      WHERE st.id = ?
    `).get(id);

    res.json({ topic: updated });
  } catch (err: any) {
    console.error('[UPDATE TOPIC ERROR]', err);
    res.status(500).json({ error: 'Failed to update topic.' });
  }
});

// 6. DELETE TOPIC
router.delete('/topics/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM syllabus_topics WHERE id = ?`).run(id);
    res.json({ message: 'Topic deleted.' });
  } catch (err: any) {
    console.error('[DELETE TOPIC ERROR]', err);
    res.status(500).json({ error: 'Failed to delete topic.' });
  }
});

export default router;
