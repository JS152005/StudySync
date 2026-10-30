import { Router } from 'express';
import crypto from 'crypto';
import { db, generateRoomInviteCode } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. LIST ACTIVE PRIVATE ROOMS (Only rooms user hosts, belongs to via group, or is participating in)
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
        AND (
          r.host_id = ?
          OR (r.group_id IS NOT NULL AND r.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active'))
          OR r.id IN (SELECT room_id FROM room_participants WHERE user_id = ? AND left_at IS NULL)
        )
      ORDER BY r.created_at DESC LIMIT 30
    `).all(currentUserId, currentUserId, currentUserId);

    res.json({ rooms });
  } catch (err: any) {
    console.error('[LIST ROOMS ERROR]', err);
    res.status(500).json({ error: 'Failed to list study rooms.' });
  }
});

// 2. CREATE PRIVATE STUDY ROOM
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

    // Generate unique private room invite code
    let inviteCode = generateRoomInviteCode();
    let existingCode = db.prepare('SELECT id FROM study_rooms WHERE invite_code = ?').get(inviteCode);
    while (existingCode) {
      inviteCode = generateRoomInviteCode();
      existingCode = db.prepare('SELECT id FROM study_rooms WHERE invite_code = ?').get(inviteCode);
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO study_rooms (id, name, subject, topic, group_id, host_id, invite_code, is_active, teach_mode, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        roomId,
        name.trim(),
        subject?.trim() || '',
        topic?.trim() || '',
        group_id || null,
        currentUserId,
        inviteCode,
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
    res.status(201).json({ message: 'Private study room created successfully.', room });
  } catch (err: any) {
    console.error('[CREATE ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to create room.' });
  }
});

// 3. JOIN PRIVATE ROOM BY INVITE CODE
router.post('/join-by-code', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { invite_code } = req.body;
    const currentUserId = req.user!.id;

    if (!invite_code || !invite_code.trim()) {
      res.status(400).json({ error: 'Private room invite code is required.' });
      return;
    }

    const cleanCode = invite_code.trim().toUpperCase();
    const room = db.prepare('SELECT * FROM study_rooms WHERE UPPER(invite_code) = ? AND is_active = 1').get(cleanCode) as any;

    if (!room) {
      res.status(404).json({ error: 'No active private study room found with this invite code.' });
      return;
    }

    // If room is attached to a private group, check group membership
    if (room.group_id) {
      const member = db.prepare(`
        SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
      `).get(room.group_id, currentUserId);

      if (!member) {
        res.status(403).json({ error: 'This study room belongs to a private group. You must join the group first.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const existing = db.prepare(`
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).get(room.id, currentUserId);

    if (!existing) {
      db.prepare(`
        INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, joined_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(crypto.randomUUID(), room.id, currentUserId, now);
    }

    res.json({ message: 'Joined private room.', roomId: room.id, room });
  } catch (err: any) {
    console.error('[JOIN BY CODE ERROR]', err);
    res.status(500).json({ error: 'Failed to join private room.' });
  }
});

// 4. GET ROOM DETAILS (Strictly private: only host, group members, active participants, or with invite code)
router.get('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const providedCode = ((req.query.code || '') as string).trim().toUpperCase();

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

    const isHost = room.host_id === currentUserId;
    let isMember = false;

    if (room.group_id) {
      const member = db.prepare(`
        SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
      `).get(room.group_id, currentUserId);
      isMember = !!member;
    }

    const isParticipant = db.prepare(`
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?
    `).get(id, currentUserId);

    const hasCodeMatch = providedCode && room.invite_code && providedCode === room.invite_code.toUpperCase();

    if (!isHost && !isMember && !isParticipant && !hasCodeMatch) {
      res.status(403).json({
        error: 'This study room is private. An invitation code or group membership is required.',
        is_private: true,
      });
      return;
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
      isHost,
      participants,
      doubts,
    });
  } catch (err: any) {
    console.error('[GET ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve room details.' });
  }
});

// 5. JOIN ROOM (Private check)
router.post('/:id/join', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;
    const providedCode = ((req.body?.invite_code || req.query?.code || '') as string).trim().toUpperCase();

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ? AND is_active = 1`).get(id) as any;
    if (!room) {
      res.status(404).json({ error: 'Study room is not active or does not exist.' });
      return;
    }

    const isHost = room.host_id === currentUserId;
    let isMember = false;

    if (room.group_id) {
      const member = db.prepare(`
        SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
      `).get(room.group_id, currentUserId);
      isMember = !!member;
    }

    const isParticipant = db.prepare(`
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?
    `).get(id, currentUserId);

    const hasCodeMatch = providedCode && room.invite_code && providedCode === room.invite_code.toUpperCase();

    if (!isHost && !isMember && !isParticipant && !hasCodeMatch) {
      res.status(403).json({
        error: 'This study room is private. Valid invite code or group membership required to join.',
        is_private: true,
      });
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

    res.json({ message: 'Joined private room successfully.' });
  } catch (err: any) {
    console.error('[JOIN ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to join room.' });
  }
});

// 6. LEAVE ROOM
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

// 7. END ROOM (Host only)
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

    res.json({ message: 'Study room session ended.' });
  } catch (err: any) {
    console.error('[END ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to end room.' });
  }
});

// 8. TOGGLE HAND RAISE
router.post('/:id/hand', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const participant = db.prepare(`
      SELECT id, is_hand_raised FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).get(id, currentUserId) as any;

    if (!participant) {
      res.status(404).json({ error: 'You are not an active participant in this room.' });
      return;
    }

    const newHandState = participant.is_hand_raised === 1 ? 0 : 1;
    db.prepare(`UPDATE room_participants SET is_hand_raised = ? WHERE id = ?`).run(newHandState, participant.id);

    res.json({ message: 'Hand status toggled.', isHandRaised: newHandState });
  } catch (err: any) {
    console.error('[TOGGLE HAND ERROR]', err);
    res.status(500).json({ error: 'Failed to toggle hand.' });
  }
});

// 9. GET WHITEBOARD STATE
router.get('/:id/whiteboard', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;

    const session = db.prepare(`SELECT canvas_data FROM whiteboard_sessions WHERE room_id = ?`).get(id) as any;
    res.json({ canvasData: session?.canvas_data || '[]' });
  } catch (err: any) {
    console.error('[GET WHITEBOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch whiteboard.' });
  }
});

// 10. SAVE WHITEBOARD STATE
router.put('/:id/whiteboard', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { canvasData } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO whiteboard_sessions (id, room_id, canvas_data, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET canvas_data = excluded.canvas_data, updated_at = excluded.updated_at
    `).run(crypto.randomUUID(), id, canvasData || '[]', now);

    res.json({ message: 'Whiteboard saved successfully.' });
  } catch (err: any) {
    console.error('[SAVE WHITEBOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to save whiteboard.' });
  }
});

export default router;
