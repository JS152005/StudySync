import { Router } from 'express';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

function isValidAttachmentUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// 1. GET ALL RECENT CONVERSATIONS (Direct & Group)
router.get('/conversations', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    // Direct conversations with last message
    const directChats = db.prepare(`
      SELECT u.id as user_id, u.username, u.full_name, u.avatar_url, u.availability,
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
      ORDER BY m.created_at DESC
    `).all(currentUserId, currentUserId, currentUserId, currentUserId);

    // Group conversations
    const groupChats = db.prepare(`
      SELECT g.id as group_id, g.name, g.subject,
             m.content as last_message, m.created_at as last_message_at,
             u.full_name as last_sender_name
      FROM study_groups g
      JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN messages m ON (
        m.id = (
          SELECT id FROM messages WHERE conversation_type = 'group' AND group_id = g.id
          ORDER BY created_at DESC LIMIT 1
        )
      )
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE gm.user_id = ? AND gm.status = 'active'
      ORDER BY COALESCE(m.created_at, g.created_at) DESC
    `).all(currentUserId);

    res.json({ directChats, groupChats });
  } catch (err: any) {
    console.error('[GET CONVERSATIONS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve conversations.' });
  }
});

// 2. GET DIRECT MESSAGES WITH A FRIEND
// Return latest N messages (ORDER BY created_at DESC LIMIT N, then reverse) with optional ?before cursor
router.get('/direct/:friendId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.user!.id;

    // Verify recipient exists and is active
    const friend = db.prepare(`SELECT id, username, full_name, avatar_url, availability, is_active FROM users WHERE id = ?`).get(friendId) as any;
    if (!friend || friend.is_active === 0) {
      res.status(404).json({ error: 'Recipient does not exist or is inactive.' });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 100);
    const before = req.query.before as string | undefined;

    let query = `
      SELECT m.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_type = 'direct'
        AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
    `;
    const params: any[] = [currentUserId, friendId, friendId, currentUserId];

    if (before) {
      query += ` AND m.created_at < ?`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    const messages = rows.reverse();

    // Mark messages as read
    db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE conversation_type = 'direct' AND sender_id = ? AND recipient_id = ? AND is_read = 0
    `).run(friendId, currentUserId);

    res.json({ friend, messages });
  } catch (err: any) {
    console.error('[GET DIRECT MESSAGES ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

// 3. SEND DIRECT MESSAGE
router.post('/direct/:friendId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { friendId } = req.params;
    const { content, attachment_url, attachment_name } = req.body;
    const currentUserId = req.user!.id;

    // Verify recipient exists and is active
    const recipient = db.prepare(`SELECT id, username, full_name, avatar_url, availability, is_active FROM users WHERE id = ?`).get(friendId) as any;
    if (!recipient || recipient.is_active === 0) {
      res.status(404).json({ error: 'Recipient does not exist or is inactive.' });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    if (content.length > 4000) {
      res.status(400).json({ error: 'Message content cannot exceed 4000 characters.' });
      return;
    }

    if (attachment_url) {
      if (typeof attachment_url !== 'string' || !isValidAttachmentUrl(attachment_url)) {
        res.status(400).json({ error: 'Attachment URL must be a valid http or https URL.' });
        return;
      }
    }

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, conversation_type, sender_id, recipient_id, content, attachment_url, attachment_name, created_at)
      VALUES (?, 'direct', ?, ?, ?, ?, ?, ?)
    `).run(messageId, currentUserId, friendId, content.trim(), attachment_url || null, attachment_name || null, now);

    const saved = db.prepare(`
      SELECT m.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `).get(messageId);

    // Emit direct_message_received to recipient and sender via socket
    const io: Server | undefined = req.app.get('io');
    if (io) {
      io.to(`user:${friendId}`).emit('direct_message_received', saved);
      io.to(`user:${currentUserId}`).emit('direct_message_received', saved);
    }

    res.status(201).json({ message: saved });
  } catch (err: any) {
    console.error('[SEND DIRECT MESSAGE ERROR]', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// 4. GET GROUP MESSAGES
// Return latest N messages (ORDER BY created_at DESC LIMIT N, then reverse) with optional ?before cursor
router.get('/group/:groupId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user!.id;

    // Check membership
    const member = db.prepare(`
      SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(groupId, currentUserId);

    if (!member) {
      res.status(403).json({ error: 'You must be a member of this group to view messages.' });
      return;
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 100);
    const before = req.query.before as string | undefined;

    let query = `
      SELECT m.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_type = 'group' AND m.group_id = ?
    `;
    const params: any[] = [groupId];

    if (before) {
      query += ` AND m.created_at < ?`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    const messages = rows.reverse();

    res.json({ messages });
  } catch (err: any) {
    console.error('[GET GROUP MESSAGES ERROR]', err);
    res.status(500).json({ error: 'Failed to load group messages.' });
  }
});

// 5. SEND GROUP MESSAGE
router.post('/group/:groupId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { groupId } = req.params;
    const { content, attachment_url, attachment_name } = req.body;
    const currentUserId = req.user!.id;

    // Check membership
    const member = db.prepare(`
      SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(groupId, currentUserId);

    if (!member) {
      res.status(403).json({ error: 'You must be a member of this group to post messages.' });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    if (content.length > 4000) {
      res.status(400).json({ error: 'Message content cannot exceed 4000 characters.' });
      return;
    }

    if (attachment_url) {
      if (typeof attachment_url !== 'string' || !isValidAttachmentUrl(attachment_url)) {
        res.status(400).json({ error: 'Attachment URL must be a valid http or https URL.' });
        return;
      }
    }

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, conversation_type, group_id, sender_id, content, attachment_url, attachment_name, created_at)
      VALUES (?, 'group', ?, ?, ?, ?, ?, ?)
    `).run(messageId, groupId, currentUserId, content.trim(), attachment_url || null, attachment_name || null, now);

    const saved = db.prepare(`
      SELECT m.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `).get(messageId);

    // Emit group_message_received to group channel via socket
    const io: Server | undefined = req.app.get('io');
    if (io) {
      io.to(`group:${groupId}`).emit('group_message_received', saved);
    }

    res.status(201).json({ message: saved });
  } catch (err: any) {
    console.error('[SEND GROUP MESSAGE ERROR]', err);
    res.status(500).json({ error: 'Failed to send group message.' });
  }
});

export default router;
