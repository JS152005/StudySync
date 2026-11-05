import { Router } from 'express';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { db, generateRoomInviteCode } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getOrCreateRoomState,
  broadcastParticipantsSnapshot,
  removeRoomState,
  removeParticipantFromRoomState,
} from '../socket/index.js';

const router = Router();

interface RoomAccessResult {
  allowed: boolean;
  status: number;
  error?: string;
  room?: any;
  isHost?: boolean;
}

function checkRoomAccess(roomId: string, userId: string, providedCode?: string): RoomAccessResult {
  const room = db.prepare(`
    SELECT r.*, u.full_name as host_name, u.username as host_username, u.avatar_url as host_avatar,
           g.name as group_name
    FROM study_rooms r
    JOIN users u ON u.id = r.host_id
    LEFT JOIN study_groups g ON g.id = r.group_id
    WHERE r.id = ?
  `).get(roomId) as any;

  if (!room) {
    return { allowed: false, status: 404, error: 'Study room not found.' };
  }

  // Check if participant was removed
  const wasRemoved = db.prepare(`
    SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND is_removed = 1
  `).get(roomId, userId);
  if (wasRemoved) {
    return { allowed: false, status: 403, error: 'You have been removed from this study room and cannot access it.' };
  }

  const isHost = room.host_id === userId;
  let isMember = false;
  if (room.group_id) {
    const member = db.prepare(`
      SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(room.group_id, userId);
    isMember = !!member;
  }

  const isParticipant = db.prepare(`
    SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
  `).get(roomId, userId);

  const cleanCode = (providedCode || '').trim().toUpperCase();
  const hasCodeMatch = cleanCode && room.invite_code && cleanCode === room.invite_code.toUpperCase();

  if (!isHost && !isMember && !isParticipant && !hasCodeMatch) {
    return {
      allowed: false,
      status: 403,
      error: 'This study room is private. An invitation code or group membership is required.',
      room,
    };
  }

  return { allowed: true, status: 200, room, isHost };
}

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

    // Check if user was removed from room
    const wasRemoved = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND is_removed = 1').get(room.id, currentUserId);
    if (wasRemoved) {
      res.status(403).json({ error: 'You have been removed from this study room and cannot rejoin.' });
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
      const prevRow = db.prepare(`SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?`).get(room.id, currentUserId) as any;
      if (prevRow) {
        db.prepare(`UPDATE room_participants SET left_at = NULL WHERE id = ?`).run(prevRow.id);
      } else {
        db.prepare(`
          INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, is_removed, joined_at)
          VALUES (?, ?, ?, 0, 0, ?)
        `).run(crypto.randomUUID(), room.id, currentUserId, now);
      }
    }

    res.json({ message: 'Joined private room.', roomId: room.id, room });
  } catch (err: any) {
    console.error('[JOIN BY CODE ERROR]', err);
    res.status(500).json({ error: 'Failed to join private room.' });
  }
});

// 3.1 GET PENDING ROOM INVITATIONS
router.get('/invitations', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const invitations = db.prepare(`
      SELECT ri.id, ri.created_at, ri.status,
             r.id as room_id, r.name as room_name, r.subject as room_subject, r.topic as room_topic, r.invite_code as room_code,
             u.full_name as inviter_name, u.student_id as inviter_student_id, u.avatar_url as inviter_avatar
      FROM room_invitations ri
      JOIN study_rooms r ON r.id = ri.room_id
      JOIN users u ON u.id = ri.inviter_id
      WHERE ri.invitee_id = ? AND ri.status = 'pending' AND r.is_active = 1
      ORDER BY ri.created_at DESC
    `).all(currentUserId);

    res.json({ invitations });
  } catch (err: any) {
    console.error('[GET INVITATIONS ERROR]', err);
    res.status(500).json({ error: 'Failed to load invitations.' });
  }
});

// 3.2 RESPOND TO ROOM INVITATION (Accept / Decline)
router.post('/invitations/:invitationId/respond', requireAuth, (req: AuthRequest, res): void => {
  try {
    const invitationId = req.params.invitationId as string;
    const { action } = req.body; // 'accept' or 'decline'
    const currentUserId = req.user!.id;

    const invitation = db.prepare(`
      SELECT ri.*, r.id as room_id, r.invite_code, r.is_active
      FROM room_invitations ri
      JOIN study_rooms r ON r.id = ri.room_id
      WHERE ri.id = ? AND ri.invitee_id = ?
    `).get(invitationId, currentUserId) as any;

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found.' });
      return;
    }

    if (invitation.status !== 'pending') {
      res.status(400).json({ error: 'Invitation has already been answered.' });
      return;
    }

    if (action === 'accept') {
      if (invitation.is_active !== 1) {
        res.status(400).json({ error: 'This study room has ended.' });
        return;
      }

      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare(`UPDATE room_invitations SET status = 'accepted' WHERE id = ?`).run(invitationId);
        const existing = db.prepare(`SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).get(invitation.room_id, currentUserId);
        if (!existing) {
          const prevRow = db.prepare(`SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?`).get(invitation.room_id, currentUserId) as any;
          if (prevRow) {
            db.prepare(`UPDATE room_participants SET left_at = NULL WHERE id = ?`).run(prevRow.id);
          } else {
            db.prepare(`
              INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, is_removed, joined_at)
              VALUES (?, ?, ?, 0, 0, ?)
            `).run(crypto.randomUUID(), invitation.room_id, currentUserId, now);
          }
        }
      })();

      res.json({ message: 'Invitation accepted!', roomId: invitation.room_id, roomCode: invitation.invite_code });
    } else {
      db.prepare(`UPDATE room_invitations SET status = 'declined' WHERE id = ?`).run(invitationId);
      res.json({ message: 'Invitation declined.' });
    }
  } catch (err: any) {
    console.error('[RESPOND INVITATION ERROR]', err);
    res.status(500).json({ error: 'Failed to respond to invitation.' });
  }
});

