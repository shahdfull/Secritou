import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer";
import logger from "../utils/logger.js";
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
  : '"Secritou" <contact@secritou.tn>';

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
        logger.info({ previewUrl }, "[email] Preview");
      } else {
        logger.info({ to: options.to, messageId: info.messageId }, "[email] Sent");
      }
    }
  },

  async sendPasswordResetEmail(options: { to: string; name: string; resetUrl: string }) {
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Réinitialisation de votre mot de passe Secritou</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .note { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
          <h1>Bonjour ${options.name},</h1>
          <p>Vous avez demandé la réinitialisation de votre mot de passe Secritou.</p>
          <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe (valable 1 heure :</p>
          <a href="${options.resetUrl}" class="button">Réinitialiser mon mot de passe</a>
          <p class="note">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
          <p class="note">${options.resetUrl}</p>
          <p class="note">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          </div>
        </body>
      </html>
    `;
    const text = `Bonjour ${options.name},

Vous avez demandé la réinitialisation de votre mot de passe Secritou.

Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valable 1 heure) :
${options.resetUrl}

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.`;

    await this.send({
      to: options.to,
      subject: "Réinitialisation de votre mot de passe Secritou",
      html,
      text,
    });
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
