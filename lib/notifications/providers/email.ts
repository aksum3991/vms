import nodemailer from "nodemailer";
import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getNotificationConfig } from "../config";
import { isTransientHttpStatus } from "../retry";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = {
  provider: string;
  providerMessageId?: string;
};

export interface EmailProvider {
  send(payload: EmailPayload): Promise<EmailSendResult>;
}

export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor(args: { apiKey: string; from: string }) {
    this.apiKey = args.apiKey;
    this.from = args.from;
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `Resend failed: ${res.status} ${text || ""}`.trim(),
      );
      (err as any).httpStatus = res.status;
      (err as any).transient = isTransientHttpStatus(res.status);
      throw err;
    }

    const json: any = await res.json().catch(() => ({}));
    return { provider: "resend", providerMessageId: json?.id };
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(args: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from?: string;
  }) {
    this.from = args.from ?? args.user;
    this.transporter = nodemailer.createTransport({
      host: args.host,
      port: args.port,
      secure: args.port === 465, // true for 465, false for other ports
      auth: { user: args.user, pass: args.pass },
      tls: {
        // Gmail requires TLS
        ciphers: 'SSLv3',
        rejectUnauthorized: false, // For development; set to true in production
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
    });
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      ...(payload.html ? { html: payload.html } : {}),
    });

    return { provider: "smtp", providerMessageId: (info as any)?.messageId };
  }
}

export class HttpEmailGatewayProvider implements EmailProvider {
  private url: string;
  private apiKey?: string;

  constructor(args: { url: string; apiKey?: string }) {
    this.url = args.url;
    this.apiKey = args.apiKey;
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        message: payload.text,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `Email gateway failed: ${res.status} ${text || ""}`.trim(),
      );
      (err as any).httpStatus = res.status;
      (err as any).transient = isTransientHttpStatus(res.status);
      throw err;
    }

    return { provider: "email-gateway" };
  }
}

export async function getEmailProviderFromEnvOrSettings(settings?: {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  emailGatewayUrl?: string | null;
  emailApiKey?: string | null;
}): Promise<EmailProvider | null> {
  // If no settings passed, attempt to fetch from DB
  let activeSettings = settings;
  if (!activeSettings) {
    const row = await db.settings.findFirst({ where: { id: 1 } });
    if (row) activeSettings = row;
  }

  const cfg = getNotificationConfig();

  // 1. Check database SMTP settings (high priority)
  if (
    activeSettings?.smtpHost &&
    activeSettings.smtpPort &&
    activeSettings.smtpUser &&
    activeSettings.smtpPassword
  ) {
    return new SmtpEmailProvider({
      host: activeSettings.smtpHost,
      port: activeSettings.smtpPort,
      user: activeSettings.smtpUser,
      pass: decrypt(activeSettings.smtpPassword),
    });
  }

  // 2. Check environment SMTP (fallback for Gmail)
  if (cfg.smtpHost && cfg.smtpPort && cfg.smtpUser && cfg.smtpPassword) {
    return new SmtpEmailProvider({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      user: cfg.smtpUser,
      pass: cfg.smtpPassword,
      from: cfg.emailFrom ?? cfg.smtpUser,
    });
  }

  // 3. Check Resend API (fallback)
  if (cfg.resendApiKey && cfg.emailFrom) {
    return new ResendEmailProvider({
      apiKey: cfg.resendApiKey,
      from: cfg.emailFrom,
    });
  }

  // 4. Check database email gateway settings
  if (activeSettings?.emailGatewayUrl) {
    return new HttpEmailGatewayProvider({
      url: activeSettings.emailGatewayUrl,
      apiKey: activeSettings.emailApiKey ? decrypt(activeSettings.emailApiKey) : undefined,
    });
  }

  return null;
}
