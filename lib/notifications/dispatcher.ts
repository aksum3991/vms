import type { Prisma, Settings } from "@prisma/client";
import db from "../db";
import { getNotificationConfig } from "./config";
import type {
  Approver1PendingReminderEvent,
  BlacklistAttemptEvent,
  EmergencyPanicEvent,
  GuestCheckoutConfirmationEvent,
  NotificationEvent,
} from "./events";
import { enqueueAfter } from "./background";
import { retry } from "./retry";
import { getEmailProviderFromEnvOrSettings } from "./providers/email";
import { getSmsProviderFromEnvOrSettings } from "./providers/sms";

type Tx = Prisma.TransactionClient;

function nowIso() {
  return new Date().toISOString();
}

async function getSettingsRow(tx?: Tx): Promise<Settings | null> {
  const client = tx ?? db;
  return client.settings.findFirst({ where: { id: 1 } });
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

  const settings = await getSettingsRow();
  let emailProvider = await getEmailProviderFromEnvOrSettings(
    settings ?? undefined,
  );
  let smsProvider = await getSmsProviderFromEnvOrSettings(settings ?? undefined);

  // console.log(`[notifications] Initial provider check: Email=${!!emailProvider}, SMS=${!!smsProvider}`);

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
            emailProvider = await getEmailProviderFromEnvOrSettings();
          }
          if (!emailProvider) throw new Error("No email provider configured");
          
          // console.log(`[notifications] Sending email to: ${d.recipient} using ${emailProvider.constructor.name}`);
          
          await retry(
            async () => {
              await emailProvider!.send({
                to: d.recipient,
                subject: d.subject ?? "Notification",
                text: d.body,
              });
            },
            { retries: 2, baseDelayMs: 500 },
          );

          // console.log(`[notifications] Email sent successfully to: ${d.recipient}`);
          
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
            // console.warn(`[notifications] SMS provider missing. Attempting last-ditch fetch.`);
            smsProvider = await getSmsProviderFromEnvOrSettings();
          }
          if (!smsProvider) throw new Error("No SMS provider configured");

          // console.log(`[notifications] Sending SMS to: ${d.recipient} using ${smsProvider.constructor.name}`);

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
  args: { userId: string; type: string; message: string; requestId: string },
) {
  return tx.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      message: args.message,
      requestId: args.requestId,
    },
  });
}

async function queueDispatches(
  tx: Tx,
  args: {
    notificationId: string;
    email?: { to: string; subject?: string; body: string }[];
    sms?: { to: string; body: string }[];
  },
) {
  const email = args.email ?? [];
  const sms = args.sms ?? [];

  const rows: Prisma.NotificationDispatchCreateManyInput[] = [
    ...email.map<Prisma.NotificationDispatchCreateManyInput>((e) => ({
      notificationId: args.notificationId,
      channel: "email" as const,
      recipient: e.to,
      subject: e.subject ?? null,
      body: e.body,
      status: "queued" as const,
    })),
    ...sms.map<Prisma.NotificationDispatchCreateManyInput>((s) => ({
      notificationId: args.notificationId,
      channel: "sms" as const,
      recipient: s.to,
      subject: null,
      body: s.body,
      status: "queued" as const,
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
    email?: { to: string; subject?: string; body: string }[];
    sms?: { to: string; body: string }[];
  },
): Promise<string> {
  const n = await createInAppNotification(tx, {
    userId: args.userId,
    type: args.type,
    message: args.message,
    requestId: args.requestId,
  });

  await queueDispatches(tx, {
    notificationId: n.id,
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
  email?: { to: string; subject?: string; body: string }[];
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
  const settings = await getSettingsRow();

  const req = await db.request.findUnique({
    where: { id: event.requestId },
    select: { requestedById: true, gate: true, destination: true },
  });
  if (!req) return;

  const surveyUrl = cfg.appBaseUrl
    ? `${cfg.appBaseUrl}/survey?requestId=${encodeURIComponent(event.requestId)}`
    : "/survey";
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
