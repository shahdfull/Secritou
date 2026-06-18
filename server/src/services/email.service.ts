import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer";
import { env } from "../config/env.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: SendMailOptions["attachments"];
}

// ─── Transport factory ───────────────────────────────────────────────────────

function createTransport(): Transporter {
  // Development: use Ethereal preview if no SMTP is configured
  if (!env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: "localhost",
      port: 1025,
      ignoreTLS: true,
    });
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14, // max 14 messages/second
  });
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!_transport) _transport = createTransport();
  return _transport;
}

// ─── From address ────────────────────────────────────────────────────────────

const FROM_ADDRESS = env.SMTP_USER
  ? `"Secritou" <${env.SMTP_USER}>`
  : '"Secritou" <noreply@secritou.com>';

// ─── EmailService ────────────────────────────────────────────────────────────

export const emailService = {
  /**
   * Send a single email. Throws on permanent SMTP error.
   * Transient errors (connection reset, rate limit) are handled by BullMQ retry.
   */
  async send(options: SendEmailOptions): Promise<void> {
    const transport = getTransport();

    const info = await transport.sendMail({
      from: FROM_ADDRESS,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text ?? stripHtml(options.html),
      replyTo: options.replyTo,
      attachments: options.attachments,
    });

    // In development, log the Ethereal preview URL if available
    if (env.NODE_ENV !== "production") {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.info(`[email] Preview: ${previewUrl}`);
      } else {
        console.info(`[email] Sent to ${options.to} — messageId: ${info.messageId}`);
      }
    }
  },

  /** Verify SMTP connectivity (used at startup or in health checks). */
  async verify(): Promise<boolean> {
    try {
      await getTransport().verify();
      return true;
    } catch {
      return false;
    }
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
