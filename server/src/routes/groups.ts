import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { sendEmail, createGroupInvitationEmail } from '../services/mailer.js';

const router = Router();

// 1. LIST USER GROUPS & PUBLIC GROUPS
router.get('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;

    const myGroups = db.prepare(`
      SELECT g.*, gm.role,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as member_count
      FROM study_groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ? AND gm.status = 'active'
      ORDER BY g.updated_at DESC
    `).all(currentUserId);

    const publicGroups = db.prepare(`
      SELECT g.*,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'active') as member_count
      FROM study_groups g
      WHERE g.is_private = 0
        AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
      ORDER BY g.created_at DESC LIMIT 20
    `).all(currentUserId);

    res.json({ myGroups, publicGroups });
  } catch (err: any) {
    console.error('[GROUPS LIST ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

// 2. CREATE STUDY GROUP
router.post('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { name, description, subject, course, is_private } = req.body;
    const currentUserId = req.user!.id;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Group name is required.' });
      return;
    }

    const groupId = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const now = new Date().toISOString();

    const createTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO study_groups (id, name, description, subject, course, is_private, invite_code, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        groupId,
        name.trim(),
        description?.trim() || '',
        subject?.trim() || '',
        course?.trim() || '',
        is_private ? 1 : 0,
        inviteCode,
        currentUserId,
        now,
        now
      );

      // Creator is owner
      db.prepare(`
        INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
        VALUES (?, ?, ?, 'owner', 'active', ?)
      `).run(crypto.randomUUID(), groupId, currentUserId, now);

      // Initial announcement
      db.prepare(`
        INSERT INTO group_announcements (id, group_id, author_id, title, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        groupId,
        currentUserId,
        'Welcome to the Study Group!',
        `Welcome everyone to ${name.trim()}! Collaborate on study rooms, syllabus goals, doubts, and focus sessions here.`,
        now
      );
    });

    createTx();

    const newGroup = db.prepare(`SELECT * FROM study_groups WHERE id = ?`).get(groupId);
    res.status(201).json({ message: 'Study group created successfully.', group: newGroup });
  } catch (err: any) {
    console.error('[CREATE GROUP ERROR]', err);
    res.status(500).json({ error: 'Failed to create study group.' });
  }
});

// 3. GET GROUP DETAILS
router.get('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const group = db.prepare(`SELECT * FROM study_groups WHERE id = ?`).get(id) as any;
    if (!group) {
      res.status(404).json({ error: 'Study group not found.' });
      return;
    }

    const membership = db.prepare(`
      SELECT role, status FROM group_members WHERE group_id = ? AND user_id = ?
    `).get(id, currentUserId) as any;

    if (group.is_private && (!membership || membership.status !== 'active')) {
      res.status(403).json({ error: 'This is a private study group. You must be an approved member to view details.' });
      return;
    }

    const members = db.prepare(`
      SELECT gm.id, gm.role, gm.joined_at, u.id as user_id, u.username, u.full_name, u.avatar_url, u.course, u.college
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND gm.status = 'active'
      ORDER BY CASE gm.role WHEN 'owner' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, u.full_name ASC
    `).all(id);

    const announcements = db.prepare(`
      SELECT a.*, u.full_name as author_name, u.username as author_username, u.avatar_url as author_avatar
      FROM group_announcements a
      JOIN users u ON u.id = a.author_id
      WHERE a.group_id = ?
      ORDER BY a.created_at DESC LIMIT 10
    `).all(id);

    const activeRooms = db.prepare(`
      SELECT r.*, u.full_name as host_name
      FROM study_rooms r
      JOIN users u ON u.id = r.host_id
      WHERE r.group_id = ? AND r.is_active = 1
      ORDER BY r.created_at DESC
    `).all(id);

    res.json({
      group,
      membership: membership || null,
      members,
      announcements,
      activeRooms,
    });
  } catch (err: any) {
    console.error('[GET GROUP DETAILS ERROR]', err);
    res.status(500).json({ error: 'Failed to load group.' });
  }
});

// 4. JOIN GROUP (by ID or invite code)
router.post('/join', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { group_id, invite_code } = req.body;
    const currentUserId = req.user!.id;

    let group: any;
    if (invite_code) {
      group = db.prepare(`SELECT * FROM study_groups WHERE invite_code = ?`).get(invite_code.trim().toUpperCase());
    } else if (group_id) {
      group = db.prepare(`SELECT * FROM study_groups WHERE id = ?`).get(group_id);
    }

    if (!group) {
      res.status(404).json({ error: 'Study group not found with provided code or ID.' });
      return;
    }

    const existingMember = db.prepare(`
      SELECT id, status FROM group_members WHERE group_id = ? AND user_id = ?
    `).get(group.id, currentUserId) as any;

    if (existingMember) {
      if (existingMember.status === 'active') {
        res.status(400).json({ error: 'You are already a member of this study group.' });
        return;
      }
      res.status(400).json({ error: 'Your membership request is currently pending approval.' });
      return;
    }

    const now = new Date().toISOString();
    // If public or joined with invite code, status is active
    const status = 'active';

    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
      VALUES (?, ?, ?, 'member', ?, ?)
    `).run(crypto.randomUUID(), group.id, currentUserId, status, now);

    res.json({ message: 'Successfully joined study group!', groupId: group.id });
  } catch (err: any) {
    console.error('[JOIN GROUP ERROR]', err);
    res.status(500).json({ error: 'Failed to join group.' });
  }
});

