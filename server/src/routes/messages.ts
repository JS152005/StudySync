import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

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
router.get('/direct/:friendId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.user!.id;

    // Verify target user exists
    const friend = db.prepare(`SELECT id, username, full_name, avatar_url, availability FROM users WHERE id = ?`).get(friendId);
    if (!friend) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const messages = db.prepare(`
      SELECT m.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_type = 'direct'
        AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
      ORDER BY m.created_at ASC LIMIT 100
    `).all(currentUserId, friendId, friendId, currentUserId);

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

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
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

    res.status(201).json({ message: saved });
  } catch (err: any) {
    console.error('[SEND DIRECT MESSAGE ERROR]', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// 4. GET GROUP MESSAGES
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

    const messages = db.prepare(`
      SELECT m.*, u.username as sender_username, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_type = 'group' AND m.group_id = ?
      ORDER BY m.created_at ASC LIMIT 100
    `).all(groupId);

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

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    // Check membership
    const member = db.prepare(`
      SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(groupId, currentUserId);

    if (!member) {
      res.status(403).json({ error: 'You must be a member of this group to post messages.' });
      return;
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

    res.status(201).json({ message: saved });
  } catch (err: any) {
    console.error('[SEND GROUP MESSAGE ERROR]', err);
    res.status(500).json({ error: 'Failed to send group message.' });
  }
});

export default router;
