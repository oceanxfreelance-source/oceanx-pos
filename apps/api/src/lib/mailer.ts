import nodemailer from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import type { AppConfig } from '../config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
  /** Only populated by the in-memory transport (tests). */
  outbox: MailMessage[];
}

export function createMailer(config: AppConfig, log: FastifyBaseLogger): Mailer {
  const outbox: MailMessage[] = [];
  if (config.MAIL_TRANSPORT === 'smtp') {
    if (!config.SMTP_URL) throw new Error('SMTP_URL is required when MAIL_TRANSPORT=smtp');
    const transport = nodemailer.createTransport(config.SMTP_URL);
    return {
      outbox,
      async send(msg) {
        await transport.sendMail({ from: config.MAIL_FROM, ...msg });
      },
    };
  }
  if (config.MAIL_TRANSPORT === 'memory') {
    return {
      outbox,
      async send(msg) {
        outbox.push(msg);
      },
    };
  }
  // "log" transport: development only (loadConfig refuses it in production).
  return {
    outbox,
    async send(msg) {
      log.warn({ mail: msg }, '[dev mail] email not sent — MAIL_TRANSPORT=log');
    },
  };
}
