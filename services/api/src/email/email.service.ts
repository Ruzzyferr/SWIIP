import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get('SMTP_HOST', 'mail.swiip.app');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get('SMTP_USER', 'info@swiip.app');
    const pass = this.config.get('SMTP_PASS', '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    this.logger.log(`Email transport configured: ${host}:${port} as ${user}`);
  }

  private get from(): string {
    return this.config.get('SMTP_FROM', 'Swiip <info@swiip.app>');
  }

  async sendVerificationCode(
    to: string,
    code: string,
    username: string,
  ): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#16213e;border-radius:12px;padding:40px;color:#e0e0e0;">
    <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;">Swiip</h1>
    <p style="margin:0 0 24px;color:#a0a0b0;font-size:14px;">Email Verification</p>
    <p style="margin:0 0 16px;font-size:16px;">Hey <strong style="color:#ffffff;">${username}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#c0c0d0;">Use the code below to verify your email address:</p>
    <div style="background:#0f3460;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
      <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#e94560;">${code}</span>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#808090;">This code expires in 10 minutes.</p>
    <p style="margin:0;font-size:13px;color:#808090;">If you didn't create a Swiip account, you can ignore this email.</p>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `${code} — Your Swiip verification code`,
        html,
      });
      this.logger.log(`Verification code sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}`, err);
      throw err;
    }
  }

  async sendPasswordReset(
    to: string,
    token: string,
    username: string,
  ): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'https://swiip.app');
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#16213e;border-radius:12px;padding:40px;color:#e0e0e0;">
    <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;">Swiip</h1>
    <p style="margin:0 0 24px;color:#a0a0b0;font-size:14px;">Password Reset</p>
    <p style="margin:0 0 16px;font-size:16px;">Hey <strong style="color:#ffffff;">${username}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#c0c0d0;">Click the link below to reset your password:</p>
    <a href="${resetLink}" style="display:inline-block;background:#e94560;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Reset Password</a>
    <p style="margin:24px 0 8px;font-size:13px;color:#808090;">This link expires in 1 hour.</p>
    <p style="margin:0;font-size:13px;color:#808090;">If you didn't request a password reset, you can ignore this email.</p>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Reset your Swiip password',
        html,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${to}`, err);
      throw err;
    }
  }
}
