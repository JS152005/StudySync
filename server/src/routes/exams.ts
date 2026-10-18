import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET ALL EXAMS & STUDY TASKS
router.get('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const exams = db.prepare(`
      SELECT e.*,
             (SELECT COUNT(*) FROM study_tasks WHERE exam_id = e.id) as total_tasks,
             (SELECT COUNT(*) FROM study_tasks WHERE exam_id = e.id AND is_completed = 1) as completed_tasks
      FROM examinations e
      WHERE e.user_id = ?
      ORDER BY e.exam_date ASC
    `).all(currentUserId);

    const tasks = db.prepare(`
      SELECT st.*, e.exam_name, e.subject as exam_subject, syt.title as syllabus_topic_title
      FROM study_tasks st
      LEFT JOIN examinations e ON e.id = st.exam_id
      LEFT JOIN syllabus_topics syt ON syt.id = st.board_topic_id
      WHERE st.user_id = ?
      ORDER BY st.is_completed ASC, st.due_date ASC, st.created_at DESC
    `).all(currentUserId);

    res.json({ exams, tasks });
  } catch (err: any) {
    console.error('[GET EXAMS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve exams and tasks.' });
  }
});

// 2. CREATE EXAMINATION
router.post('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { exam_name, subject, exam_date, notes } = req.body;
    const currentUserId = req.user!.id;

    if (!exam_name || !subject || !exam_date) {
      res.status(400).json({ error: 'Exam name, subject, and exam date are required.' });
      return;
    }

    const examId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO examinations (id, user_id, exam_name, subject, exam_date, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(examId, currentUserId, exam_name.trim(), subject.trim(), exam_date, notes?.trim() || '', now);

    const created = db.prepare(`SELECT * FROM examinations WHERE id = ?`).get(examId);
    res.status(201).json({ exam: created });
  } catch (err: any) {
    console.error('[CREATE EXAM ERROR]', err);
    res.status(500).json({ error: 'Failed to create exam.' });
  }
});

// 3. DELETE EXAMINATION
router.delete('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    db.prepare(`DELETE FROM examinations WHERE id = ? AND user_id = ?`).run(id, currentUserId);
    res.json({ message: 'Exam deleted.' });
  } catch (err: any) {
    console.error('[DELETE EXAM ERROR]', err);
    res.status(500).json({ error: 'Failed to delete exam.' });
  }
});

// 4. CREATE STUDY TASK
router.post('/tasks', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { title, due_date, exam_id, board_topic_id, priority } = req.body;
    const currentUserId = req.user!.id;

    if (!title || title.trim().length === 0) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }

    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO study_tasks (id, user_id, exam_id, board_topic_id, title, due_date, is_completed, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      taskId,
      currentUserId,
      exam_id || null,
      board_topic_id || null,
      title.trim(),
      due_date || null,
      priority || 'medium',
      now,
      now
    );

    const created = db.prepare(`SELECT * FROM study_tasks WHERE id = ?`).get(taskId);
    res.status(201).json({ task: created });
  } catch (err: any) {
    console.error('[CREATE TASK ERROR]', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// 5. UPDATE STUDY TASK (Toggle complete, change due date, etc.)
router.put('/tasks/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { is_completed, title, due_date, priority } = req.body;
    const currentUserId = req.user!.id;
    const now = new Date().toISOString();

    const task = db.prepare(`SELECT * FROM study_tasks WHERE id = ? AND user_id = ?`).get(id, currentUserId) as any;
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    db.prepare(`
      UPDATE study_tasks SET
        is_completed = COALESCE(?, is_completed),
        title = COALESCE(?, title),
        due_date = COALESCE(?, due_date),
        priority = COALESCE(?, priority),
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      is_completed !== undefined ? (is_completed ? 1 : 0) : null,
      title || null,
      due_date || null,
      priority || null,
      now,
      id,
      currentUserId
    );

    const updated = db.prepare(`SELECT * FROM study_tasks WHERE id = ?`).get(id);
    res.json({ task: updated });
  } catch (err: any) {
    console.error('[UPDATE TASK ERROR]', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// 6. DELETE STUDY TASK
router.delete('/tasks/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    db.prepare(`DELETE FROM study_tasks WHERE id = ? AND user_id = ?`).run(id, currentUserId);
    res.json({ message: 'Task deleted.' });
  } catch (err: any) {
    console.error('[DELETE TASK ERROR]', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// 7. DASHBOARD AGGREGATED METRICS
router.get('/dashboard-summary', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const upcomingExams = db.prepare(`
      SELECT * FROM examinations WHERE user_id = ? AND exam_date >= date('now')
      ORDER BY exam_date ASC LIMIT 3
    `).all(currentUserId);

    const todayTasks = db.prepare(`
      SELECT * FROM study_tasks WHERE user_id = ? AND (due_date <= date('now') OR due_date IS NULL) AND is_completed = 0
      ORDER BY priority DESC, created_at ASC LIMIT 5
    `).all(currentUserId);

    const activeGroupsCount = db.prepare(`
      SELECT COUNT(*) as count FROM group_members WHERE user_id = ? AND status = 'active'
    `).get(currentUserId) as { count: number };

    const liveRooms = db.prepare(`
      SELECT r.*, u.full_name as host_name
      FROM study_rooms r
      JOIN users u ON u.id = r.host_id
      WHERE r.is_active = 1
        AND (r.group_id IS NULL OR r.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active'))
      LIMIT 3
    `).all(currentUserId);

    const openDoubtsCount = db.prepare(`
      SELECT COUNT(*) as count FROM doubts WHERE author_id = ? AND status != 'solved'
    `).get(currentUserId) as { count: number };

    const totalTopics = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM syllabus_topics st
      JOIN syllabus_boards sb ON sb.id = st.board_id
      WHERE sb.user_id = ? OR sb.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active')
    `).get(currentUserId, currentUserId) as any;

    const completed = totalTopics?.completed || 0;
    const total = totalTopics?.total || 0;
    const syllabusPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      upcomingExams,
      todayTasks,
      activeGroupsCount: activeGroupsCount.count,
      liveRooms,
      openDoubtsCount: openDoubtsCount.count,
      syllabus: {
        total,
        completed,
        percentage: syllabusPercentage,
      },
    });
  } catch (err: any) {
    console.error('[DASHBOARD SUMMARY ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics.' });
  }
});

export default router;
