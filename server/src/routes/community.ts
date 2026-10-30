import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET POSTS FEED (with search, tag filter, sorting, pagination)
router.get('/posts', optionalAuth, (req: AuthRequest, res): void => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim().toLowerCase();
    const tag = (req.query.tag as string || '').trim().toLowerCase();
    const sort = req.query.sort === 'top' ? 'likes_count DESC, p.created_at DESC' : 'p.created_at DESC';
    const currentUserId = req.user?.id || '';

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (LOWER(p.title) LIKE ? OR LOWER(p.content) LIKE ? OR LOWER(p.tags) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (tag) {
      whereClause += ' AND LOWER(p.tags) LIKE ?';
      params.push(`%${tag}%`);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM community_posts p WHERE ${whereClause}`);
    const total = (countStmt.get(...params) as { count: number }).count;
    const totalPages = Math.ceil(total / limit);

    const postsStmt = db.prepare(`
      SELECT
        p.id, p.title, p.content, p.tags, p.attachment_url,
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as author_id, u.student_id as author_student_id, u.username as author_username,
        u.full_name as author_name, u.avatar_url as author_avatar, u.course as author_course,
        CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END as has_liked
      FROM community_posts p
      JOIN users u ON u.id = p.author_id
      LEFT JOIN community_likes l ON l.post_id = p.id AND l.user_id = ?
      WHERE ${whereClause}
      ORDER BY ${sort}
      LIMIT ? OFFSET ?
    `);

    const posts = postsStmt.all(currentUserId, ...params, limit, offset).map((post: any) => ({
      ...post,
      has_liked: post.has_liked === 1,
    }));

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    console.error('[COMMUNITY GET POSTS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch community posts.' });
  }
});

// 2. CREATE POST (Authenticated)
router.post('/posts', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { title, content, tags, attachment_url } = req.body;
    const userId = req.user!.id;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Post title is required.' });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Post content cannot be empty.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanTags = (tags || '').trim();

    db.prepare(`
      INSERT INTO community_posts (
        id, author_id, title, content, tags, attachment_url, likes_count, comments_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(id, userId, title.trim(), content.trim(), cleanTags, attachment_url?.trim() || null, now, now);

    const post = db.prepare(`
      SELECT
        p.id, p.title, p.content, p.tags, p.attachment_url,
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as author_id, u.student_id as author_student_id, u.username as author_username,
        u.full_name as author_name, u.avatar_url as author_avatar, u.course as author_course
      FROM community_posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ?
    `).get(id) as any;

    res.status(201).json({ post: { ...post, has_liked: false } });
  } catch (err: any) {
    console.error('[COMMUNITY CREATE POST ERROR]', err);
    res.status(500).json({ error: 'Failed to create community post.' });
  }
});

// 3. GET SINGLE POST WITH COMMENTS
router.get('/posts/:id', optionalAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id || '';

    const post = db.prepare(`
      SELECT
        p.id, p.title, p.content, p.tags, p.attachment_url,
        p.likes_count, p.comments_count, p.created_at, p.updated_at,
        u.id as author_id, u.student_id as author_student_id, u.username as author_username,
        u.full_name as author_name, u.avatar_url as author_avatar, u.course as author_course,
        CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END as has_liked
      FROM community_posts p
      JOIN users u ON u.id = p.author_id
      LEFT JOIN community_likes l ON l.post_id = p.id AND l.user_id = ?
      WHERE p.id = ?
    `).get(currentUserId, id) as any;

    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const comments = db.prepare(`
      SELECT
        c.id, c.content, c.created_at,
        u.id as author_id, u.student_id as author_student_id, u.username as author_username,
        u.full_name as author_name, u.avatar_url as author_avatar
      FROM community_comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(id);

    res.json({
      post: {
        ...post,
        has_liked: post.has_liked === 1,
      },
      comments,
    });
  } catch (err: any) {
    console.error('[COMMUNITY GET POST ERROR]', err);
    res.status(500).json({ error: 'Failed to load post.' });
  }
});

// 4. EDIT POST (Author only)
router.put('/posts/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { title, content, tags, attachment_url } = req.body;
    const userId = req.user!.id;

    const existing = db.prepare('SELECT author_id FROM community_posts WHERE id = ?').get(id) as { author_id: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    if (existing.author_id !== userId) {
      res.status(403).json({ error: 'You are not authorized to edit this post.' });
      return;
    }

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Title cannot be empty.' });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Content cannot be empty.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE community_posts
      SET title = ?, content = ?, tags = ?, attachment_url = ?, updated_at = ?
      WHERE id = ?
    `).run(title.trim(), content.trim(), (tags || '').trim(), attachment_url?.trim() || null, now, id);

    res.json({ message: 'Post updated successfully.' });
  } catch (err: any) {
    console.error('[COMMUNITY EDIT POST ERROR]', err);
    res.status(500).json({ error: 'Failed to update post.' });
  }
});

