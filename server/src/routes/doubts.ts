import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. SUBMIT A QUESTION / DOUBT
router.post('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { room_id, group_id, question, topic } = req.body;
    const currentUserId = req.user!.id;

    if (!question || question.trim().length === 0) {
      res.status(400).json({ error: 'Question cannot be empty.' });
      return;
    }

    if (!room_id && !group_id) {
      res.status(400).json({ error: 'Either room_id or group_id must be provided.' });
      return;
    }

    const doubtId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO doubts (id, room_id, group_id, author_id, question, topic, status, votes_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'waiting', 0, ?, ?)
    `).run(doubtId, room_id || null, group_id || null, currentUserId, question.trim(), topic?.trim() || '', now, now);

    const created = db.prepare(`
      SELECT d.*, u.full_name as author_name, u.username as author_username, u.avatar_url as author_avatar, 0 as user_voted
      FROM doubts d
      JOIN users u ON u.id = d.author_id
      WHERE d.id = ?
    `).get(doubtId);

    res.status(201).json({ doubt: created });
  } catch (err: any) {
    console.error('[CREATE DOUBT ERROR]', err);
    res.status(500).json({ error: 'Failed to submit doubt.' });
  }
});

// 2. GET DOUBTS (by room or group)
router.get('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { room_id, group_id } = req.query;
    const currentUserId = req.user!.id;

    if (!room_id && !group_id) {
      res.status(400).json({ error: 'room_id or group_id is required.' });
      return;
    }

    let doubts: any[] = [];
    if (room_id) {
      doubts = db.prepare(`
        SELECT d.*, u.full_name as author_name, u.username as author_username, u.avatar_url as author_avatar,
               (SELECT COUNT(*) FROM doubt_votes WHERE doubt_id = d.id AND user_id = ?) as user_voted
        FROM doubts d
        JOIN users u ON u.id = d.author_id
        WHERE d.room_id = ?
        ORDER BY d.votes_count DESC, d.created_at ASC
      `).all(currentUserId, room_id);
    } else if (group_id) {
      doubts = db.prepare(`
        SELECT d.*, u.full_name as author_name, u.username as author_username, u.avatar_url as author_avatar,
               (SELECT COUNT(*) FROM doubt_votes WHERE doubt_id = d.id AND user_id = ?) as user_voted
        FROM doubts d
        JOIN users u ON u.id = d.author_id
        WHERE d.group_id = ?
        ORDER BY d.votes_count DESC, d.created_at ASC
      `).all(currentUserId, group_id);
    }

    res.json({ doubts });
  } catch (err: any) {
    console.error('[GET DOUBTS ERROR]', err);
    res.status(500).json({ error: 'Failed to load doubt queue.' });
  }
});

// 3. TOGGLE UPVOTE ON DOUBT (1 vote per user)
router.post('/:id/vote', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const doubt = db.prepare(`SELECT * FROM doubts WHERE id = ?`).get(id) as any;
    if (!doubt) {
      res.status(404).json({ error: 'Doubt not found.' });
      return;
    }

    const existingVote = db.prepare(`
      SELECT id FROM doubt_votes WHERE doubt_id = ? AND user_id = ?
    `).get(id, currentUserId) as any;

    let userVoted = false;
    let newVotesCount = doubt.votes_count;

    db.transaction(() => {
      if (existingVote) {
        // Remove vote
        db.prepare(`DELETE FROM doubt_votes WHERE id = ?`).run(existingVote.id);
        newVotesCount = Math.max(0, doubt.votes_count - 1);
        db.prepare(`UPDATE doubts SET votes_count = ?, updated_at = ? WHERE id = ?`).run(newVotesCount, new Date().toISOString(), id);
        userVoted = false;
      } else {
        // Add vote
        db.prepare(`
          INSERT INTO doubt_votes (id, doubt_id, user_id, created_at)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), id, currentUserId, new Date().toISOString());
        newVotesCount = doubt.votes_count + 1;
        db.prepare(`UPDATE doubts SET votes_count = ?, updated_at = ? WHERE id = ?`).run(newVotesCount, new Date().toISOString(), id);
        userVoted = true;
      }
    })();

    res.json({ votes_count: newVotesCount, user_voted: userVoted ? 1 : 0 });
  } catch (err: any) {
    console.error('[VOTE DOUBT ERROR]', err);
    res.status(500).json({ error: 'Failed to register vote.' });
  }
});

// 4. UPDATE DOUBT STATUS (waiting -> answering -> solved)
router.put('/:id/status', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentUserId = req.user!.id;

    if (!['waiting', 'answering', 'solved'].includes(status)) {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }

    const doubt = db.prepare(`SELECT * FROM doubts WHERE id = ?`).get(id) as any;
    if (!doubt) {
      res.status(404).json({ error: 'Doubt not found.' });
      return;
    }

    // Check permission: author, room host, or group moderator/owner
    let hasPermission = doubt.author_id === currentUserId;
    if (!hasPermission && doubt.room_id) {
      const room = db.prepare(`SELECT host_id FROM study_rooms WHERE id = ?`).get(doubt.room_id) as any;
      if (room && room.host_id === currentUserId) hasPermission = true;
    }
    if (!hasPermission && doubt.group_id) {
      const member = db.prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'`).get(doubt.group_id, currentUserId) as any;
      if (member && (member.role === 'owner' || member.role === 'moderator')) hasPermission = true;
    }

    if (!hasPermission) {
      res.status(403).json({ error: 'Not authorized to change status.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE doubts SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, id);

    res.json({ message: `Doubt marked as ${status}.`, status });
  } catch (err: any) {
    console.error('[UPDATE DOUBT STATUS ERROR]', err);
    res.status(500).json({ error: 'Failed to update doubt status.' });
  }
});

// 5. DELETE DOUBT
router.delete('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const doubt = db.prepare(`SELECT * FROM doubts WHERE id = ?`).get(id) as any;
    if (!doubt) {
      res.status(404).json({ error: 'Doubt not found.' });
      return;
    }

    if (doubt.author_id !== currentUserId) {
      res.status(403).json({ error: 'Only author can delete this doubt.' });
      return;
    }

    db.prepare(`DELETE FROM doubts WHERE id = ?`).run(id);
    res.json({ message: 'Doubt deleted successfully.' });
  } catch (err: any) {
    console.error('[DELETE DOUBT ERROR]', err);
    res.status(500).json({ error: 'Failed to delete doubt.' });
  }
});

export default router;
