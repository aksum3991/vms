import type { Prisma, Settings } from "@prisma/client";
import db from "../db";
import { getNotificationConfig } from "./config";
import type {
  Approver1PendingReminderEvent,
  BlacklistAttemptEvent,
  EmergencyPanicEvent,
  GuestCheckoutConfirmationEvent,
  NotificationEvent,
  UserRegistrationEvent,
} from "./events";
import { enqueueAfter } from "./background";
import { retry } from "./retry";
import { getEmailProviderFromEnvOrSettings } from "./providers/email";
import { getSmsProviderFromEnvOrSettings } from "./providers/sms";

// type Tx = Prisma.TransactionClient;
type Tx = any; // Relaxed to support extended client transactions

function nowIso() {
  return new Date().toISOString();
}

async function getSettingsRow(tx?: Tx): Promise<Settings | null> {
  const client = tx ?? db;
  return client.settings.findFirst({ where: {} });
}

function shouldRetry(err: any): boolean {
  if (!err) return false;
  if (err.transient === true) return true;
  const msg = String(err?.message ?? err);
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("fetch") ||
    msg.includes("network")
  );
}

export async function enqueueNotificationProcessing(notificationId: string) {
  const cfg = getNotificationConfig();

  // Optional: use QStash for reliable background delivery if configured.
  if (
    cfg.qstashToken &&
    cfg.notificationsDispatchUrl &&
    cfg.notificationsDispatchSecret
  ) {
    try {
      const publishUrl = `https://qstash.upstash.io/v2/publish/${encodeURIComponent(cfg.notificationsDispatchUrl)}`;
      const res = await fetch(publishUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.qstashToken}`,
          "Content-Type": "application/json",
          // forward auth header to our route
          "Upstash-Forward-Authorization": `Bearer ${cfg.notificationsDispatchSecret}`,
        },
        body: JSON.stringify({ notificationId }),
      });

      if (res.ok) return;
    } catch {
      // fall through to after()
    }
  }

  enqueueAfter(async () => {
    await processNotification(notificationId);
  });
}

export async function enqueueNotificationProcessingById(
  notificationId: string,
): Promise<void> {
  await enqueueNotificationProcessing(notificationId);
}

export async function processNotification(
  notificationId: string,
): Promise<void> {
  const dispatches = await db.notificationDispatch.findMany({
    where: { notificationId, status: "queued" },
    orderBy: { createdAt: "asc" },
  });

  if (dispatches.length === 0) return;

  // Use tenantId from dispatches to fetch correct settings
  const tenantId = dispatches[0].tenantId;
  const settings = tenantId && tenantId !== "default-tenant-id"
    ? await db.settings.findFirst({ where: { tenantId } })
    : await getSettingsRow();

  let emailProvider = await getEmailProviderFromEnvOrSettings(
    settings ?? undefined,
    tenantId ?? undefined,
  );
  let smsProvider = await getSmsProviderFromEnvOrSettings(settings ?? undefined);

  console.log(`[notifications] Initial provider check: Email=${!!emailProvider}, SMS=${!!smsProvider}`);

  await Promise.allSettled(
    dispatches.map(async (d) => {
      const attemptsNow = d.attempts + 1;
      await db.notificationDispatch.update({
        where: { id: d.id },
        data: { attempts: attemptsNow },
      });

      try {
        if (d.channel === "email") {
          if (!emailProvider) {
            console.warn(`[notifications] Email provider missing. Attempting last-ditch fetch.`);
            emailProvider = await getEmailProviderFromEnvOrSettings(undefined, tenantId ?? undefined);
          }
          if (!emailProvider) throw new Error("Email wasn't configured");
          
          console.log(`[notifications] Sending email to: ${d.recipient} using ${emailProvider.constructor.name}`);
          
          await retry(
            async () => {
              const dispatch = d as any;
              await emailProvider!.send({
                to: dispatch.recipient,
                subject: dispatch.subject ?? "Notification",
                text: dispatch.body,
                html: dispatch.html ?? undefined,
                attachments: dispatch.attachments as any,
              });
            },
            { retries: 2, baseDelayMs: 500 },
          );

          console.log(`[notifications] Email sent successfully to: ${d.recipient}`);
          
          await db.notificationDispatch.update({
            where: { id: d.id },
            data: {
              status: "sent",
              provider: emailProvider
                ? (emailProvider as any).constructor?.name
                : undefined,
            },
          });
          return;
        }

        if (d.channel === "sms") {
          if (!smsProvider) {
            console.warn(`[notifications] SMS provider missing. Attempting last-ditch fetch.`);
            smsProvider = await getSmsProviderFromEnvOrSettings();
          }
          if (!smsProvider) throw new Error("No SMS provider configured");

          console.log(`[notifications] Sending SMS to: ${d.recipient} using ${smsProvider.constructor.name}`);

          await retry(
            async () => {
              await smsProvider!.send({ to: d.recipient, message: d.body });
            },
            { retries: 2, baseDelayMs: 500 },
          );

          await db.notificationDispatch.update({
            where: { id: d.id },
            data: {
              status: "sent",
              provider: smsProvider
                ? (smsProvider as any).constructor?.name
                : undefined,
            },
          });
          return;
        }

        throw new Error(`Unsupported channel: ${d.channel}`);
      } catch (err: any) {
        const retryable = shouldRetry(err);
        console.error(`[notifications] Failed to send ${d.channel} to ${d.recipient}:`, err);
        console.error(`[notifications] Error details:`, {
          message: err?.message,
          code: err?.code,
          retryable,
          attempts: attemptsNow,
        });
        
        await db.notificationDispatch.update({
          where: { id: d.id },
          data: {
            status: "failed",
            lastError: String(err?.message ?? err),
            provider: d.provider ?? undefined,
          },
        });

        // If retryable, leave status failed but attempts incremented; next scheduled run can re-queue.
        if (retryable && attemptsNow < 3) {
          await db.notificationDispatch.update({
            where: { id: d.id },
            data: { status: "queued" },
          });
        }
      }
    }),
  );
}

async function createInAppNotification(
  tx: Tx,
  args: { userId: string; type: string; message: string; requestId: string; tenantId?: string | null },
) {
  return tx.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      message: args.message,
      requestId: args.requestId,
      // tenantId required by schema — use provided or derive from user's tenant
      tenantId: args.tenantId ?? "default-tenant-id",
    },
  });
}

async function queueDispatches(
  tx: Tx,
  args: {
    notificationId: string;
    tenantId?: string | null;
    email?: { to: string; subject?: string; body: string; html?: string; attachments?: any[] }[];
    sms?: { to: string; body: string }[];
  },
) {
  const email = args.email ?? [];
  const sms = args.sms ?? [];
  const tenantId = args.tenantId ?? "default-tenant-id";

  const rows: Prisma.NotificationDispatchCreateManyInput[] = [
    ...email.map<Prisma.NotificationDispatchCreateManyInput>((e) => ({
      notificationId: args.notificationId,
      channel: "email" as const,
      recipient: e.to,
      subject: e.subject ?? null,
      body: e.body,
      html: e.html ?? null,
      attachments: e.attachments ?? null,
      status: "queued" as const,
      tenantId,
    })),
    ...sms.map<Prisma.NotificationDispatchCreateManyInput>((s) => ({
      notificationId: args.notificationId,
      channel: "sms" as const,
      recipient: s.to,
      subject: null,
      body: s.body,
      status: "queued" as const,
      tenantId,
    })),
  ];

  if (rows.length === 0) return;
  await tx.notificationDispatch.createMany({ data: rows });
}

export async function createUserNotificationAndDispatchRecords(
  tx: Tx,
  args: {
    userId: string;
    type: string;
    message: string;
    requestId: string;
    tenantId?: string; // Add tenantId
    email?: { to: string; subject?: string; body: string; html?: string; attachments?: any[] }[];
    sms?: { to: string; body: string }[];
  },
): Promise<string> {
  const n = await createInAppNotification(tx, {
    userId: args.userId,
    type: args.type,
    message: args.message,
    requestId: args.requestId,
    tenantId: args.tenantId, // Pass it
  });

  await queueDispatches(tx, {
    notificationId: n.id,
    tenantId: args.tenantId, // Pass it
    email: args.email,
    sms: args.sms,
  });

  return n.id;
}

export async function createUserNotificationAndDispatch(args: {
  userId: string;
  type: string;
  message: string;
  requestId: string;
  tenantId?: string;
  email?: { to: string; subject?: string; body: string; html?: string; attachments?: any[] }[];
  sms?: { to: string; body: string }[];
}): Promise<string> {
  const id = await db.$transaction(async (tx) => {
    return createUserNotificationAndDispatchRecords(tx, args);
  });

  await enqueueNotificationProcessing(id);
  return id;
}

async function emitBlacklistAttempt(
  event: BlacklistAttemptEvent,
): Promise<void> {
  const settings = await getSettingsRow();
  const admins = await db.user.findMany({
    where: { role: "admin", active: true },
    select: { id: true, email: true, name: true },
  });

  const requestId = event.requestId ?? "blacklist";
  const msg = `Blacklist attempt: ${event.guest.name}${event.guest.organization ? ` (${event.guest.organization})` : ""} by ${event.requesterName ?? event.requesterEmail ?? event.requesterId}`;

  await Promise.allSettled(
    admins.map(async (a) => {
      const created = await db.$transaction(async (tx) => {
        const notif = await createInAppNotification(tx, {
          userId: a.id,
          type: "blacklist_alert",
          message: msg,
          requestId,
        });

        if (settings?.emailNotifications && a.email) {
          await queueDispatches(tx, {
            notificationId: notif.id,
            email: [
              {
                to: a.email,
                subject: "VMS3 Blacklist Alert",
                body: `${msg}\nMatchedBy: ${(event.matchedBy ?? []).join(", ") || "unknown"}\nTime: ${event.timestamp}`,
              },
            ],
          });
        }

        return notif;
      });

      await enqueueNotificationProcessing(created.id);
    }),
  );
}

async function emitApprover1PendingReminder(
  event: Approver1PendingReminderEvent,
): Promise<void> {
  const settings = await getSettingsRow();

  // Idempotency: don't spam the same reminder too often.
  const existing = await db.notification.findFirst({
    where: {
      type: "approver1_pending_reminder",
      requestId: event.requestId,
      createdAt: { gt: new Date(Date.now() - 20 * 60 * 60 * 1000) },
    },
  });
  if (existing) return;

  const approvers = await db.user.findMany({
    where: { role: "approver1", active: true },
    select: { id: true, email: true },
  });
  const msg = `Reminder: Request ${event.requestId} has been pending approver1 > 24h.`;

  await Promise.allSettled(
    approvers.map(async (a) => {
      const notif = await db.$transaction(async (tx) => {
        const n = await createInAppNotification(tx, {
          userId: a.id,
          type: "approver1_pending_reminder",
          message: msg,
          requestId: event.requestId,
        });

        if (settings?.emailNotifications && a.email) {
          await queueDispatches(tx, {
            notificationId: n.id,
            email: [
              { to: a.email, subject: "VMS3 Approval Reminder", body: msg },
            ],
          });
        }

        return n;
      });

      await enqueueNotificationProcessing(notif.id);
    }),
  );
}

async function emitGuestCheckoutConfirmation(
  event: GuestCheckoutConfirmationEvent,
): Promise<void> {
  const cfg = getNotificationConfig();
  const req = await db.request.findUnique({
    where: { id: event.requestId },
    select: { requestedById: true, gate: true, destination: true, tenantId: true },
  });
  if (!req) return;

  const settings = await db.settings.findFirst({ where: { tenantId: req.tenantId } });

  const surveyUrl = cfg.appBaseUrl
    ? `${cfg.appBaseUrl}/public/survey?requestId=${encodeURIComponent(event.requestId)}&guestId=${encodeURIComponent((event.guest as any).id)}`
    : `/public/survey?requestId=${encodeURIComponent(event.requestId)}&guestId=${encodeURIComponent((event.guest as any).id)}`;
  const body = `Hello${event.guest.name ? ` ${event.guest.name}` : ""}, your check-out has been recorded. Please share feedback: ${surveyUrl}`;

  const notif = await db.$transaction(async (tx) => {
    const n = await createInAppNotification(tx, {
      userId: req.requestedById,
      type: "guest_checkout_confirmation_sent",
      message: `Check-out confirmation sent to guest ${event.guest.name}.`,
      requestId: event.requestId,
    });

    const emailDispatches =
      settings?.emailNotifications && event.guest.email
        ? [
            {
              to: event.guest.email,
              subject: "VMS3 Check-out Confirmation",
              body,
            },
          ]
        : [];

    const smsDispatches =
      settings?.smsNotifications && event.guest.phone
        ? [{ to: event.guest.phone, body }]
        : [];

    await queueDispatches(tx, {
      notificationId: n.id,
      tenantId: req.tenantId, // Pass the correct tenantId
      email: emailDispatches,
      sms: smsDispatches,
    });

    return n;
  });

  await enqueueNotificationProcessing(notif.id);
}

async function emitEmergencyPanic(event: EmergencyPanicEvent): Promise<void> {
  const cfg = getNotificationConfig();
  const settings = await getSettingsRow();

  const phones = cfg.securityPhones;
  const msg = `EMERGENCY (VMS3)${event.location ? `\nLocation: ${event.location}` : ""}${event.message ? `\nMessage: ${event.message}` : ""}\nTime: ${event.timestamp}`;

  // Create an in-app notification for admins (audit trail) and enqueue SMS dispatches.
  const admins = await db.user.findMany({
    where: { role: "admin", active: true },
    select: { id: true },
  });

  await Promise.allSettled(
    admins.map(async (a) => {
      const notif = await db.$transaction(async (tx) => {
        const n = await createInAppNotification(tx, {
          userId: a.id,
          type: "emergency_alert",
          message: `Emergency panic triggered by reception user ${event.triggeredByUserId}.`,
          requestId: "emergency",
        });

        if (settings?.smsNotifications && phones.length) {
          await queueDispatches(tx, {
            notificationId: n.id,
            sms: phones.map((p) => ({ to: p, body: msg })),
          });
        }

        return n;
      });

      await enqueueNotificationProcessing(notif.id);
    }),
  );
}

async function emitUserRegistration(event: UserRegistrationEvent): Promise<void> {
  const settings = await getSettingsRow();
  const body = `Welcome to ${event.tenantName}, ${event.name}!\n\nYour account has been created with the role: ${event.role}.\n${event.temporaryPassword ? `Temporary Password: ${event.temporaryPassword}\n\n` : ""}Please log in here: ${process.env.NEXTAUTH_URL}/login`;

  // We don't create an in-app notification for the user since they haven't logged in yet,
  // but we enqueue the email dispatch.
  if (settings?.emailNotifications && event.email) {
    const id = await db.$transaction(async (tx) => {
      // Create a notification record for the user
      const n = await (tx.notification as any).create({
        data: {
          userId: event.userId,
          type: "user_registration_invite",
          message: `Invitation sent to ${event.email}`,
          requestId: "system",
          tenantId: event.tenantId,
        },
      });

      await queueDispatches(tx, {
        notificationId: n.id,
        email: [{ to: event.email, subject: `Welcome to ${event.tenantName}`, body }],
      });
      return n.id;
    });

    await enqueueNotificationProcessing(id);
  }
}

export async function emitNotificationEvent(
  event: NotificationEvent,
): Promise<void> {
  switch (event.type) {
    case "blacklist.attempt":
      return emitBlacklistAttempt(event);
    case "approval.approver1.pending-reminder":
      return emitApprover1PendingReminder(event);
    case "guest.checkout.confirmation":
      return emitGuestCheckoutConfirmation(event);
    case "security.panic":
      return emitEmergencyPanic(event);
    case "user.registration":
      return emitUserRegistration(event);
    default: {
      const never: never = event;
      throw new Error(`Unhandled notification event: ${(never as any)?.type}`);
    }
  }
}

export async function emitBlacklistAttemptNow(
  input: Omit<BlacklistAttemptEvent, "type" | "timestamp">,
) {
  return emitNotificationEvent({
    ...input,
    type: "blacklist.attempt",
    timestamp: nowIso(),
  });
}

export async function emitApprover1PendingReminderNow(
  input: Omit<Approver1PendingReminderEvent, "type" | "timestamp">,
) {
  return emitNotificationEvent({
    ...input,
    type: "approval.approver1.pending-reminder",
    timestamp: nowIso(),
  });
}

export async function emitGuestCheckoutConfirmationNow(
  input: Omit<GuestCheckoutConfirmationEvent, "type" | "timestamp">,
) {
  return emitNotificationEvent({
    ...input,
    type: "guest.checkout.confirmation",
    timestamp: nowIso(),
  });
}

export async function emitEmergencyPanicNow(
  input: Omit<EmergencyPanicEvent, "type" | "timestamp">,
) {
  return emitNotificationEvent({
    ...input,
    type: "security.panic",
    timestamp: nowIso(),
  });
}
export async function emitUserRegistrationNow(
  input: Omit<UserRegistrationEvent, "type" | "timestamp">,
) {
  return emitNotificationEvent({
    ...input,
    type: "user.registration",
    timestamp: nowIso(),
  });
}
