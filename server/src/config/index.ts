import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
  jwtSecret: process.env.JWT_SECRET || 'studysync_dev_secret_key_change_in_production_min32chars',
  databasePath: process.env.DATABASE_PATH || './studysync.db',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || 'jsctsmail@gmail.com',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'StudySync <jsctsmail@gmail.com>',
  },
  uploadsDir: path.resolve(process.cwd(), 'uploads'),
};
