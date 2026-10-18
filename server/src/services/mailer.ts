import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // true for 465, false for 587 (uses STARTTLS)
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }
  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!config.smtp.user || !config.smtp.pass) {
      console.warn('[MAILER] SMTP credentials not fully configured. Email skipped for:', options.to);
      return false;
    }

    const mailer = getTransporter();
    const info = await mailer.sendMail({
      from: config.smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`[MAILER] Email sent successfully to ${options.to}. MessageId: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[MAILER ERROR] Failed to send email to ${options.to}:`, error.message);
    return false;
  }
}

// 1. Email Verification Template
export function createVerificationEmail(to: string, name: string, token: string): EmailOptions {
  const verifyUrl = `${config.appBaseUrl}/verify-email?token=${token}`;
  return {
    to,
    subject: 'StudySync — Verify Your Student Account',
    text: `Hello ${name},\n\nWelcome to StudySync! Please verify your student email address by opening the following link:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.\n\nHappy Studying,\nThe StudySync Team`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F0F8FF; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #E6E6FA; border-radius: 8px; padding: 24px;">
          <h2 style="color: #4b4453; margin-top: 0;">Welcome to StudySync</h2>
          <p style="color: #555555; line-height: 1.6;">Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #555555; line-height: 1.6;">Thank you for registering on StudySync. Please verify your email address to unlock full student collaboration features.</p>
          <div style="margin: 25px 0;">
            <a href="${verifyUrl}" style="background-color: #E6E6FA; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 1px solid #d4d4f7;">Verify Email Address</a>
          </div>
          <p style="color: #777777; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${verifyUrl}" style="color: #6a5acd;">${verifyUrl}</a></p>
          <p style="color: #888888; font-size: 12px; border-top: 1px solid #E6E6FA; padding-top: 12px; margin-top: 24px;">This link will expire in 24 hours. If you did not create this account, please ignore this email.</p>
        </div>
      </div>
    `,
  };
}

// 2. Forgot-Password Reset Link Template
export function createPasswordResetEmail(to: string, name: string, token: string): EmailOptions {
  const resetUrl = `${config.appBaseUrl}/reset-password?token=${token}`;
  return {
    to,
    subject: 'StudySync — Password Reset Request',
    text: `Hello ${name},\n\nWe received a request to reset your StudySync account password.\n\nUse this link to choose a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this reset, your account is safe and no changes were made.\n\nThe StudySync Security Team`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F0F8FF; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #E6E6FA; border-radius: 8px; padding: 24px;">
          <h2 style="color: #4b4453; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #555555; line-height: 1.6;">Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #555555; line-height: 1.6;">We received a request to reset the password for your StudySync account. Click below to securely set a new password:</p>
          <div style="margin: 25px 0;">
            <a href="${resetUrl}" style="background-color: #E6E6FA; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 1px solid #d4d4f7;">Reset Password</a>
          </div>
          <p style="color: #777777; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #6a5acd;">${resetUrl}</a></p>
          <p style="color: #888888; font-size: 12px; border-top: 1px solid #E6E6FA; padding-top: 12px; margin-top: 24px;">This single-use reset link expires in 30 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  };
}

// 3. Password-Change Confirmation Template
export function createPasswordChangedEmail(to: string, name: string): EmailOptions {
  return {
    to,
    subject: 'StudySync — Security Alert: Password Changed',
    text: `Hello ${name},\n\nThis is a confirmation that your StudySync password was just changed.\n\nIf you performed this action, no further steps are needed.\nIf you did NOT make this change, please contact your administrator or reset your password immediately.\n\nStudySync Security Team`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F0F8FF; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #E6E6FA; border-radius: 8px; padding: 24px;">
          <h2 style="color: #4b4453; margin-top: 0;">Password Successfully Changed</h2>
          <p style="color: #555555; line-height: 1.6;">Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #555555; line-height: 1.6;">Your StudySync password was successfully updated. All previous sessions have been secured.</p>
          <p style="color: #888888; font-size: 12px; border-top: 1px solid #E6E6FA; padding-top: 12px; margin-top: 24px;">If you did not perform this change, please request another password reset immediately to secure your account.</p>
        </div>
      </div>
    `,
  };
}

// 4. Study-Group Invitation Template
export function createGroupInvitationEmail(to: string, inviterName: string, groupName: string, inviteCode: string): EmailOptions {
  const joinUrl = `${config.appBaseUrl}/groups/join?code=${inviteCode}`;
  return {
    to,
    subject: `StudySync — ${inviterName} invited you to join "${groupName}"`,
    text: `Hello,\n\n${inviterName} has invited you to join the study group "${groupName}" on StudySync.\n\nJoin the group using this link:\n${joinUrl}\nInvite Code: ${inviteCode}\n\nLearn together. Teach each other. Achieve more.\nStudySync`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F0F8FF; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #E6E6FA; border-radius: 8px; padding: 24px;">
          <h2 style="color: #4b4453; margin-top: 0;">Study Group Invitation</h2>
          <p style="color: #555555; line-height: 1.6;"><strong>${escapeHtml(inviterName)}</strong> invited you to collaborate in <strong>"${escapeHtml(groupName)}"</strong> on StudySync.</p>
          <div style="margin: 25px 0;">
            <a href="${joinUrl}" style="background-color: #E6E6FA; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 1px solid #d4d4f7;">Join Study Group</a>
          </div>
          <p style="color: #777777; font-size: 13px;">Invite Code: <strong>${escapeHtml(inviteCode)}</strong></p>
        </div>
      </div>
    `,
  };
}

// 5. Study-Session Invitation Template
export function createSessionInvitationEmail(to: string, inviterName: string, sessionName: string, roomId: string): EmailOptions {
  const roomUrl = `${config.appBaseUrl}/rooms/${roomId}`;
  return {
    to,
    subject: `StudySync — Live Session Invitation: ${sessionName}`,
    text: `Hello,\n\n${inviterName} has invited you to join a live study room: "${sessionName}".\n\nJoin now: ${roomUrl}\n\nStudySync`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F0F8FF; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 2px solid #E6E6FA; border-radius: 8px; padding: 24px;">
          <h2 style="color: #4b4453; margin-top: 0;">Live Study Room Invitation</h2>
          <p style="color: #555555; line-height: 1.6;"><strong>${escapeHtml(inviterName)}</strong> has invited you to participate in a live study session: <strong>"${escapeHtml(sessionName)}"</strong>.</p>
          <div style="margin: 25px 0;">
            <a href="${roomUrl}" style="background-color: #E6E6FA; color: #333333; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 1px solid #d4d4f7;">Enter Study Room</a>
          </div>
        </div>
      </div>
    `,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