// 5. LEAVE GROUP
router.post('/:id/leave', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const membership = db.prepare(`
      SELECT id, role FROM group_members WHERE group_id = ? AND user_id = ?
    `).get(id, currentUserId) as any;

    if (!membership) {
      res.status(400).json({ error: 'You are not a member of this group.' });
      return;
    }

    if (membership.role === 'owner') {
      const otherMembers = db.prepare(`
        SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? AND status = 'active'
      `).all(id, currentUserId);

      if (otherMembers.length > 0) {
        res.status(400).json({ error: 'You are the group owner. Please transfer ownership to another member before leaving.' });
        return;
      }
    }

    db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).run(id, currentUserId);
    res.json({ message: 'You have left the study group.' });
  } catch (err: any) {
    console.error('[LEAVE GROUP ERROR]', err);
    res.status(500).json({ error: 'Failed to leave group.' });
  }
});

// 6. INVITE MEMBER VIA EMAIL
router.post('/:id/invite', requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const currentUserId = req.user!.id;

    if (!email) {
      res.status(400).json({ error: 'Recipient email is required.' });
      return;
    }

    const group = db.prepare(`SELECT * FROM study_groups WHERE id = ?`).get(id) as any;
    if (!group) {
      res.status(404).json({ error: 'Study group not found.' });
      return;
    }

    const currentUser = db.prepare(`SELECT full_name FROM users WHERE id = ?`).get(currentUserId) as any;

    await sendEmail(createGroupInvitationEmail(email.trim().toLowerCase(), currentUser.full_name, group.name, group.invite_code));

    res.json({ message: `Invitation sent to ${email.trim()}` });
  } catch (err: any) {
    console.error('[INVITE GROUP ERROR]', err);
    res.status(500).json({ error: 'Failed to send invitation.' });
  }
});

// 7. POST ANNOUNCEMENT
router.post('/:id/announcements', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const currentUserId = req.user!.id;

    if (!title || !content) {
      res.status(400).json({ error: 'Announcement title and content are required.' });
      return;
    }

    const member = db.prepare(`
      SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(id, currentUserId) as any;

    if (!member || (member.role !== 'owner' && member.role !== 'moderator')) {
      res.status(403).json({ error: 'Only owners and moderators can post announcements.' });
      return;
    }

    const announcementId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO group_announcements (id, group_id, author_id, title, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(announcementId, id, currentUserId, title.trim(), content.trim(), now);

    res.status(201).json({ message: 'Announcement posted successfully.' });
  } catch (err: any) {
    console.error('[ANNOUNCEMENT ERROR]', err);
    res.status(500).json({ error: 'Failed to post announcement.' });
  }
});

// 8. MANAGE MEMBER ROLE / REMOVE MEMBER
router.put('/:id/members/:userId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body; // 'owner', 'moderator', 'member'
    const currentUserId = req.user!.id;

    const myRole = db.prepare(`
      SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(id, currentUserId) as any;

    if (!myRole || myRole.role !== 'owner') {
      res.status(403).json({ error: 'Only the group owner can change member roles.' });
      return;
    }

    if (role === 'owner') {
      // Transfer ownership
      db.transaction(() => {
        db.prepare(`UPDATE group_members SET role = 'moderator' WHERE group_id = ? AND user_id = ?`).run(id, currentUserId);
        db.prepare(`UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?`).run(id, userId);
      })();
      res.json({ message: 'Ownership transferred successfully.' });
      return;
    }

    db.prepare(`UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`).run(role, id, userId);
    res.json({ message: `Member role updated to ${role}.` });
  } catch (err: any) {
    console.error('[MANAGE MEMBER ERROR]', err);
    res.status(500).json({ error: 'Failed to update member.' });
  }
});

// REMOVE MEMBER
router.delete('/:id/members/:userId', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id, userId } = req.params;
    const currentUserId = req.user!.id;

    const myRole = db.prepare(`
      SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'
    `).get(id, currentUserId) as any;

    if (!myRole || (myRole.role !== 'owner' && myRole.role !== 'moderator')) {
      res.status(403).json({ error: 'Insufficient permissions to remove members.' });
      return;
    }

    db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).run(id, userId);
    res.json({ message: 'Member removed from group.' });
  } catch (err: any) {
    console.error('[REMOVE MEMBER ERROR]', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

export default router;
