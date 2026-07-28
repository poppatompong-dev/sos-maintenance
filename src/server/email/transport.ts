import nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailTransport {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  secure?: boolean;
}

/**
 * Creates an SMTP EmailTransport using Nodemailer. Returns null if no SMTP host
 * is configured (fail-safe for optional SMTP environment).
 */
export function createSmtpEmailTransport(config?: SmtpConfig): EmailTransport | null {
  const host = config?.host ?? process.env.SMTP_HOST;
  if (!host) return null;

  const port = config?.port ?? Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = config?.user ?? process.env.SMTP_USER;
  const pass = config?.pass ?? process.env.SMTP_PASS;
  const from =
    config?.from ??
    process.env.EMAIL_FROM ??
    'SOS Maintenance <sos-noreply@nakhonsawan.go.th>';
  const secure = config?.secure ?? (port === 465);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  return {
    async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
      try {
        const info = await transporter.sendMail({
          from,
          to: input.to,
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        });
        return {
          success: true,
          messageId: info.messageId,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

/**
 * In-memory mock EmailTransport for unit testing and deterministic verification.
 */
export function createMockEmailTransport(
  sentLog: SendEmailInput[] = [],
  shouldFail = false,
): EmailTransport {
  return {
    async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
      if (shouldFail) {
        return {
          success: false,
          error: 'Connection refused by mock SMTP server',
        };
      }
      sentLog.push(input);
      return {
        success: true,
        messageId: `mock-msg-${sentLog.length}`,
      };
    },
  };
}