// 5. DELETE POST (Author only)
router.delete('/posts/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = db.prepare('SELECT author_id FROM community_posts WHERE id = ?').get(id) as { author_id: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    if (existing.author_id !== userId) {
      res.status(403).json({ error: 'You are not authorized to delete this post.' });
      return;
    }

    db.prepare('DELETE FROM community_posts WHERE id = ?').run(id);
    res.json({ message: 'Post deleted successfully.' });
  } catch (err: any) {
    console.error('[COMMUNITY DELETE POST ERROR]', err);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// 6. TOGGLE LIKE ON POST
router.post('/posts/:id/like', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const post = db.prepare('SELECT id, likes_count FROM community_posts WHERE id = ?').get(id) as { id: string; likes_count: number } | undefined;
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const existingLike = db.prepare('SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?').get(id, userId);

    let hasLiked = false;
    let newLikesCount = post.likes_count;

    db.transaction(() => {
      if (existingLike) {
        db.prepare('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?').run(id, userId);
        newLikesCount = Math.max(0, post.likes_count - 1);
        db.prepare('UPDATE community_posts SET likes_count = ? WHERE id = ?').run(newLikesCount, id);
        hasLiked = false;
      } else {
        const likeId = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO community_likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)').run(likeId, id, userId, now);
        newLikesCount = post.likes_count + 1;
        db.prepare('UPDATE community_posts SET likes_count = ? WHERE id = ?').run(newLikesCount, id);
        hasLiked = true;
      }
    })();

    res.json({ has_liked: hasLiked, likes_count: newLikesCount });
  } catch (err: any) {
    console.error('[COMMUNITY LIKE ERROR]', err);
    res.status(500).json({ error: 'Failed to toggle like.' });
  }
});

// 7. ADD COMMENT
router.post('/posts/:id/comments', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user = req.user!;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    const post = db.prepare('SELECT id, comments_count FROM community_posts WHERE id = ?').get(id) as { id: string; comments_count: number } | undefined;
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO community_comments (id, post_id, author_id, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(commentId, id, user.id, content.trim(), now);

      db.prepare('UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = ?').run(id);
    })();

    res.status(201).json({
      comment: {
        id: commentId,
        content: content.trim(),
        created_at: now,
        author_id: user.id,
        author_student_id: user.student_id,
        author_username: user.username,
        author_name: user.full_name,
        author_avatar: user.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('[COMMUNITY ADD COMMENT ERROR]', err);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// 8. DELETE COMMENT (Author only)
router.delete('/comments/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const comment = db.prepare('SELECT id, post_id, author_id FROM community_comments WHERE id = ?').get(id) as { id: string; post_id: string; author_id: string } | undefined;
    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    if (comment.author_id !== userId) {
      res.status(403).json({ error: 'You are not authorized to delete this comment.' });
      return;
    }

    db.transaction(() => {
      db.prepare('DELETE FROM community_comments WHERE id = ?').run(id);
      db.prepare('UPDATE community_posts SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').run(comment.post_id);
    })();

    res.json({ message: 'Comment deleted successfully.' });
  } catch (err: any) {
    console.error('[COMMUNITY DELETE COMMENT ERROR]', err);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

// 9. REPORT POST
router.post('/posts/:id/report', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'Please specify a reason for reporting this post.' });
      return;
    }

    const post = db.prepare('SELECT id FROM community_posts WHERE id = ?').get(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const existingReport = db.prepare('SELECT id FROM community_reports WHERE post_id = ? AND reporter_id = ?').get(id, userId);
    if (existingReport) {
      res.status(400).json({ error: 'You have already reported this post. Our team is reviewing it.' });
      return;
    }

    const reportId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO community_reports (id, post_id, reporter_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(reportId, id, userId, reason.trim(), now);

    res.status(201).json({ message: 'Thank you for your report. The post has been flagged for moderation review.' });
  } catch (err: any) {
    console.error('[COMMUNITY REPORT ERROR]', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
