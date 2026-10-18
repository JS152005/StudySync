import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET CURRENT USER'S TEACH & LEARN TOPICS
router.get('/topics', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const teachTopics = db.prepare(`
      SELECT * FROM user_topics WHERE user_id = ? AND type = 'teach' ORDER BY created_at DESC
    `).all(currentUserId);

    const learnTopics = db.prepare(`
      SELECT * FROM user_topics WHERE user_id = ? AND type = 'learn' ORDER BY created_at DESC
    `).all(currentUserId);

    res.json({ teachTopics, learnTopics });
  } catch (err: any) {
    console.error('[GET USER TOPICS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve topics.' });
  }
});

// 2. ADD A TOPIC (Teach or Learn)
router.post('/topics', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { type, subject, topic, notes } = req.body;
    const currentUserId = req.user!.id;

    if (!type || !['teach', 'learn'].includes(type)) {
      res.status(400).json({ error: 'Type must be teach or learn.' });
      return;
    }

    if (!subject || !topic) {
      res.status(400).json({ error: 'Subject and topic are required.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_topics (id, user_id, type, subject, topic, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, currentUserId, type, subject.trim(), topic.trim(), notes?.trim() || '', now);

    const created = db.prepare(`SELECT * FROM user_topics WHERE id = ?`).get(id);
    res.status(201).json({ topic: created });
  } catch (err: any) {
    console.error('[ADD TOPIC ERROR]', err);
    res.status(500).json({ error: 'Failed to add topic.' });
  }
});

// 3. REMOVE A TOPIC
router.delete('/topics/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    db.prepare(`DELETE FROM user_topics WHERE id = ? AND user_id = ?`).run(id, currentUserId);
    res.json({ message: 'Topic removed.' });
  } catch (err: any) {
    console.error('[DELETE TOPIC ERROR]', err);
    res.status(500).json({ error: 'Failed to delete topic.' });
  }
});

// 4. FIND PEER MATCHES (Teach Me / I'll Teach You)
router.get('/matches', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    // Matches for "I need help with X" -> peers who can teach X
    const peerTeachers = db.prepare(`
      SELECT DISTINCT
        u.id as user_id, u.username, u.full_name, u.course, u.college, u.avatar_url, u.availability,
        my_learn.subject, my_learn.topic,
        peer_teach.notes as peer_notes,
        'can_teach_you' as match_type
      FROM user_topics my_learn
      JOIN user_topics peer_teach
        ON LOWER(peer_teach.subject) = LOWER(my_learn.subject)
        AND LOWER(peer_teach.topic) = LOWER(my_learn.topic)
        AND peer_teach.type = 'teach'
        AND peer_teach.user_id != ?
      JOIN users u ON u.id = peer_teach.user_id AND u.is_active = 1
      WHERE my_learn.user_id = ? AND my_learn.type = 'learn'
    `).all(currentUserId, currentUserId);

    // Matches for "I can teach Y" -> peers who need help with Y
    const peerLearners = db.prepare(`
      SELECT DISTINCT
        u.id as user_id, u.username, u.full_name, u.course, u.college, u.avatar_url, u.availability,
        my_teach.subject, my_teach.topic,
        peer_learn.notes as peer_notes,
        'needs_your_help' as match_type
      FROM user_topics my_teach
      JOIN user_topics peer_learn
        ON LOWER(peer_learn.subject) = LOWER(my_teach.subject)
        AND LOWER(peer_learn.topic) = LOWER(my_teach.topic)
        AND peer_learn.type = 'learn'
        AND peer_learn.user_id != ?
      JOIN users u ON u.id = peer_learn.user_id AND u.is_active = 1
      WHERE my_teach.user_id = ? AND my_teach.type = 'teach'
    `).all(currentUserId, currentUserId);

    res.json({ peerTeachers, peerLearners });
  } catch (err: any) {
    console.error('[GET MATCHES ERROR]', err);
    res.status(500).json({ error: 'Failed to find peer matches.' });
  }
});

// 5. SEND PEER STUDY REQUEST
router.post('/requests', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { receiver_id, subject, topic, message } = req.body;
    const currentUserId = req.user!.id;

    if (!receiver_id || !subject || !topic) {
      res.status(400).json({ error: 'Receiver, subject, and topic are required.' });
      return;
    }

    if (receiver_id === currentUserId) {
      res.status(400).json({ error: 'Cannot send study request to yourself.' });
      return;
    }

    // Check duplicate pending request
    const existing = db.prepare(`
      SELECT id FROM peer_requests
      WHERE sender_id = ? AND receiver_id = ? AND subject = ? AND topic = ? AND status = 'pending'
    `).get(currentUserId, receiver_id, subject, topic);

    if (existing) {
      res.status(400).json({ error: 'A pending study request for this topic already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO peer_requests (id, sender_id, receiver_id, subject, topic, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, currentUserId, receiver_id, subject.trim(), topic.trim(), message?.trim() || '', now, now);

    res.status(201).json({ message: 'Study request sent successfully!' });
  } catch (err: any) {
    console.error('[PEER REQUEST ERROR]', err);
    res.status(500).json({ error: 'Failed to send peer request.' });
  }
});

// 6. GET INCOMING & OUTGOING PEER REQUESTS
router.get('/requests', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const incoming = db.prepare(`
      SELECT pr.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar, u.course as sender_course
      FROM peer_requests pr
      JOIN users u ON u.id = pr.sender_id
      WHERE pr.receiver_id = ? AND pr.status = 'pending'
      ORDER BY pr.created_at DESC
    `).all(currentUserId);

    const outgoing = db.prepare(`
      SELECT pr.*, u.username as receiver_username, u.full_name as receiver_name, u.avatar_url as receiver_avatar, u.course as receiver_course
      FROM peer_requests pr
      JOIN users u ON u.id = pr.receiver_id
      WHERE pr.sender_id = ?
      ORDER BY pr.created_at DESC
    `).all(currentUserId);

    res.json({ incoming, outgoing });
  } catch (err: any) {
    console.error('[GET PEER REQUESTS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve peer requests.' });
  }
});

// 7. RESPOND TO PEER REQUEST (Accept / Decline)
router.put('/requests/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    const currentUserId = req.user!.id;

    if (!['accept', 'decline'].includes(action)) {
      res.status(400).json({ error: 'Action must be accept or decline.' });
      return;
    }

    const pr = db.prepare(`SELECT * FROM peer_requests WHERE id = ? AND receiver_id = ?`).get(id, currentUserId) as any;
    if (!pr) {
      res.status(404).json({ error: 'Study request not found or unauthorized.' });
      return;
    }

    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    db.prepare(`UPDATE peer_requests SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, now, id);

    res.json({ message: `Study request ${newStatus}.` });
  } catch (err: any) {
    console.error('[RESPOND PEER REQUEST ERROR]', err);
    res.status(500).json({ error: 'Failed to update study request.' });
  }
});

export default router;
