import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (ENV.RESEND_API_KEY) {
      this.isConfigured = true;
      logger.info(
        `[EmailService] Configured with Resend HTTPS API (Port 443 — firewall resistant)`,
        undefined,
        'Email'
      );
      return;
    }

    if (ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS) {
      try {
        const isGmail = ENV.SMTP_HOST.toLowerCase().includes('gmail');
        const pass = ENV.SMTP_PASS.replace(/\s+/g, ''); // remove any accidental spaces in app password
        let transportConfig: any;

        if (isGmail) {
          transportConfig = {
            service: 'gmail',
            auth: {
              user: ENV.SMTP_USER.trim(),
              pass,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
          };
        } else {
          transportConfig = {
            host: ENV.SMTP_HOST,
            port: ENV.SMTP_PORT,
            secure: ENV.SMTP_PORT === 465,
            auth: {
              user: ENV.SMTP_USER.trim(),
              pass,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
          };
        }

        this.transporter = nodemailer.createTransport(transportConfig);
        this.isConfigured = true;
        logger.info(
          `[EmailService] SMTP transporter configured for host: ${ENV.SMTP_HOST}:${ENV.SMTP_PORT} (${ENV.SMTP_USER})`,
          undefined,
          'Email'
        );
      } catch (err: any) {
        logger.error(`[EmailService] Failed to initialize SMTP transporter: ${err.message}`, err, 'Email');
        this.isConfigured = false;
        this.transporter = null;
      }
    } else {
      this.isConfigured = false;
      this.transporter = null;
      logger.info(
        `[EmailService] SMTP credentials not fully provided. Running in development/console simulation mode.`,
        undefined,
        'Email'
      );
    }
  }

  public async sendMail(options: EmailOptions): Promise<boolean> {
    const from = ENV.SMTP_FROM || `DrawMate <${ENV.SMTP_USER || 'no-reply@drawmate.app'}>`;

    // 1. Try Resend HTTPS API if key is present (never blocked by Render)
    if (ENV.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ENV.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: from.includes('<') ? from : `DrawMate <${ENV.SMTP_USER || 'onboarding@resend.dev'}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          logger.info(`[EmailService] Resend API email dispatched to ${options.to}: ${data?.id}`, undefined, 'Email');
          return true;
        } else {
          const errorText = await res.text();
          logger.error(`[EmailService] Resend API error response: ${errorText}`, undefined, 'Email');
        }
      } catch (err: any) {
        logger.error(`[EmailService] Resend API call failed: ${err.message}`, err, 'Email');
      }
    }

    // 2. Try SMTP transport
    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        logger.info(`[EmailService] Email dispatched to ${options.to}: ${info.messageId}`, undefined, 'Email');
        return true;
      } catch (error: any) {
        logger.error(`[EmailService] SMTP dispatch failed for ${options.to}: ${error.message}`, error, 'Email');
        // Do not throw to avoid crashing auth flows on transient SMTP errors
        return false;
      }
    }

    // 3. Fallback / development simulation
    console.log(`\n======================================================`);
    console.log(`[EMAIL DISPATCH SIMULATION]`);
    console.log(`From:    ${from}`);
    console.log(`To:      ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`------------------------------------------------------`);
    console.log(options.text);
    console.log(`======================================================\n`);
    return true;
  }

  /**
   * 1. Welcome & Email Verification (Link + 6-digit OTP code)
   */
  public async sendVerificationEmail(
    to: string,
    username: string,
    verificationLink: string,
    otpCode: string
  ): Promise<boolean> {
    // Explicitly log OTP code for quick server/Render log inspection
    logger.info(
      `[EmailService] 🔑 VERIFICATION CODE FOR ${to}: [ ${otpCode} ] (Link: ${verificationLink})`,
      undefined,
      'Email'
    );
    const subject = 'DrawMate - Verify your email address & Welcome!';
    const text = `Hi ${username},

Welcome to DrawMate — The Multiplayer Drawing & Guessing Platform!

Please verify your email address to activate your full account features:
Option 1: Click the verification link below:
${verificationLink}

Option 2: Enter this 6-digit OTP code on the verification page:
${otpCode}

This code and link are valid for 24 hours.

Happy Sketching,
The DrawMate Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .brand { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; letter-spacing: -0.5px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin: 16px 0; }
    .btn:hover { background: #4f46e5; }
    .otp-box { background: #0f172a; border: 2px dashed #6366f1; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #a5b4fc; }
    .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
    .link-alt { word-break: break-all; font-size: 12px; color: #818cf8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🎨 DrawMate</div>
    <h1>Welcome aboard, ${username}!</h1>
    <p>Thank you for joining DrawMate. To secure your account and unlock room hosting, leaderboards, and AI Practice, please verify your email address.</p>
    
    <div style="text-align: center;">
      <a href="${verificationLink}" class="btn" target="_blank">Verify Email Address</a>
    </div>

    <div class="otp-box">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
        Or enter this 6-Digit Verification Code:
      </div>
      <div class="otp-code">${otpCode}</div>
    </div>

    <p style="font-size: 12px; color: #94a3b8;">Or copy and paste this link into your browser:</p>
    <p class="link-alt">${verificationLink}</p>
    <p style="color: #94a3b8; font-size: 12px;">This verification link and code are valid for 24 hours.</p>

    <div class="footer">
      If you did not sign up for DrawMate, please ignore this email.
    </div>
  </div>
</body>
</html>`;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * 2. Password Reset Email
   */
  public async sendPasswordResetEmail(to: string, resetLink: string, username?: string): Promise<boolean> {
    const greeting = username ? `Hi ${username},` : 'Hello,';
    const subject = 'DrawMate - Password Reset Request';

    const text = `${greeting}

We received a request to reset your DrawMate account password.
Please click or visit the link below to set a new password:

${resetLink}

This link is valid for 15 minutes. If you did not request this password reset, please ignore this email or contact support.

Warm regards,
The DrawMate Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .brand { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin: 16px 0; }
    .btn:hover { background: #4f46e5; }
    .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
    .link-alt { word-break: break-all; font-size: 12px; color: #818cf8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🎨 DrawMate</div>
    <h1>Reset Your Password</h1>
    <p>${greeting}</p>
    <p>We received a request to reset your DrawMate account password. Click the button below to choose a new password:</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="btn" target="_blank">Reset My Password</a>
    </div>
    <p style="font-size: 12px; color: #94a3b8;">Or paste this link into your browser:</p>
    <p class="link-alt">${resetLink}</p>
    <p style="color: #94a3b8; font-size: 12px;">This security link expires in 15 minutes.</p>
    <div class="footer">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </div>
  </div>
</body>
</html>`;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * 3. Security Alert: New Login Notification Email
   */
  public async sendLoginAlertEmail(
    to: string,
    username: string,
    details: { ip: string; userAgent: string; time: string; resetLink: string }
  ): Promise<boolean> {
    const subject = 'DrawMate Security Alert - New Login Detected';
    const text = `Hi ${username},

A new login to your DrawMate account was detected:

Time: ${details.time}
IP Address: ${details.ip}
Device / Browser: ${details.userAgent}

If this was you, no action is needed.
If this was NOT you, please secure your account immediately by resetting your password:
${details.resetLink}

Stay safe,
The DrawMate Security Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; }
    .brand { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 12px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #0f172a; border-radius: 12px; overflow: hidden; }
    .info-table td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
    .info-table td.label { font-weight: 600; color: #94a3b8; width: 35%; }
    .btn-danger { display: inline-block; background: #e11d48; color: #ffffff !important; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 12px; }
    .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🛡️ DrawMate Security</div>
    <h1>New Sign-in to Your Account</h1>
    <p>Hi ${username}, a new login was just recorded for your DrawMate account.</p>

    <table class="info-table">
      <tr><td class="label">Time (UTC)</td><td>${details.time}</td></tr>
      <tr><td class="label">IP Address</td><td>${details.ip}</td></tr>
      <tr><td class="label">Device</td><td>${details.userAgent}</td></tr>
    </table>

    <p style="color: #94a3b8; font-size: 13px;">If this was you, you can ignore this alert.</p>
    <p style="color: #fca5a5; font-size: 13px; font-weight: 600;">If you did not initiate this login, reset your password right now:</p>
    
    <div>
      <a href="${details.resetLink}" class="btn-danger" target="_blank">Secure My Account</a>
    </div>

    <div class="footer">
      DrawMate Automated Security Monitor.
    </div>
  </div>
</body>
</html>`;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * 4. Promotional / Product Announcement / Special Offer Email
   */
  public async sendProductUpdateEmail(
    to: string,
    username: string,
    title: string,
    bodyContent: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<boolean> {
    const subject = `DrawMate Announcement: ${title}`;
    const text = `Hi ${username},

${title}

${bodyContent}

${actionUrl ? `${actionText || 'Check it out'}: ${actionUrl}` : ''}

Best regards,
The DrawMate Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; }
    .brand { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin: 16px 0; }
    .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">🎨 DrawMate</div>
    <h1>${title}</h1>
    <p>Hi ${username},</p>
    <div style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
      ${bodyContent}
    </div>
    ${
      actionUrl
        ? `<div style="text-align: center; margin-top: 20px;">
      <a href="${actionUrl}" class="btn" target="_blank">${actionText || 'Open DrawMate'}</a>
    </div>`
        : ''
    }
    <div class="footer">
      You are receiving this update because you subscribed to DrawMate announcements. You can manage preferences anytime in your Settings.
    </div>
  </div>
</body>
</html>`;

    return this.sendMail({ to, subject, text, html });
  }
}

export const emailService = new EmailService();
