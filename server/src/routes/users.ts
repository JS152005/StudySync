import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET PUBLIC PROFILE
router.get('/profile/:username', requireAuth, (req: AuthRequest, res): void => {
  try {
    const username = String(req.params.username).trim().toLowerCase();
    const currentUserId = req.user!.id;

    const profile = db.prepare(`
      SELECT id, student_id, username, full_name, course, college, academic_year, bio, avatar_url, availability, privacy_email, email, created_at
      FROM users WHERE (LOWER(username) = ? OR LOWER(student_id) = ?) AND is_active = 1
    `).get(username, username) as any;

    if (!profile) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    // Hide email if privacy is enabled and not viewing own profile
    if (profile.privacy_email === 1 && profile.id !== currentUserId) {
      delete profile.email;
    }

    // Fetch topics they teach and need help with
    const topics = db.prepare(`
      SELECT id, type, subject, topic, notes FROM user_topics WHERE user_id = ?
    `).all(profile.id);

    // Fetch friendship status with current user
    let connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' = 'none';
    if (profile.id === currentUserId) {
      connectionStatus = 'self';
    } else {
      const rel = db.prepare(`
        SELECT id, user_id, friend_id, status FROM friendships
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      `).get(currentUserId, profile.id, profile.id, currentUserId) as any;

      if (rel) {
        if (rel.status === 'accepted') {
          connectionStatus = 'accepted';
        } else if (rel.status === 'pending') {
          connectionStatus = rel.user_id === currentUserId ? 'pending_sent' : 'pending_received';
        }
      }
    }

    res.json({
      profile: {
        ...profile,
        topics,
        connectionStatus,
      },
    });
  } catch (err: any) {
    console.error('[PROFILE ERROR]', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// 2. UPDATE PROFILE (Authenticated)
router.put('/profile', requireAuth, (req: AuthRequest, res): void => {
  try {
    const user = req.user!;
    const { full_name, course, college, academic_year, bio, avatar_url, availability, privacy_email } = req.body;

    if (!full_name || full_name.trim().length === 0) {
      res.status(400).json({ error: 'Full name cannot be empty.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users SET
        full_name = ?,
        course = ?,
        college = ?,
        academic_year = ?,
        bio = ?,
        avatar_url = ?,
        availability = ?,
        privacy_email = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      full_name.trim(),
      course?.trim() || '',
      college?.trim() || '',
      academic_year?.trim() || '',
      bio?.trim() || '',
      avatar_url?.trim() || '',
      availability || 'available',
      privacy_email ? 1 : 0,
      now,
      user.id
    );

    const updated = db.prepare(`
      SELECT id, student_id, email, username, full_name, course, college, academic_year, bio, avatar_url, availability, privacy_email, is_verified
      FROM users WHERE id = ?
    `).get(user.id);

    res.json({ message: 'Profile updated successfully.', user: updated });
  } catch (err: any) {
    console.error('[UPDATE PROFILE ERROR]', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// 3. SEARCH STUDENTS
router.get('/search', requireAuth, (req: AuthRequest, res): void => {
  try {
    const query = (req.query.q as string || '').trim().toLowerCase();
    const currentUserId = req.user!.id;

    if (!query) {
      // Return recent students
      const students = db.prepare(`
        SELECT id, student_id, username, full_name, course, college, academic_year, bio, avatar_url, availability
        FROM users WHERE id != ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 20
      `).all(currentUserId);
      res.json({ students });
      return;
    }

    const pattern = `%${query}%`;
    const students = db.prepare(`
      SELECT id, student_id, username, full_name, course, college, academic_year, bio, avatar_url, availability
      FROM users
      WHERE id != ? AND is_active = 1
        AND (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ? OR LOWER(course) LIKE ? OR LOWER(college) LIKE ? OR LOWER(student_id) LIKE ?)
      ORDER BY username ASC LIMIT 30
    `).all(currentUserId, pattern, pattern, pattern, pattern, pattern);

    res.json({ students });
  } catch (err: any) {
    console.error('[SEARCH USERS ERROR]', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// 3.1 FIND STUDENT EXACTLY BY UNIQUE STUDENT ID (for 1-on-1 chats & invites)
router.get('/by-student-id/:studentId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const rawId = String(req.params.studentId).trim().toUpperCase();
    const currentUserId = req.user!.id;

    if (!rawId) {
      res.status(400).json({ error: 'Student ID is required.' });
      return;
    }

    const student = db.prepare(`
      SELECT id, student_id, username, full_name, course, college, academic_year, bio, avatar_url, availability
      FROM users
      WHERE UPPER(student_id) = ? AND is_active = 1
    `).get(rawId) as any;

    if (!student) {
      res.status(404).json({ error: 'No student found with Student ID: ' + rawId });
      return;
    }

    if (student.id === currentUserId) {
      res.status(400).json({ error: 'You entered your own Student ID.', isSelf: true, student });
      return;
    }

    res.json({ student });
  } catch (err: any) {
    console.error('[FIND BY STUDENT ID ERROR]', err);
    res.status(500).json({ error: 'Failed to find student.' });
  }
});

// 3.2 MINIMAL DASHBOARD SUMMARY (Chats, Groups, Rooms & Invitations)
router.get('/dashboard-summary', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    // Recent direct conversations
    const recentDirectChats = db.prepare(`
      SELECT u.id as user_id, u.student_id, u.username, u.full_name, u.avatar_url, u.availability,
             m.content as last_message, m.created_at as last_message_at, m.sender_id,
             (SELECT COUNT(*) FROM messages WHERE conversation_type = 'direct' AND sender_id = u.id AND recipient_id = ? AND is_read = 0) as unread_count
      FROM users u
      JOIN messages m ON (
        m.id = (
          SELECT id FROM messages
          WHERE conversation_type = 'direct'
            AND ((sender_id = ? AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = ?))
          ORDER BY created_at DESC LIMIT 1
        )
      )
      WHERE u.id != ? AND u.is_active = 1
      ORDER BY m.created_at DESC LIMIT 5
    `).all(currentUserId, currentUserId, currentUserId, currentUserId);

    // Private groups
    const myGroups = db.prepare(`
      SELECT g.id, g.name, g.subject, g.course, g.invite_code, gm.role,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as member_count
      FROM study_groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ? AND gm.status = 'active'
      ORDER BY g.updated_at DESC LIMIT 6
    `).all(currentUserId);

    // Active rooms hosted by user
    const activeHostedRooms = db.prepare(`
      SELECT r.id, r.name, r.subject, r.topic, r.invite_code, r.created_at,
             (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id AND left_at IS NULL) as participant_count
      FROM study_rooms r
      WHERE r.host_id = ? AND r.is_active = 1
      ORDER BY r.created_at DESC LIMIT 5
    `).all(currentUserId);

    // Pending room invitations
    const pendingRoomInvitations = db.prepare(`
      SELECT ri.id as invitation_id, ri.created_at,
             r.id as room_id, r.name as room_name, r.subject as room_subject, r.invite_code as room_code,
             u.full_name as inviter_name, u.student_id as inviter_student_id
      FROM room_invitations ri
      JOIN study_rooms r ON r.id = ri.room_id
      JOIN users u ON u.id = ri.inviter_id
      WHERE ri.invitee_id = ? AND ri.status = 'pending' AND r.is_active = 1
      ORDER BY ri.created_at DESC LIMIT 5
    `).all(currentUserId);

    res.json({
      recentDirectChats,
      myGroups,
      activeHostedRooms,
      pendingRoomInvitations,
    });
  } catch (err: any) {
    console.error('[DASHBOARD SUMMARY ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard summary.' });
  }
});

// 4. GET FRIENDS LIST
router.get('/friends', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;
    const friends = db.prepare(`
      SELECT f.id as friendship_id, f.created_at as connected_at,
             u.id, u.student_id, u.username, u.full_name, u.course, u.college, u.academic_year, u.avatar_url, u.availability
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END)
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' AND u.is_active = 1
      ORDER BY u.full_name ASC
    `).all(currentUserId, currentUserId, currentUserId);

    res.json({ friends });
  } catch (err: any) {
    console.error('[GET FRIENDS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve friends.' });
  }
});

// 5. GET FRIEND REQUESTS
router.get('/friend-requests', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const incoming = db.prepare(`
      SELECT f.id, f.user_id, f.created_at, u.student_id, u.username, u.full_name, u.course, u.college, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending' AND u.is_active = 1
      ORDER BY f.created_at DESC
    `).all(currentUserId);

    const outgoing = db.prepare(`
      SELECT f.id, f.friend_id, f.created_at, u.student_id, u.username, u.full_name, u.course, u.college, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'pending' AND u.is_active = 1
      ORDER BY f.created_at DESC
    `).all(currentUserId);

    res.json({ incoming, outgoing });
  } catch (err: any) {
    console.error('[GET FRIEND REQUESTS ERROR]', err);
    res.status(500).json({ error: 'Failed to load friend requests.' });
  }
});

// 6. SEND FRIEND REQUEST
router.post('/friend-requests', requireAuth, (req: AuthRequest, res): void => {
  try {
    let { target_user_id, student_id } = req.body;
    const currentUserId = req.user!.id;

    if (!target_user_id && student_id) {
      const match = db.prepare('SELECT id FROM users WHERE LOWER(student_id) = ? AND is_active = 1').get(student_id.trim().toLowerCase()) as { id: string } | undefined;
      if (match) {
        target_user_id = match.id;
      } else {
        res.status(404).json({ error: `No student found with ID ${student_id}.` });
        return;
      }
    }

    if (!target_user_id || target_user_id === currentUserId) {
      res.status(400).json({ error: 'Invalid user target for friend request.' });
      return;
    }

    const targetUser = db.prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1`).get(target_user_id);
    if (!targetUser) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // Check existing relationship
    const existing = db.prepare(`
      SELECT id, status, user_id FROM friendships
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `).get(currentUserId, target_user_id, target_user_id, currentUserId) as any;

    const now = new Date().toISOString();

    if (existing) {
      if (existing.status === 'accepted') {
        res.status(400).json({ error: 'You are already connected with this student.' });
        return;
      }
      if (existing.status === 'pending') {
        if (existing.user_id === currentUserId) {
          res.status(400).json({ error: 'A friend request is already pending.' });
          return;
        } else {
          // If the other user already sent a request, auto-accept it!
          db.prepare(`UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?`).run(now, existing.id);
          res.json({ message: 'Connection request accepted! You are now friends.' });
          return;
        }
      }
      // If was declined/cancelled, restart as pending
      db.prepare(`
        UPDATE friendships SET user_id = ?, friend_id = ?, status = 'pending', updated_at = ? WHERE id = ?
      `).run(currentUserId, target_user_id, now, existing.id);
      res.json({ message: 'Friend request sent.' });
      return;
    }

    db.prepare(`
      INSERT INTO friendships (id, user_id, friend_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(crypto.randomUUID(), currentUserId, target_user_id, now, now);

    res.status(201).json({ message: 'Friend request sent.' });
  } catch (err: any) {
    console.error('[SEND FRIEND REQUEST ERROR]', err);
    res.status(500).json({ error: 'Failed to send friend request.' });
  }
});

// 7. RESPOND TO FRIEND REQUEST (Accept / Decline)
router.put('/friend-requests/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    const currentUserId = req.user!.id;

    if (!['accept', 'decline'].includes(action)) {
      res.status(400).json({ error: 'Action must be accept or decline.' });
      return;
    }

    const request = db.prepare(`SELECT * FROM friendships WHERE id = ? AND friend_id = ?`).get(id, currentUserId) as any;
    if (!request) {
      res.status(404).json({ error: 'Friend request not found or unauthorized.' });
      return;
    }

    const now = new Date().toISOString();
    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    db.prepare(`UPDATE friendships SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, now, id);

    res.json({ message: `Friend request ${newStatus}.` });
  } catch (err: any) {
    console.error('[RESPOND FRIEND REQUEST ERROR]', err);
    res.status(500).json({ error: 'Failed to update friend request.' });
  }
});

// 8. CANCEL OR REMOVE FRIENDSHIP
router.delete('/friend-requests/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const request = db.prepare(`
      SELECT * FROM friendships WHERE id = ? AND (user_id = ? OR friend_id = ?)
    `).get(id, currentUserId, currentUserId) as any;

    if (!request) {
      res.status(404).json({ error: 'Connection not found.' });
      return;
    }

    db.prepare(`DELETE FROM friendships WHERE id = ?`).run(id);
    res.json({ message: 'Connection removed successfully.' });
  } catch (err: any) {
    console.error('[REMOVE FRIENDSHIP ERROR]', err);
    res.status(500).json({ error: 'Failed to remove connection.' });
  }
});

export default router;
