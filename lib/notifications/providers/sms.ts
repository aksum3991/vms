import { isTransientHttpStatus } from "../retry";
import db from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getNotificationConfig } from "../config";

export type SmsPayload = {
  to: string;
  message: string;
};

export type SmsSendResult = {
  provider: string;
  providerMessageId?: string;
};

export interface SmsProvider {
  send(payload: SmsPayload): Promise<SmsSendResult>;
}

export class HttpSmsGatewayProvider implements SmsProvider {
  private url: string;
  private apiKey?: string;

  constructor(args: { url: string; apiKey?: string }) {
    this.url = args.url;
    this.apiKey = args.apiKey;
  }

  async send(payload: SmsPayload): Promise<SmsSendResult> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ to: payload.to, message: payload.message }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `SMS gateway failed: ${res.status} ${text || ""}`.trim(),
      );
      (err as any).httpStatus = res.status;
      (err as any).transient = isTransientHttpStatus(res.status);
      throw err;
    }

    return { provider: "sms-gateway" };
  }
}

export class HttpSmsGatewayGetProvider implements SmsProvider {
  private baseUrl: string;
  private apiKey?: string;

  constructor(args: { baseUrl: string; apiKey?: string }) {
    this.baseUrl = args.baseUrl;
    this.apiKey = args.apiKey;
  }

  async send(payload: SmsPayload): Promise<SmsSendResult> {
    // Build URL with query parameters (matching Python implementation)
    const params = new URLSearchParams();
    params.set("phonenumber", payload.to);
    params.set("message", payload.message);
    
    // If API key is in the base URL, use it as-is, otherwise append params
    const separator = this.baseUrl.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${separator}${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `SMS gateway failed: ${res.status} ${text || ""}`.trim(),
      );
      (err as any).httpStatus = res.status;
      (err as any).transient = isTransientHttpStatus(res.status);
      throw err;
    }

    return { provider: "sms-gateway-get" };
  }
}

export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private from: string;

  constructor(args: { accountSid: string; authToken: string; from: string }) {
    this.accountSid = args.accountSid;
    this.authToken = args.authToken;
    this.from = args.from;
  }

  async send(payload: SmsPayload): Promise<SmsSendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const form = new URLSearchParams();
    form.set("From", this.from);
    form.set("To", payload.to);
    form.set("Body", payload.message);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
            "base64",
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `Twilio failed: ${res.status} ${text || ""}`.trim(),
      );
      (err as any).httpStatus = res.status;
      (err as any).transient = isTransientHttpStatus(res.status);
      throw err;
    }

    return { provider: "twilio" };
  }
}

export async function getSmsProviderFromEnvOrSettings(settings?: {
  smsGatewayUrl?: string | null;
  smsApiKey?: string | null;
}): Promise<SmsProvider | null> {
  // If no settings passed, attempt to fetch from DB
  let activeSettings = settings;
  if (!activeSettings) {
    const row = await db.settings.findFirst({ where: { id: 1 } });
    if (row) activeSettings = row;
  }

  const cfg = getNotificationConfig();

  // 1. Check database settings (POST-based by default for UI, highest priority)
  if (activeSettings?.smsGatewayUrl) {
    return new HttpSmsGatewayProvider({
      url: activeSettings.smsGatewayUrl,
      apiKey: activeSettings.smsApiKey ? decrypt(activeSettings.smsApiKey) : undefined,
    });
  }

  // 2. Check environment SMS gateway (GET-based, fallback)
  if (cfg.smsBaseUrl) {
    // Build full URL with API key if provided
    const baseUrl = cfg.smsApiKey 
      ? `${cfg.smsBaseUrl}?key=${cfg.smsApiKey}`
      : cfg.smsBaseUrl;
    
    return new HttpSmsGatewayGetProvider({
      baseUrl,
    });
  }

  // 3. Check Twilio (fallback)
  if (cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioFrom) {
    return new TwilioSmsProvider({
      accountSid: cfg.twilioAccountSid,
      authToken: cfg.twilioAuthToken,
      from: cfg.twilioFrom,
    });
  }

  return null;
}
