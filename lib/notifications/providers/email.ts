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
  attachments?: {
    filename: string;
    content: string | Buffer;
    cid?: string;
    contentType?: string;
    encoding?: string;
  }[];
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
        ...(payload.attachments
          ? {
              attachments: payload.attachments.map((a) => ({
                filename: a.filename,
                content: typeof a.content === "string" ? a.content : a.content.toString("base64"),
              })),
            }
          : {}),
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
      secure: args.port === 465, // true for 465, false for other ports (STARTTLS)
      auth: { user: args.user, pass: args.pass },
      tls: {
        // Modern TLS settings; remove SSLv3 as it's insecure and rejected by Gmail/modern servers
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
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        cid: a.cid,
        contentType: a.contentType,
        encoding: a.encoding as any, // "base64" etc.
      })),
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
  tenantId?: string | null;
},
tenantId?: string): Promise<EmailProvider | null> {
  const cfg = getNotificationConfig();

  const resolveFromSettings = (
    source?: {
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpUser?: string | null;
      smtpPassword?: string | null;
      emailGatewayUrl?: string | null;
      emailApiKey?: string | null;
    } | null,
  ): EmailProvider | null => {
    if (!source) return null;

    if (
      source.smtpHost &&
      source.smtpPort &&
      source.smtpUser &&
      source.smtpPassword
    ) {
      return new SmtpEmailProvider({
        host: source.smtpHost,
        port: source.smtpPort,
        user: source.smtpUser,
        pass: decrypt(source.smtpPassword),
      });
    }

    if (source.emailGatewayUrl) {
      return new HttpEmailGatewayProvider({
        url: source.emailGatewayUrl,
        apiKey: source.emailApiKey ? decrypt(source.emailApiKey) : undefined,
      });
    }

    return null;
  };

  // 1) Explicit settings passed by caller (usually tenant settings) - highest priority.
  const explicitProvider = resolveFromSettings(settings);
  if (explicitProvider) return explicitProvider;

  // 2) Try to load tenant settings from DB when caller provided tenant context.
  const effectiveTenantId = tenantId ?? settings?.tenantId;
  if (effectiveTenantId) {
    const tenantRow = await db.settings.findFirst({ where: { tenantId: effectiveTenantId } });
    const tenantProvider = resolveFromSettings(tenantRow);
    if (tenantProvider) return tenantProvider;
  }

  // 3) Fallback to any DB settings row (legacy/single-tenant compatibility).
  if (!settings) {
    const row = await db.settings.findFirst({ where: {} });
    const rowProvider = resolveFromSettings(row);
    if (rowProvider) return rowProvider;
  }

  // 4) Environment SMTP fallback.
  if (cfg.smtpHost && cfg.smtpPort && cfg.smtpUser && cfg.smtpPassword) {
    return new SmtpEmailProvider({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      user: cfg.smtpUser,
      pass: cfg.smtpPassword,
      from: cfg.emailFrom || cfg.smtpUser,
    });
  }

  // 5) Resend fallback.
  if (cfg.resendApiKey && cfg.emailFrom) {
    return new ResendEmailProvider({
      apiKey: cfg.resendApiKey,
      from: cfg.emailFrom,
    });
  }

  return null;
}
