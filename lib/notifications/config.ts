import { z } from "zod";

const notificationConfigSchema = z.object({
  // Prefer environment-first config for serverless.
  appBaseUrl: z.string().url().optional(),

  // Optional QStash dispatch (more reliable than after())
  qstashToken: z.string().optional(),
  qstashCurrentSigningKey: z.string().optional(),
  qstashNextSigningKey: z.string().optional(),

  notificationsDispatchUrl: z.string().url().optional(),
  notificationsDispatchSecret: z.string().optional(),

  // Email providers
  resendApiKey: z.string().optional(),
  emailFrom: z.string().optional(),
  
  // SMTP Configuration (for Gmail)
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),

  // Twilio (optional)
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioFrom: z.string().optional(),
  
  // SMS Gateway (GET-based)
  smsBaseUrl: z.string().optional(),
  smsApiKey: z.string().optional(),

  // Panic recipients (comma-separated E.164 numbers)
  securityPhones: z
    .string()
    .optional()
    .default("")
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    ),
});

export type NotificationConfig = z.infer<typeof notificationConfigSchema>;

let cached: NotificationConfig | null = null;

export function getNotificationConfig(): NotificationConfig {
  if (cached) return cached;

  const parsed = notificationConfigSchema.parse({
    appBaseUrl:
      process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL,

    qstashToken: process.env.QSTASH_TOKEN,
    qstashCurrentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    qstashNextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,

    notificationsDispatchUrl: process.env.NOTIFICATIONS_DISPATCH_URL,
    notificationsDispatchSecret: process.env.NOTIFICATIONS_DISPATCH_SECRET,

    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,

    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.TWILIO_FROM,
    
    smsBaseUrl: process.env.SMS_BASE_URL,
    smsApiKey: process.env.SMS_API_KEY,

    securityPhones: process.env.SECURITY_PHONES,
  });

  cached = parsed;
  return parsed;
}
