import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper: derive authoritative time remaining in milliseconds
export function computeSessionTiming(session: any) {
  const targetDurationMs = (session.phase === 'focus' ? session.focus_duration_minutes : session.break_duration_minutes) * 60 * 1000;
  const now = Date.now();

  let elapsedMs = session.elapsed_before_pause || 0;
  if (session.status === 'running' && session.start_timestamp) {
    elapsedMs += (now - session.start_timestamp);
  }

  let remainingMs = Math.max(0, targetDurationMs - elapsedMs);

  return {
    elapsedMs,
    remainingMs,
    targetDurationMs,
    isExpired: session.status === 'running' && remainingMs === 0,
  };
}

// 1. LIST RECENT OR ACTIVE FOCUS SESSIONS
router.get('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const sessions = db.prepare(`
      SELECT fs.*, u.full_name as host_name, u.username as host_username,
             g.name as group_name,
             (SELECT COUNT(*) FROM focus_participant_goals WHERE session_id = fs.id) as participant_count
      FROM focus_sessions fs
      JOIN users u ON u.id = fs.host_id
      LEFT JOIN study_groups g ON g.id = fs.group_id
      WHERE fs.host_id = ?
         OR fs.id IN (SELECT session_id FROM focus_participant_goals WHERE user_id = ?)
         OR (fs.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active'))
      ORDER BY fs.created_at DESC LIMIT 20
    `).all(currentUserId, currentUserId, currentUserId);

    res.json({ sessions });
  } catch (err: any) {
    console.error('[GET FOCUS SESSIONS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve focus sessions.' });
  }
});

// 2. CREATE A GROUP FOCUS SESSION
router.post('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { subject, topic, focus_duration_minutes, break_duration_minutes, group_id, initial_goal } = req.body;
    const currentUserId = req.user!.id;

    if (!subject || subject.trim().length === 0) {
      res.status(400).json({ error: 'Subject is required.' });
      return;
    }

    const focusMins = parseInt(focus_duration_minutes || '25', 10);
    const breakMins = parseInt(break_duration_minutes || '5', 10);
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO focus_sessions (
          id, group_id, host_id, subject, topic,
          focus_duration_minutes, break_duration_minutes,
          status, phase, start_timestamp, pause_timestamp, elapsed_before_pause,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', 'focus', NULL, NULL, 0, ?)
      `).run(
        sessionId,
        group_id || null,
        currentUserId,
        subject.trim(),
        topic?.trim() || '',
        focusMins,
        breakMins,
        now
      );

      // Register host's initial goal
      if (initial_goal && initial_goal.trim().length > 0) {
        db.prepare(`
          INSERT INTO focus_participant_goals (id, session_id, user_id, goal_text, outcome, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).run(crypto.randomUUID(), sessionId, currentUserId, initial_goal.trim(), now, now);
      }
    })();

    const session = db.prepare(`SELECT * FROM focus_sessions WHERE id = ?`).get(sessionId);
    res.status(201).json({ session });
  } catch (err: any) {
    console.error('[CREATE FOCUS SESSION ERROR]', err);
    res.status(500).json({ error: 'Failed to create focus session.' });
  }
});

// 3. GET FOCUS SESSION DETAILS & AUTHORITATIVE TIMING
router.get('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const session = db.prepare(`
      SELECT fs.*, u.full_name as host_name, u.username as host_username, g.name as group_name
      FROM focus_sessions fs
      JOIN users u ON u.id = fs.host_id
      LEFT JOIN study_groups g ON g.id = fs.group_id
      WHERE fs.id = ?
    `).get(id) as any;

    if (!session) {
      res.status(404).json({ error: 'Focus session not found.' });
      return;
    }

    const timing = computeSessionTiming(session);

    // If timer expired while running, auto-advance phase or mark completed
    if (timing.isExpired) {
      const now = new Date().toISOString();
      if (session.phase === 'focus') {
        // Transition to break
        db.prepare(`
          UPDATE focus_sessions SET phase = 'break', status = 'paused', start_timestamp = NULL, elapsed_before_pause = 0
          WHERE id = ?
        `).run(id);
        session.phase = 'break';
        session.status = 'paused';
      } else {
        // Complete session
        db.prepare(`
          UPDATE focus_sessions SET status = 'completed', ended_at = ?
          WHERE id = ?
        `).run(now, id);
        session.status = 'completed';
      }
    }

    const participants = db.prepare(`
      SELECT fpg.*, u.username, u.full_name, u.avatar_url
      FROM focus_participant_goals fpg
      JOIN users u ON u.id = fpg.user_id
      WHERE fpg.session_id = ?
      ORDER BY fpg.created_at ASC
    `).all(id);

    const myGoal = participants.find((p: any) => p.user_id === currentUserId) || null;

    res.json({
      session,
      timing: computeSessionTiming(session),
      isHost: session.host_id === currentUserId,
      participants,
      myGoal,
    });
  } catch (err: any) {
    console.error('[GET FOCUS SESSION ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve focus session.' });
  }
});

// 4. CONTROL TIMER (START / PAUSE / RESUME / END / SWITCH PHASE)
router.post('/:id/control', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'start', 'pause', 'resume', 'break', 'complete'
    const currentUserId = req.user!.id;

    const session = db.prepare(`SELECT * FROM focus_sessions WHERE id = ?`).get(id) as any;
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (session.host_id !== currentUserId) {
      res.status(403).json({ error: 'Only the host can control the session timer.' });
      return;
    }

    const nowEpoch = Date.now();
    const nowIso = new Date().toISOString();

    if (action === 'start' || action === 'resume') {
      db.prepare(`
        UPDATE focus_sessions SET status = 'running', start_timestamp = ?, pause_timestamp = NULL
        WHERE id = ?
      `).run(nowEpoch, id);
    } else if (action === 'pause') {
      const elapsed = (session.elapsed_before_pause || 0) + (session.start_timestamp ? (nowEpoch - session.start_timestamp) : 0);
      db.prepare(`
        UPDATE focus_sessions SET status = 'paused', start_timestamp = NULL, pause_timestamp = ?, elapsed_before_pause = ?
        WHERE id = ?
      `).run(nowEpoch, elapsed, id);
    } else if (action === 'break') {
      db.prepare(`
        UPDATE focus_sessions SET phase = 'break', status = 'paused', start_timestamp = NULL, elapsed_before_pause = 0
        WHERE id = ?
      `).run(id);
    } else if (action === 'complete') {
      db.prepare(`
        UPDATE focus_sessions SET status = 'completed', ended_at = ?
        WHERE id = ?
      `).run(nowIso, id);
    } else {
      res.status(400).json({ error: 'Invalid action.' });
      return;
    }

    const updated = db.prepare(`SELECT * FROM focus_sessions WHERE id = ?`).get(id);
    res.json({ session: updated, timing: computeSessionTiming(updated) });
  } catch (err: any) {
    console.error('[CONTROL FOCUS TIMER ERROR]', err);
    res.status(500).json({ error: 'Failed to control timer.' });
  }
});

// 5. SET OR UPDATE PERSONAL GOAL
router.post('/:id/goal', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { goal_text } = req.body;
    const currentUserId = req.user!.id;

    if (!goal_text || goal_text.trim().length === 0) {
      res.status(400).json({ error: 'Goal text cannot be empty.' });
      return;
    }

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO focus_participant_goals (id, session_id, user_id, goal_text, outcome, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(session_id, user_id) DO UPDATE SET goal_text = excluded.goal_text, updated_at = excluded.updated_at
    `).run(crypto.randomUUID(), id, currentUserId, goal_text.trim(), now, now);

    res.json({ message: 'Goal saved successfully.' });
  } catch (err: any) {
    console.error('[SET GOAL ERROR]', err);
    res.status(500).json({ error: 'Failed to save goal.' });
  }
});

// 6. REPORT GOAL OUTCOME
router.post('/:id/outcome', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { outcome } = req.body; // 'completed', 'partially_completed', 'not_completed'
    const currentUserId = req.user!.id;

    if (!['completed', 'partially_completed', 'not_completed'].includes(outcome)) {
      res.status(400).json({ error: 'Invalid outcome value.' });
      return;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE focus_participant_goals SET outcome = ?, updated_at = ?
      WHERE session_id = ? AND user_id = ?
    `).run(outcome, now, id, currentUserId);

    res.json({ message: `Goal marked as ${outcome}.` });
  } catch (err: any) {
    console.error('[REPORT OUTCOME ERROR]', err);
    res.status(500).json({ error: 'Failed to report outcome.' });
  }
});

export default router;
