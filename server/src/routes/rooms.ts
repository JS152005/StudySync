import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. LIST ACTIVE ROOMS
router.get('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const rooms = db.prepare(`
      SELECT r.*, u.full_name as host_name, u.username as host_username, u.avatar_url as host_avatar,
             g.name as group_name,
             (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id AND left_at IS NULL) as participant_count
      FROM study_rooms r
      JOIN users u ON u.id = r.host_id
      LEFT JOIN study_groups g ON g.id = r.group_id
      WHERE r.is_active = 1
        AND (r.group_id IS NULL OR r.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active'))
      ORDER BY r.created_at DESC LIMIT 20
    `).all(currentUserId);

    res.json({ rooms });
  } catch (err: any) {
    console.error('[LIST ROOMS ERROR]', err);
    res.status(500).json({ error: 'Failed to list study rooms.' });
  }
});

// 2. CREATE STUDY ROOM
router.post('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { name, subject, topic, group_id, teach_mode } = req.body;
    const currentUserId = req.user!.id;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Room name is required.' });
      return;
    }

    if (group_id) {
      const member = db.prepare(`
        SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
      `).get(group_id, currentUserId);

      if (!member) {
        res.status(403).json({ error: 'You must be a member of this group to start a room for it.' });
        return;
      }
    }

    const roomId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO study_rooms (id, name, subject, topic, group_id, host_id, is_active, teach_mode, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        roomId,
        name.trim(),
        subject?.trim() || '',
        topic?.trim() || '',
        group_id || null,
        currentUserId,
        teach_mode ? 1 : 0,
        now
      );

      // Add host as participant
      db.prepare(`
        INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, joined_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(crypto.randomUUID(), roomId, currentUserId, now);

      // Initialize empty whiteboard
      db.prepare(`
        INSERT INTO whiteboard_sessions (id, room_id, canvas_data, updated_at)
        VALUES (?, ?, '[]', ?)
      `).run(crypto.randomUUID(), roomId, now);
    })();

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ?`).get(roomId);
    res.status(201).json({ message: 'Study room created successfully.', room });
  } catch (err: any) {
    console.error('[CREATE ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to create room.' });
  }
});

// 3. GET ROOM DETAILS
router.get('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const room = db.prepare(`
      SELECT r.*, u.full_name as host_name, u.username as host_username, u.avatar_url as host_avatar,
             g.name as group_name
      FROM study_rooms r
      JOIN users u ON u.id = r.host_id
      LEFT JOIN study_groups g ON g.id = r.group_id
      WHERE r.id = ?
    `).get(id) as any;

    if (!room) {
      res.status(404).json({ error: 'Study room not found.' });
      return;
    }

    if (room.group_id) {
      const member = db.prepare(`
        SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
      `).get(room.group_id, currentUserId);

      if (!member) {
        res.status(403).json({ error: 'This study room is restricted to group members.' });
        return;
      }
    }

    const participants = db.prepare(`
      SELECT rp.id, rp.is_hand_raised, rp.joined_at, u.id as user_id, u.username, u.full_name, u.avatar_url
      FROM room_participants rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.room_id = ? AND rp.left_at IS NULL
      ORDER BY rp.joined_at ASC
    `).all(id);

    // Doubts in this room
    const doubts = db.prepare(`
      SELECT d.*, u.full_name as author_name, u.username as author_username,
             (SELECT COUNT(*) FROM doubt_votes WHERE doubt_id = d.id AND user_id = ?) as user_voted
      FROM doubts d
      JOIN users u ON u.id = d.author_id
      WHERE d.room_id = ?
      ORDER BY d.votes_count DESC, d.created_at ASC
    `).all(currentUserId, id);

    res.json({
      room,
      isHost: room.host_id === currentUserId,
      participants,
      doubts,
    });
  } catch (err: any) {
    console.error('[GET ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve room details.' });
  }
});

// 4. JOIN ROOM
router.post('/:id/join', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ? AND is_active = 1`).get(id) as any;
    if (!room) {
      res.status(404).json({ error: 'Study room is not active or does not exist.' });
      return;
    }

    const now = new Date().toISOString();
    const existing = db.prepare(`
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).get(id, currentUserId);

    if (!existing) {
      db.prepare(`
        INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, joined_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(crypto.randomUUID(), id, currentUserId, now);
    }

    res.json({ message: 'Joined room successfully.' });
  } catch (err: any) {
    console.error('[JOIN ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to join room.' });
  }
});

// 5. LEAVE ROOM
router.post('/:id/leave', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).run(now, id, currentUserId);

    res.json({ message: 'Left room successfully.' });
  } catch (err: any) {
    console.error('[LEAVE ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to leave room.' });
  }
});

// 6. END ROOM (Host only)
router.post('/:id/end', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ?`).get(id) as any;
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (room.host_id !== currentUserId) {
      res.status(403).json({ error: 'Only the host can end this session.' });
      return;
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(`UPDATE study_rooms SET is_active = 0, ended_at = ? WHERE id = ?`).run(now, id);
      db.prepare(`UPDATE room_participants SET left_at = ? WHERE room_id = ? AND left_at IS NULL`).run(now, id);
    })();

    res.json({ message: 'Room ended successfully.' });
  } catch (err: any) {
    console.error('[END ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to end room.' });
  }
});

// 7. RAISE / LOWER HAND
router.post('/:id/hand', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const participant = db.prepare(`
      SELECT id, is_hand_raised FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).get(id, currentUserId) as any;

    if (!participant) {
      res.status(400).json({ error: 'You are not in this room.' });
      return;
    }

    const newHandState = participant.is_hand_raised === 1 ? 0 : 1;
    db.prepare(`UPDATE room_participants SET is_hand_raised = ? WHERE id = ?`).run(newHandState, participant.id);

    res.json({ isHandRaised: newHandState === 1 });
  } catch (err: any) {
    console.error('[HAND ERROR]', err);
    res.status(500).json({ error: 'Failed to update hand state.' });
  }
});

// 8. GET WHITEBOARD DATA
router.get('/:id/whiteboard', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const session = db.prepare(`SELECT canvas_data, updated_at FROM whiteboard_sessions WHERE room_id = ?`).get(id) as any;

    res.json({ canvasData: session ? session.canvas_data : '[]' });
  } catch (err: any) {
    console.error('[GET WHITEBOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to load whiteboard.' });
  }
});

// 9. SAVE WHITEBOARD DATA
router.put('/:id/whiteboard', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { canvasData } = req.body;
    const now = new Date().toISOString();

    const dataString = typeof canvasData === 'string' ? canvasData : JSON.stringify(canvasData || []);

    db.prepare(`
      INSERT INTO whiteboard_sessions (id, room_id, canvas_data, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET canvas_data = excluded.canvas_data, updated_at = excluded.updated_at
    `).run(crypto.randomUUID(), id, dataString, now);

    res.json({ message: 'Whiteboard saved.' });
  } catch (err: any) {
    console.error('[SAVE WHITEBOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to save whiteboard.' });
  }
});

export default router;
