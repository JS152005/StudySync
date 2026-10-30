import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { config } from '../config/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Ensure upload directory exists
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

// Multer storage with safe randomized filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const allowedMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, Images, Text, Markdown, Word documents.'));
    }
  },
});

// 1. LIST RESOURCES (User, Group, or Public)
router.get('/', requireAuth, (req: AuthRequest, res): void => {
  try {
    const currentUserId = req.user!.id;
    const { group_id, room_id } = req.query;

    let resources: any[] = [];
    if (group_id) {
      resources = db.prepare(`
        SELECT r.*, u.full_name as author_name, u.username as author_username
        FROM resources r
        JOIN users u ON u.id = r.user_id
        WHERE r.group_id = ?
        ORDER BY r.created_at DESC
      `).all(group_id);
    } else if (room_id) {
      resources = db.prepare(`
        SELECT r.*, u.full_name as author_name, u.username as author_username
        FROM resources r
        JOIN users u ON u.id = r.user_id
        WHERE r.room_id = ?
        ORDER BY r.created_at DESC
      `).all(room_id);
    } else {
      // General library: user's own resources + their active groups' resources (strictly private)
      resources = db.prepare(`
        SELECT r.*, u.full_name as author_name, u.username as author_username, g.name as group_name
        FROM resources r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN study_groups g ON g.id = r.group_id
        WHERE r.user_id = ?
           OR (r.group_id IS NOT NULL AND r.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active'))
        ORDER BY r.created_at DESC LIMIT 50
      `).all(currentUserId, currentUserId);
    }

    res.json({ resources });
  } catch (err: any) {
    console.error('[GET RESOURCES ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve resources.' });
  }
});

// 2. UPLOAD RESOURCE FILE
router.post('/upload', requireAuth, upload.single('file'), (req: AuthRequest, res: Response): void => {
  try {
    const file = req.file;
    const { title, description, group_id, room_id, is_public } = req.body;
    const currentUserId = req.user!.id;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    let fileType = 'document';
    if (file.mimetype.startsWith('image/')) fileType = 'image';
    else if (file.mimetype === 'application/pdf') fileType = 'pdf';
    else if (file.mimetype.startsWith('text/')) fileType = 'note';

    const resourceId = crypto.randomUUID();
    const fileUrl = `/api/resources/download/${file.filename}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO resources (
        id, user_id, group_id, room_id, title, description, file_type, file_url,
        file_size, mime_type, original_name, is_public, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      resourceId,
      currentUserId,
      group_id || null,
      room_id || null,
      title?.trim() || file.originalname,
      description?.trim() || '',
      fileType,
      fileUrl,
      file.size,
      file.mimetype,
      file.originalname,
      now
    );

    const created = db.prepare(`
      SELECT r.*, u.full_name as author_name, u.username as author_username
      FROM resources r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `).get(resourceId);

    res.status(201).json({ message: 'Resource uploaded successfully.', resource: created });
  } catch (err: any) {
    console.error('[UPLOAD RESOURCE ERROR]', err);
    res.status(500).json({ error: 'Failed to upload resource.' });
  }
});

// 3. CREATE LINK OR NOTE RESOURCE (Strictly private)
router.post('/link', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { title, description, url, group_id, room_id, file_type } = req.body;
    const currentUserId = req.user!.id;

    if (!title || !url) {
      res.status(400).json({ error: 'Title and URL/content are required.' });
      return;
    }

    const resourceId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO resources (
        id, user_id, group_id, room_id, title, description, file_type, file_url,
        file_size, mime_type, original_name, is_public, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'text/plain', ?, 0, ?)
    `).run(
      resourceId,
      currentUserId,
      group_id || null,
      room_id || null,
      title.trim(),
      description?.trim() || '',
      file_type || 'link',
      url.trim(),
      title.trim(),
      now
    );

    const created = db.prepare(`SELECT * FROM resources WHERE id = ?`).get(resourceId);
    res.status(201).json({ resource: created });
  } catch (err: any) {
    console.error('[CREATE LINK RESOURCE ERROR]', err);
    res.status(500).json({ error: 'Failed to create resource.' });
  }
});

// 4. DOWNLOAD / SERVE FILE SAFELY (Preventing Path Traversal & Enforcing Private Authorization)
router.get('/download/:filename', requireAuth, (req: AuthRequest, res): void => {
  try {
    const filename = String(req.params.filename);
    const currentUserId = req.user!.id;

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(config.uploadsDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    const resource = db.prepare(`SELECT * FROM resources WHERE file_url LIKE ?`).get(`%${safeFilename}%`) as any;

    if (resource) {
      const isAuthor = resource.user_id === currentUserId;
      let hasGroupAccess = false;
      if (resource.group_id) {
        const gm = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = "active"').get(resource.group_id, currentUserId);
        hasGroupAccess = !!gm;
      }
      let hasRoomAccess = false;
      if (resource.room_id) {
        const rp = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?').get(resource.room_id, currentUserId);
        const host = db.prepare('SELECT id FROM study_rooms WHERE id = ? AND host_id = ?').get(resource.room_id, currentUserId);
        hasRoomAccess = !!rp || !!host;
      }

      if (!isAuthor && !hasGroupAccess && !hasRoomAccess) {
        res.status(403).json({ error: 'You do not have permission to access this private resource.' });
        return;
      }
    }

    const downloadName = resource ? resource.original_name : safeFilename;
    const mime = resource ? resource.mime_type : 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    console.error('[DOWNLOAD FILE ERROR]', err);
    res.status(500).json({ error: 'Failed to download file.' });
  }
});

// 5. DELETE RESOURCE
router.delete('/:id', requireAuth, (req: AuthRequest, res): void => {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.id;

    const resource = db.prepare(`SELECT * FROM resources WHERE id = ?`).get(id) as any;
    if (!resource) {
      res.status(404).json({ error: 'Resource not found.' });
      return;
    }

    if (resource.user_id !== currentUserId) {
      res.status(403).json({ error: 'Only the resource author can delete this file.' });
      return;
    }

    // If local file, delete it
    if (resource.file_url.startsWith('/api/resources/download/')) {
      const fileName = path.basename(resource.file_url);
      const filePath = path.join(config.uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare(`DELETE FROM resources WHERE id = ?`).run(id);
    res.json({ message: 'Resource deleted successfully.' });
  } catch (err: any) {
    console.error('[DELETE RESOURCE ERROR]', err);
    res.status(500).json({ error: 'Failed to delete resource.' });
  }
});

export default router;
