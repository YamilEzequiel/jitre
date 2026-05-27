import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Thin email transport. Configurable via env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE,
 *   EMAIL_FROM (defaults to "noreply@<host>")
 *
 * If no SMTP_HOST is set, falls back to "log mode": emails are written to the
 * logger but never sent. Lets dev environments and tests run without any
 * external infra while still exercising the listener path.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transport: Transporter | null = null;
  private fromAddress = 'noreply@jitre.local';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST') ?? process.env.SMTP_HOST;
    if (!host) {
      this.logger.log('SMTP_HOST not set — email service in log-only mode.');
      return;
    }
    const port = Number(this.config.get('SMTP_PORT') ?? process.env.SMTP_PORT ?? 587);
    const user = this.config.get<string>('SMTP_USER') ?? process.env.SMTP_USER;
    const pass = this.config.get<string>('SMTP_PASS') ?? process.env.SMTP_PASS;
    const secure =
      String(this.config.get('SMTP_SECURE') ?? process.env.SMTP_SECURE ?? 'false') === 'true';

    this.transport = createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.fromAddress =
      this.config.get<string>('EMAIL_FROM') ??
      process.env.EMAIL_FROM ??
      `noreply@${host}`;
    this.enabled = true;
    this.logger.log(`Email transport ready: ${host}:${port}`);
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.enabled || !this.transport) {
      this.logger.log(
        `[email log-only] to=${input.to} subject="${input.subject}" ${input.text ? '\n' + input.text.slice(0, 240) : ''}`,
      );
      return;
    }
    try {
      await this.transport.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (err) {
      // Email failures are operational noise — log and swallow so the calling
      // listener doesn't crash unrelated work.
      this.logger.warn(`Failed to send email to ${input.to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