// 4. GET ROOM DETAILS (Strictly private: only host, group members, active participants, or with invite code)
router.get('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
    const currentUserId = req.user!.id;
    const providedCode = ((req.query.code || '') as string).trim().toUpperCase();

    const access = checkRoomAccess(id, currentUserId, providedCode);
    if (!access.allowed) {
      res.status(access.status).json({
        error: access.error,
        is_private: true,
      });
      return;
    }

    const participants = db.prepare(`
      SELECT MIN(rp.id) as id, MAX(rp.is_hand_raised) as is_hand_raised, MIN(rp.joined_at) as joined_at,
             u.id as user_id, u.username, u.full_name, u.avatar_url
      FROM room_participants rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.room_id = ? AND rp.left_at IS NULL
      GROUP BY u.id
      ORDER BY joined_at ASC
    `).all(id);

    res.json({
      room: access.room,
      isHost: access.isHost,
      participants,
    });
  } catch (err: any) {
    console.error('[GET ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve room details.' });
  }
});

// 5. JOIN ROOM (Private check)
router.post('/:id/join', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
    const currentUserId = req.user!.id;
    const providedCode = ((req.body?.invite_code || req.query?.code || '') as string).trim().toUpperCase();

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ? AND is_active = 1`).get(id) as any;
    if (!room) {
      res.status(404).json({ error: 'Study room is not active or does not exist.' });
      return;
    }

    const wasRemoved = db.prepare(`
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND is_removed = 1
    `).get(id, currentUserId);
    if (wasRemoved) {
      res.status(403).json({ error: 'You have been removed from this study room and cannot rejoin.' });
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
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
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
    if (!isParticipant) {
      const prevRow = db.prepare(`SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?`).get(id, currentUserId) as any;
      if (prevRow) {
        db.prepare(`UPDATE room_participants SET left_at = NULL WHERE id = ?`).run(prevRow.id);
      } else {
        db.prepare(`
          INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, is_removed, joined_at)
          VALUES (?, ?, ?, 0, 0, ?)
        `).run(crypto.randomUUID(), id, currentUserId, now);
      }
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
    const id = req.params.id as string;
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
    const id = req.params.id as string;
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

    const io: Server | undefined = req.app.get('io');
    if (io) {
      io.to(`room:${id}`).emit('room_ended', { roomId: id });
      io.in(`room:${id}`).socketsLeave(`room:${id}`);
    }
    removeRoomState(id);

    res.json({ message: 'Study room session ended.' });
  } catch (err: any) {
    console.error('[END ROOM ERROR]', err);
    res.status(500).json({ error: 'Failed to end room.' });
  }
});

// 8. TOGGLE HAND RAISE (Authoritative REST handler with broadcast)
router.post('/:id/hand', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
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

    const io: Server | undefined = req.app.get('io');
    if (io) {
      const roomState = getOrCreateRoomState(id);
      const p = roomState.participants.get(currentUserId);
      if (p) {
        p.isHandRaised = newHandState === 1;
      }
      io.to(`room:${id}`).emit('user_hand_toggled', {
        userId: currentUserId,
        username: req.user!.username,
        fullName: req.user!.full_name,
        isHandRaised: newHandState === 1,
      });
      broadcastParticipantsSnapshot(io, id);
    }

    res.json({ message: 'Hand status toggled.', isHandRaised: newHandState });
  } catch (err: any) {
    console.error('[TOGGLE HAND ERROR]', err);
    res.status(500).json({ error: 'Failed to toggle hand.' });
  }
});

// 9. GET WHITEBOARD STATE (Verified against same access rules as GET /:id)
router.get('/:id/whiteboard', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
    const currentUserId = req.user!.id;
    const providedCode = ((req.query.code || '') as string).trim().toUpperCase();

    const access = checkRoomAccess(id, currentUserId, providedCode);
    if (!access.allowed) {
      res.status(access.status).json({ error: access.error });
      return;
    }

    const session = db.prepare(`SELECT canvas_data FROM whiteboard_sessions WHERE room_id = ?`).get(id) as any;
    const actions = db.prepare(`
      SELECT id, sequence_number, user_id, action_type, payload, created_at
      FROM whiteboard_actions
      WHERE room_id = ?
      ORDER BY sequence_number ASC
    `).all(id) as any[];

    res.json({
      canvasData: session?.canvas_data || '[]',
      actions: actions.map((a) => {
        let parsed = null;
        try {
          parsed = JSON.parse(a.payload);
        } catch {
          parsed = a.payload;
        }
        return {
          id: a.id,
          sequenceNumber: a.sequence_number,
          userId: a.user_id,
          actionType: a.action_type,
          stroke: parsed,
          createdAt: a.created_at,
        };
      }),
      version: actions.length > 0 ? actions[actions.length - 1].sequence_number : 0,
    });
  } catch (err: any) {
    console.error('[GET WHITEBOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch whiteboard.' });
  }
});

// 10. SAVE WHITEBOARD STATE (Verified against access rules & canvasData capped at 2MB)
router.put('/:id/whiteboard', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
    const currentUserId = req.user!.id;
    const providedCode = ((req.query.code || req.body?.code || '') as string).trim().toUpperCase();

    const access = checkRoomAccess(id, currentUserId, providedCode);
    if (!access.allowed) {
      res.status(access.status).json({ error: access.error });
      return;
    }

    const { canvasData } = req.body;
    if (canvasData !== undefined && canvasData !== null) {
      if (typeof canvasData !== 'string') {
        res.status(400).json({ error: 'Canvas data must be a string.' });
        return;
      }
      // Cap canvasData at 2MB (2 * 1024 * 1024 characters)
      if (canvasData.length > 2 * 1024 * 1024) {
        res.status(400).json({ error: 'Canvas data exceeds maximum allowed size (2MB).' });
        return;
      }
    }

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

// 11. INVITE STUDENT BY STUDENT ID
router.post('/:id/invite-student', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
    const { student_id } = req.body;
    const currentUserId = req.user!.id;

    if (!student_id || !String(student_id).trim()) {
      res.status(400).json({ error: 'Student ID is required.' });
      return;
    }

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ? AND is_active = 1`).get(id) as any;
    if (!room) {
      res.status(404).json({ error: 'Study room not found or has ended.' });
      return;
    }

    // Check inviter is host or active participant
    const isHost = room.host_id === currentUserId;
    const isParticipant = db.prepare(`
      SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
    `).get(id, currentUserId);

    if (!isHost && !isParticipant) {
      res.status(403).json({ error: 'You must be in the study room to send invitations.' });
      return;
    }

    const cleanStuId = String(student_id).trim().toUpperCase();
    const targetUser = db.prepare(`
      SELECT id, student_id, full_name, username FROM users WHERE UPPER(student_id) = ? AND is_active = 1
    `).get(cleanStuId) as any;

    if (!targetUser) {
      res.status(404).json({ error: 'No student found with Student ID: ' + cleanStuId });
      return;
    }

    if (targetUser.id === currentUserId) {
      res.status(400).json({ error: 'You cannot invite yourself.' });
      return;
    }

    const now = new Date().toISOString();
    const invitationId = crypto.randomUUID();

    // Remove any previous pending invitation for this user and room
    db.prepare(`DELETE FROM room_invitations WHERE room_id = ? AND invitee_id = ? AND status = 'pending'`).run(id, targetUser.id);

    db.prepare(`
      INSERT INTO room_invitations (id, room_id, inviter_id, invitee_id, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(invitationId, id, currentUserId, targetUser.id, now);

    res.status(201).json({
      message: `Invitation sent to ${targetUser.full_name} (${targetUser.student_id})!`,
      invitationId,
      invitee: targetUser,
      roomCode: room.invite_code,
    });
  } catch (err: any) {
    console.error('[INVITE STUDENT ERROR]', err);
    res.status(500).json({ error: 'Failed to send room invitation.' });
  }
});

// 12. REMOVE PARTICIPANT (Host only)
router.delete('/:id/participants/:userId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const currentUserId = req.user!.id;

    const room = db.prepare(`SELECT * FROM study_rooms WHERE id = ?`).get(id) as any;
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (room.host_id !== currentUserId) {
      res.status(403).json({ error: 'Only the room host can remove participants.' });
      return;
    }

    if (userId === currentUserId) {
      res.status(400).json({ error: 'Host cannot remove themselves from the room.' });
      return;
    }

    const now = new Date().toISOString();
    // Mark as removed and set left_at so the student cannot rejoin
    db.prepare(`
      UPDATE room_participants 
      SET is_removed = 1, left_at = COALESCE(left_at, ?) 
      WHERE room_id = ? AND user_id = ?
    `).run(now, id, userId);

    const io: Server | undefined = req.app.get('io');
    if (io) {
      io.to(`room:${id}`).emit('participant_removed', { roomId: id, userId });
      // Remove affected user's sockets from room channel
      const roomSockets = io.sockets.adapter.rooms.get(`room:${id}`);
      if (roomSockets) {
        for (const sId of Array.from(roomSockets)) {
          const targetSock = io.sockets.sockets.get(sId) as any;
          if (targetSock && targetSock.userId === userId) {
            targetSock.leave(`room:${id}`);
          }
        }
      }
      removeParticipantFromRoomState(id, userId);
      broadcastParticipantsSnapshot(io, id);
    }

    res.json({ message: 'Participant removed from study room.' });
  } catch (err: any) {
    console.error('[REMOVE PARTICIPANT ERROR]', err);
    res.status(500).json({ error: 'Failed to remove participant.' });
  }
});

export default router;
