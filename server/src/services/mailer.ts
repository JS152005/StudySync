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

// 1. Email Verification Template (with 6-Digit OTP)
export function createVerificationEmail(to: string, name: string, token: string): EmailOptions {
  const verifyUrl = `${config.appBaseUrl}/verify-email?token=${token}&email=${encodeURIComponent(to)}`;
  return {
    to,
    subject: 'StudySync — Verify Your Student Account (OTP Code)',
    text: `Hello ${name},\n\nWelcome to StudySync! Your 6-digit verification code (OTP) is:\n\n${token}\n\nEnter this code on the verification screen to activate your account, or open the link below:\n\n${verifyUrl}\n\nThis code will expire in 24 hours.\n\nHappy Studying,\nThe StudySync Team`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F8FAFC; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 10px; background-color: rgba(2, 132, 199, 0.1); color: #0284C7; font-size: 22px;">✉️</div>
            <h2 style="color: #0F172A; margin: 12px 0 4px 0; font-size: 20px; font-weight: 800;">Verify Your Student Account</h2>
            <p style="color: #64748B; font-size: 13px; margin: 0;">Hello <strong>${escapeHtml(name)}</strong>, welcome to StudySync!</p>
          </div>

          <p style="color: #334155; line-height: 1.6; font-size: 14px;">Please enter the following 6-digit verification code on the verification page to activate your student account:</p>

          <div style="margin: 24px 0; text-align: center;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">6-Digit Verification OTP</div>
            <div style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284C7; font-family: monospace; background: #F0F9FF; border: 2px dashed #0284C7; padding: 12px 24px; border-radius: 8px;">
              ${escapeHtml(token)}
            </div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 8px;">Valid for 24 hours</div>
          </div>

          <div style="margin: 20px 0; text-align: center;">
            <a href="${verifyUrl}" style="background-color: #0284C7; color: #FFFFFF; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13px;">Auto-Verify with One Click</a>
          </div>

          <p style="color: #94A3B8; font-size: 12px; border-top: 1px solid #E2E8F0; padding-top: 14px; margin-top: 20px; text-align: center;">Or copy and paste this verification link:<br/><a href="${verifyUrl}" style="color: #0284C7;">${verifyUrl}</a></p>
          <p style="color: #94A3B8; font-size: 11px; margin-top: 8px; text-align: center;">If you did not create this account, please disregard this message.</p>
        </div>
      </div>
    `,
  };
}

// 2. Forgot-Password Reset OTP Email Template
export function createPasswordResetEmail(to: string, name: string, tokenOrOtp: string): EmailOptions {
  return createPasswordResetOtpEmail(to, name, tokenOrOtp);
}

export function createPasswordResetOtpEmail(to: string, name: string, otp: string): EmailOptions {
  return {
    to,
    subject: 'StudySync — Password Reset Verification Code (OTP)',
    text: `Hello ${name},\n\nWe received a request to reset your StudySync account password.\n\nYour 6-digit verification code (OTP) is:\n\n${otp}\n\nEnter this code on the password reset screen to verify your identity and set a new password.\n\nThis verification code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email. Your account remains secure.\n\nThe StudySync Security Team`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #F8FAFC; padding: 30px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 10px; background-color: rgba(2, 132, 199, 0.1); color: #0284C7; font-size: 22px;">🔒</div>
            <h2 style="color: #0F172A; margin: 12px 0 4px 0; font-size: 20px; font-weight: 800;">Reset Your Password</h2>
            <p style="color: #64748B; font-size: 13px; margin: 0;">Hello <strong>${escapeHtml(name)}</strong>,</p>
          </div>

          <p style="color: #334155; line-height: 1.6; font-size: 14px;">We received a request to reset your StudySync account password. Please enter the following 6-digit verification code (OTP) on the password reset screen:</p>

          <div style="margin: 24px 0; text-align: center;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">6-Digit Reset Code</div>
            <div style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284C7; font-family: monospace; background: #F0F9FF; border: 2px dashed #0284C7; padding: 12px 24px; border-radius: 8px;">
              ${escapeHtml(otp)}
            </div>
            <div style="font-size: 12px; color: #94A3B8; margin-top: 8px;">Valid for 10 minutes (single-use)</div>
          </div>

          <p style="color: #64748B; font-size: 12.5px; line-height: 1.5; text-align: center;">Do not share this code with anyone. StudySync will never ask for your verification code.</p>

          <p style="color: #94A3B8; font-size: 11px; border-top: 1px solid #E2E8F0; padding-top: 14px; margin-top: 20px; text-align: center;">If you did not request a password reset, you can safely ignore this email. Your password will not change until this code is verified.</p>
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
