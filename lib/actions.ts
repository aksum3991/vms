"use server";

import { revalidatePath } from "next/cache";
import { encrypt } from "./crypto";
import db from "./db";
import { getEmailProviderFromEnvOrSettings } from "./notifications/providers/email";
import { getSmsProviderFromEnvOrSettings } from "./notifications/providers/sms";
import type {
  Request,
  Survey,
  User,
  Settings,
  Notification,
  Guest,
  BlacklistEntry,
  AuditLog,
} from "./types";
import type { Status as PrismaStatus } from "@prisma/client";
import { notificationService } from "./notification-service";
import { getNotificationConfig } from "./notifications/config";
import {
  createUserNotificationAndDispatchRecords,
  enqueueNotificationProcessing,
} from "./notifications/dispatcher";

// Mapper functions (internal to this module)
function mapRowToRequest(row: any, guests: Guest[]): Request {
  const status =
    typeof row.status === "string" ? row.status.replace(/_/g, "-") : row.status;
  return {
    id: row.id,
    approvalNumber: row.approvalNumber,
    requestedBy: row.requestedBy?.name || row.requestedByEmail,
    requestedById: row.requestedById,
    requestedByEmail: row.requestedByEmail,
    destination: row.destination,
    gate: row.gate,
    fromDate: new Date(row.fromDate).toISOString().split("T")[0],
    toDate: new Date(row.toDate).toISOString().split("T")[0],
    purpose: row.purpose,
    guests,
    status,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    approver1Comment: row.approver1Comment,
    approver1Date: row.approver1Date
      ? new Date(row.approver1Date).toISOString()
      : undefined,
    approver1By: row.approver1By,
    approver2Comment: row.approver2Comment,
    approver2Date: row.approver2Date
      ? new Date(row.approver2Date).toISOString()
      : undefined,
    approver2By: row.approver2By,
  };
}

function mapRowToGuest(row: any): Guest {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    email: row.email,
    phone: row.phone,
    laptop: row.laptop,
    mobile: row.mobile,
    flash: row.flash,
    otherDevice: row.otherDevice,
    otherDeviceDescription: row.otherDeviceDescription,
    idPhotoUrl: row.idPhotoUrl,
    checkInTime: row.checkInTime
      ? new Date(row.checkInTime).toISOString()
      : undefined,
    checkOutTime: row.checkOutTime
      ? new Date(row.checkOutTime).toISOString()
      : undefined,
    approver1Status:
      typeof row.approver1Status === "string"
        ? row.approver1Status.includes("blacklist") ||
          row.approver1Status.includes("blacklisted")
          ? "blacklisted"
          : row.approver1Status.includes("approved")
            ? "approved"
            : row.approver1Status.includes("rejected")
              ? "rejected"
              : row.approver1Status.includes("pending")
                ? "pending"
                : undefined
        : undefined,
    approver2Status:
      typeof row.approver2Status === "string"
        ? row.approver2Status.includes("blacklist") ||
          row.approver2Status.includes("blacklisted")
          ? "blacklisted"
          : row.approver2Status.includes("approved")
            ? "approved"
            : row.approver2Status.includes("rejected")
              ? "rejected"
              : row.approver2Status.includes("pending")
                ? "pending"
                : undefined
        : undefined,
    approver1Comment: row.approver1Comment || undefined,
    approver2Comment: row.approver2Comment || undefined,
  };
}

function mapRowToSurvey(row: any): Survey {
  return {
    id: row.id,
    requestId: row.requestId,
    guestId: row.guestId,
    rating: row.rating,
    comment: row.comment,
    submittedAt: row.submittedAt.toISOString(),
  };
}

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    assignedGates: row.assignedGates,
    active: row.active ?? true,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function mapRowToSettings(row: any): Settings {
  return {
    approvalSteps: row.approvalSteps,
    emailNotifications: row.emailNotifications,
    smsNotifications: row.smsNotifications,
    checkInOutNotifications: row.checkInOutNotifications,
    gates: row.gates,
    primaryColor: row.primaryColor || "#06b6d4",
    accentColor: row.accentColor || "#0891b2",
    smtpHost: row.smtpHost || undefined,
    smtpPort: row.smtpPort || undefined,
    smtpUser: row.smtpUser || undefined,
    smtpPassword: row.smtpPassword || undefined,
    smsGatewayUrl: row.smsGatewayUrl || undefined,
    smsApiKey: row.smsApiKey || undefined,
    emailGatewayUrl: row.emailGatewayUrl || undefined,
    emailApiKey: row.emailApiKey || undefined,
  };
}

function mapRowToNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    message: row.message,
    requestId: row.requestId,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

function toApprover1Enum(status?: string | null): PrismaStatus | null {
  if (!status) return null;
  if (status === "approved") return "approver1_approved" as PrismaStatus;
  if (status === "blacklisted")
    return "approver1_blacklisted" as unknown as PrismaStatus;
  if (status === "rejected") return "approver1_rejected" as PrismaStatus;
  if (status === "pending") return "approver1_pending" as PrismaStatus;
  return null;
}
function toApprover2Enum(status?: string | null): PrismaStatus | null {
  if (!status) return null;
  if (status === "approved") return "approver2_approved" as PrismaStatus;
  if (status === "blacklisted")
    return "approver2_blacklisted" as unknown as PrismaStatus;
  if (status === "rejected") return "approver2_rejected" as PrismaStatus;
  if (status === "pending") return "approver2_pending" as PrismaStatus;
  return null;
}

// Actions
async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  details: object,
): Promise<void> {
  try {
    const client: any = db as any;
    if (!client.auditLog || !client.auditLog.create) {
      return;
    }
    await client.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details,
      },
    });
  } catch (error) {
    console.error("[actions] Error creating audit log:", error);
  }
}

export async function getRequests(): Promise<Request[]> {
  try {
    const requestsFromDb = await db.request.findMany({
      include: { guests: true, requestedBy: true },
      orderBy: { createdAt: "desc" },
    });
    return requestsFromDb.map((req) =>
      mapRowToRequest(req, req.guests.map(mapRowToGuest)),
    );
  } catch (error) {
    console.error("[actions] Error fetching requests:", error);
    return [];
  }
}

export async function saveRequest(
  request: Omit<Request, "id" | "createdAt" | "updatedAt" | "guests"> & {
    guests: (Omit<Guest, "id"> & { id?: string })[];
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): Promise<void> {
  try {
    const { guests, ...requestData } = request;
    const isUpdate = !!request.id;

    // Ensure there is a user id to associate with the request. If `requestedById` was provided, use it.
    // Otherwise, try to find a user by email and create a lightweight requester if none exists.
    let requestedById = requestData.requestedById || undefined;
    if (!requestedById && requestData.requestedByEmail) {
      const existingUser = await db.user.findUnique({
        where: { email: requestData.requestedByEmail },
      });
      if (existingUser) {
        requestedById = existingUser.id;
      } else {
        // `assignedGates` is required by the schema, provide an empty array
        const createdUser = await db.user.create({
          data: {
            email: requestData.requestedByEmail,
            name: requestData.requestedBy || requestData.requestedByEmail,
            password: Math.random().toString(36).slice(2),
            role: "requester",
            assignedGates: [],
          },
        });
        requestedById = createdUser.id;
      }
    }

    if (!requestedById && requestData.requestedByEmail) {
      const fallbackUser = await db.user.findUnique({
        where: { email: requestData.requestedByEmail },
      });
      if (fallbackUser) {
        requestedById = fallbackUser.id;
      } else {
        const createdUser = await db.user.create({
          data: {
            email: requestData.requestedByEmail,
            name: requestData.requestedBy || requestData.requestedByEmail,
            password: Math.random().toString(36).slice(2),
            role: "requester",
            assignedGates: [],
          },
        });
        requestedById = createdUser.id;
      }
    }
    if (!requestedById) {
      throw new Error("Could not resolve a valid requester user.");
    }

    // Server-side blacklist enforcement + admin alert
    for (const g of guests) {
      const res = await checkBlacklist({
        name: g.name,
        organization: g.organization,
        email: g.email,
        phone: g.phone,
      });
      if (res.blacklisted) {
        // Emit-and-forget admin alert (does not block on gateway)
        await notificationService.blacklistAttempt({
          requesterId: requestedById,
          requesterEmail: requestData.requestedByEmail,
          requesterName: requestData.requestedBy,
          requestId: request.id,
          matchedBy: res.matchedBy,
          guest: {
            name: g.name,
            organization: g.organization,
            email: g.email,
            phone: g.phone,
          },
        });
        throw new Error(`Blacklisted guest detected: ${g.name}`);
      }
    }
    const verifyUser = await db.user.findUnique({
      where: { id: requestedById },
    });
    if (!verifyUser && requestData.requestedByEmail) {
      const fallbackUser = await db.user.findUnique({
        where: { email: requestData.requestedByEmail },
      });
      if (fallbackUser) {
        requestedById = fallbackUser.id;
      } else {
        const createdUser = await db.user.create({
          data: {
            email: requestData.requestedByEmail,
            name: requestData.requestedBy || requestData.requestedByEmail,
            password: Math.random().toString(36).slice(2),
            role: "requester",
            assignedGates: [],
          },
        });
        requestedById = createdUser.id;
      }
    }
    if (!requestedById) {
      throw new Error("Could not resolve a valid requester user.");
    }
    const finalUserCheck = await db.user.findUnique({
      where: { id: requestedById },
    });
    if (!finalUserCheck) {
      throw new Error("User not found for requestedById.");
    }
    const dataToUpsert = {
      requestedById,
      requestedByEmail: requestData.requestedByEmail,
      destination: requestData.destination,
      gate: requestData.gate,
      fromDate: new Date(requestData.fromDate),
      toDate: new Date(requestData.toDate),
      purpose: requestData.purpose,
      status: (typeof requestData.status === "string"
        ? requestData.status.replace(/-/g, "_")
        : requestData.status) as PrismaStatus,
      approvalNumber: requestData.approvalNumber,
      approver1Comment: requestData.approver1Comment,
      approver1Date: requestData.approver1Date
        ? new Date(requestData.approver1Date)
        : null,
      approver1By: requestData.approver1By,
      approver2Comment: requestData.approver2Comment,
      approver2Date: requestData.approver2Date
        ? new Date(requestData.approver2Date)
        : null,
      approver2By: requestData.approver2By,
    };

    if (isUpdate) {
      // Update existing guests or create new ones to preserve guest IDs and status
      const existingGuests = await db.guest.findMany({
        where: { requestId: request.id },
      });
      const existingGuestMap = new Map(existingGuests.map((g) => [g.id, g]));

      for (const guest of guests) {
        const guestData: any = {
          name: guest.name,
          organization: guest.organization,
          email: guest.email,
          phone: guest.phone,
          laptop: guest.laptop,
          mobile: guest.mobile,
          flash: guest.flash,
          otherDevice: guest.otherDevice,
          otherDeviceDescription: guest.otherDeviceDescription,
          idPhotoUrl: guest.idPhotoUrl || null,
          approver1Status: toApprover1Enum(guest.approver1Status || null),
          approver2Status: toApprover2Enum(guest.approver2Status || null),
          approver1Comment: guest.approver1Comment || null,
          approver2Comment: guest.approver2Comment || null,
        };

        if (guest.id && existingGuestMap.has(guest.id)) {
          await db.guest.update({
            where: { id: guest.id },
            data: guestData,
          });
        } else {
          await db.guest.create({
            data: {
              ...guestData,
              requestId: request.id,
            },
          });
        }
      }

      // Delete guests that are no longer in the list
      const currentGuestIds = new Set(
        guests.filter((g) => g.id).map((g) => g.id!),
      );
      const guestsToDelete = existingGuests.filter(
        (g) => !currentGuestIds.has(g.id),
      );
      for (const guest of guestsToDelete) {
        await db.guest.delete({ where: { id: guest.id } });
      }

      const updatedReq = await db.request.update({
        where: { id: request.id },
        data: dataToUpsert,
      });
      await createAuditLog(
        requestedById,
        "UPDATE",
        "Request",
        updatedReq.id,
        dataToUpsert,
      );
      revalidatePath("/requester");
      revalidatePath("/approver1");
      revalidatePath("/approver2");
      revalidatePath("/reception");
    } else {
      const createdReq = await db.request.create({
        data: {
          ...dataToUpsert,
          guests: {
            create: guests.map((g) => ({
              name: g.name,
              organization: g.organization,
              email: g.email,
              phone: g.phone,
              laptop: g.laptop,
              mobile: g.mobile,
              flash: g.flash,
              otherDevice: g.otherDevice,
              otherDeviceDescription: g.otherDeviceDescription,
              idPhotoUrl: g.idPhotoUrl || null,
              approver1Status: toApprover1Enum(g.approver1Status || null),
              approver2Status: toApprover2Enum(g.approver2Status || null),
              approver1Comment: g.approver1Comment || null,
              approver2Comment: g.approver2Comment || null,
            })),
          },
        },
      });
      await createAuditLog(
        requestedById,
        "CREATE",
        "Request",
        createdReq.id,
        dataToUpsert,
      );
      revalidatePath("/");
    }
  } catch (error) {
    console.error("[actions] Error saving request:", error);
    throw error;
  }
}

export async function getRequestById(id: string): Promise<Request | undefined> {
  try {
    const requestFromDb = await db.request.findUnique({
      where: { id },
      include: { guests: true, requestedBy: true },
    });
    if (!requestFromDb) return undefined;
    return mapRowToRequest(
      requestFromDb,
      requestFromDb.guests.map(mapRowToGuest),
    );
  } catch (error) {
    console.error("[actions] Error fetching request:", error);
    return undefined;
  }
}

export async function deleteRequest(id: string): Promise<void> {
  try {
    await db.request.delete({ where: { id } });
    revalidatePath("/admin");
  } catch (error) {
    console.error("[actions] Error deleting request:", error);
    throw error;
  }
}

export async function checkInGuest(
  requestId: string,
  guestId: string,
): Promise<void> {
  try {
    await db.guest.update({
      where: { id: guestId },
      data: { checkInTime: new Date() },
    });
    const req = await db.request.findUnique({ where: { id: requestId } });
    if (req?.requestedById) {
      await createAuditLog(req.requestedById, "CHECK_IN", "Guest", guestId, {
        requestId,
        guestId,
      });
    }
    revalidatePath("/reception");
  } catch (error) {
    console.error("[actions] Error checking in guest", error);
    throw error;
  }
}

export async function checkOutGuest(
  requestId: string,
  guestId: string,
): Promise<void> {
  try {
    const cfg = getNotificationConfig();

    const notificationId = await db.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id: guestId },
        data: { checkOutTime: new Date() },
      });

      const [req, guest, settings] = await Promise.all([
        tx.request.findUnique({ where: { id: requestId } }),
        tx.guest.findUnique({ where: { id: guestId } }),
        tx.settings.findFirst({ where: { id: 1 } }),
      ]);
      if (!req || !guest || !settings) return null;

      const surveyUrl = cfg.appBaseUrl
        ? `${cfg.appBaseUrl}/survey?requestId=${encodeURIComponent(requestId)}`
        : "/survey";

      const body = `Hello${guest.name ? ` ${guest.name}` : ""}, your check-out has been recorded.`;

      const emailDispatches =
        settings.emailNotifications && guest.email
          ? [{ to: guest.email, subject: "VMS3 Check-out Confirmation", body }]
          : [];
      const smsDispatches =
        settings.smsNotifications && guest.phone
          ? [{ to: guest.phone, body }]
          : [];

      // In-app notification (requester) + outbox rows (guest)
      return await createUserNotificationAndDispatchRecords(tx, {
        userId: req.requestedById,
        type: "guest_checkout_confirmation_sent",
        message: `Check-out confirmation queued for guest ${guest.name}.`,
        requestId,
        email: emailDispatches,
        sms: smsDispatches,
      });
    });

    if (notificationId) {
      await enqueueNotificationProcessing(notificationId);
    }

    const req = await db.request.findUnique({ where: { id: requestId } });
    if (req?.requestedById) {
      await createAuditLog(req.requestedById, "CHECK_OUT", "Guest", guestId, {
        requestId,
        guestId,
      });
    }
    revalidatePath("/reception");
    revalidatePath("/survey");
  } catch (error) {
    console.error("[actions] Error checking out guest", error);
    throw error;
  }
}

// Pending approval reminder (>24h in approver1_pending)
export async function runApprover1PendingReminders(): Promise<{
  scanned: number;
}> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = await db.request.findMany({
    where: { status: "approver1_pending", createdAt: { lt: cutoff } },
    select: { id: true, createdAt: true },
    take: 200,
    orderBy: { createdAt: "asc" },
  });

  await Promise.allSettled(
    pending.map(async (r) => {
      await notificationService.approver1PendingReminder({
        requestId: r.id,
        approver1UserId: "role:approver1",
        createdAt: r.createdAt.toISOString(),
      });
    }),
  );

  return { scanned: pending.length };
}

// Reception panic button -> notify security via SMS
export async function triggerEmergencyPanic(input: {
  triggeredByUserId: string;
  location?: string;
  message?: string;
}): Promise<void> {
  await notificationService.emergencyPanic(input);
}

export async function getSurveys(): Promise<Survey[]> {
  try {
    const surveysFromDb = await db.survey.findMany({
      orderBy: { submittedAt: "desc" },
    });
    return surveysFromDb.map(mapRowToSurvey);
  } catch (error) {
    console.error("[actions] Error fetching surveys:", error);
    return [];
  }
}

export async function saveSurvey(
  survey: Omit<Survey, "id" | "submittedAt">,
): Promise<void> {
  try {
    await db.survey.create({ data: survey });
    revalidatePath("/survey");
    revalidatePath("/reception");
  } catch (error) {
    console.error("[actions] Error saving survey:", error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const usersFromDb = await db.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return usersFromDb.map(mapRowToUser);
  } catch (error) {
    console.error("[actions] Error fetching users:", error);
    return [];
  }
}

export async function saveUser(
  user: Omit<User, "id" | "createdAt"> & { id?: string },
): Promise<void> {
  try {
    if (user.id) {
      const updated = await db.user.update({
        where: { id: user.id },
        data: user,
      });
    } else {
      const created = await db.user.create({ data: user });
    }
    const admin = await db.user.findFirst({ where: { role: "admin" } });
    if (admin?.id) {
      await createAuditLog(
        admin.id,
        user.id ? "UPDATE" : "CREATE",
        "User",
        user.id || "new",
        user,
      );
    }
    revalidatePath("/admin");
    revalidatePath("/settings");
  } catch (error) {
    console.error("[actions] Error saving user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const userFromDb = await db.user.findUnique({ where: { email } });
    if (!userFromDb) return undefined;
    return mapRowToUser(userFromDb);
  } catch (error) {
    console.error("[actions] Error fetching user:", error);
    return undefined;
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return;
    }
    await db.user.delete({ where: { id } });
    const admin = await db.user.findFirst({ where: { role: "admin" } });
    if (admin?.id) {
      await createAuditLog(admin.id, "DELETE", "User", id, {});
    }
    revalidatePath("/admin");
  } catch (error) {
    console.error("[actions] Error deleting user:", error);
    throw error;
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    const settingsFromDb = await db.settings.findFirst({ where: { id: 1 } });
    if (!settingsFromDb) {
      return {
        approvalSteps: 2,
        emailNotifications: true,
        smsNotifications: true,
        checkInOutNotifications: true,
        gates: ["228", "229", "230"],
        primaryColor: "#06b6d4",
        accentColor: "#0891b2",
        smtpHost: undefined,
        smtpPort: undefined,
        smtpUser: undefined,
        smtpPassword: undefined,
        smsGatewayUrl: undefined,
        smsApiKey: undefined,
        emailGatewayUrl: undefined,
        emailApiKey: undefined,
      };
    }
    return mapRowToSettings(settingsFromDb);
  } catch (error) {
    console.error("[actions] Error fetching settings:", error);
    return {
      approvalSteps: 2,
      emailNotifications: true,
      smsNotifications: true,
      checkInOutNotifications: true,
      gates: ["228", "229", "230"],
      primaryColor: "#06b6d4",
      accentColor: "#0891b2",
      smtpHost: undefined,
      smtpPort: undefined,
      smtpUser: undefined,
      smtpPassword: undefined,
      smsGatewayUrl: undefined,
      smsApiKey: undefined,
      emailGatewayUrl: undefined,
      emailApiKey: undefined,
    };
  }
}

export async function saveSettings(
  settings: Partial<Settings>,
): Promise<void> {
  try {
    const currentSettings = await getSettings();
    const updatedSettings = { ...currentSettings, ...settings };

    // Encrypt sensitive fields if they have changed or are being set
    if (settings.smtpPassword) {
      updatedSettings.smtpPassword = encrypt(settings.smtpPassword);
    }
    if (settings.smsApiKey) {
      updatedSettings.smsApiKey = encrypt(settings.smsApiKey);
    }

    await db.settings.upsert({
      where: { id: 1 },
      update: updatedSettings,
      create: { id: 1, ...updatedSettings },
    });
    const admin = await db.user.findFirst({ where: { role: "admin" } });
    if (admin?.id) {
      await createAuditLog(
        admin.id,
        "UPDATE",
        "Settings",
        "1",
        updatedSettings,
      );
    }
    revalidatePath("/admin");
    revalidatePath("/settings");
  } catch (error) {
    console.error("[actions] Error saving settings:", error);
    throw error;
  }
}

export async function getNotifications(): Promise<Notification[]> {
  try {
    const notificationsFromDb = await db.notification.findMany({
      orderBy: { createdAt: "desc" },
    });
    return notificationsFromDb.map(mapRowToNotification);
  } catch (error) {
    console.error("[actions] Error fetching notifications:", error);
    return [];
  }
}

export async function saveNotification(
  notification: Omit<Notification, "id" | "createdAt">,
): Promise<void> {
  try {
    const created = await db.notification.create({ data: notification });
    if (notification.userId) {
      await createAuditLog(
        notification.userId,
        "CREATE",
        "Notification",
        created.id,
        notification,
      );
    }
    revalidatePath("/notifications");
  } catch (error) {
    console.error("[actions] Error saving notification:", error);
    throw error;
  }
}

export async function getNotificationsByUserId(
  userId: string,
): Promise<Notification[]> {
  try {
    const notificationsFromDb = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return notificationsFromDb.map(mapRowToNotification);
  } catch (error) {
    console.error("[actions] Error fetching notifications by user:", error);
    return [];
  }
}

export async function triggerApprovalNotifications(
  request: Request,
): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.emailNotifications || settings.smsNotifications) {
      await notificationService.sendApprovalNotifications(request, settings);
    }
  } catch (error) {
    console.error("[actions] Error triggering approval notifications:", error);
  }
}

export async function triggerCheckInNotification(
  requestId: string,
  guestId: string,
): Promise<void> {
  try {
    const [request, settings] = await Promise.all([
      getRequestById(requestId),
      getSettings(),
    ]);
    if (!request) return;
    const guest = request.guests.find((g) => g.id === guestId);
    if (!guest) return;
    if (
      settings.checkInOutNotifications &&
      (settings.emailNotifications || settings.smsNotifications)
    ) {
      await notificationService.sendCheckInNotification(
        request,
        guest,
        settings,
      );
    }
  } catch (error) {
    console.error("[actions] Error triggering check-in notification:", error);
  }
}

export async function triggerCheckOutNotification(
  requestId: string,
  guestId: string,
): Promise<void> {
  try {
    const [request, settings] = await Promise.all([
      getRequestById(requestId),
      getSettings(),
    ]);
    if (!request) return;
    const guest = request.guests.find((g) => g.id === guestId);
    if (!guest) return;
    if (
      settings.checkInOutNotifications &&
      (settings.emailNotifications || settings.smsNotifications)
    ) {
      await notificationService.sendCheckOutNotification(
        request,
        guest,
        settings,
      );
    }
  } catch (error) {
    console.error("[actions] Error triggering check-out notification:", error);
  }
}

export async function testEmailGateway(
  to: string,
  testSettings?: Partial<Settings>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const dbSettings = await getSettings();
    const settings = testSettings
      ? { ...dbSettings, ...testSettings }
      : dbSettings;

    const provider = await getEmailProviderFromEnvOrSettings(settings);
    if (!provider) {
      return { ok: false, error: "Email provider not configured" };
    }

    await provider.send({
      to,
      subject: "VMS3 SMTP Test",
      text: "This is a test email to verify your SMTP configuration.",
    });

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: String(error?.message || error) };
  }
}

export async function testSmsGateway(
  to: string,
  testSettings?: Partial<Settings>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const dbSettings = await getSettings();
    const settings = testSettings
      ? { ...dbSettings, ...testSettings }
      : dbSettings;

    const provider = await getSmsProviderFromEnvOrSettings(settings);
    if (!provider) {
      return { ok: false, error: "SMS provider not configured" };
    }

    await provider.send({
      to,
      message: "VMS3 SMS Test: Gateway connection verified.",
    });

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: String(error?.message || error) };
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const existing = await db.notification.findUnique({ where: { id } });
    await db.notification.update({
      where: { id },
      data: { read: true },
    });
    const actor = existing?.userId;
    if (actor) {
      await createAuditLog(actor, "UPDATE", "Notification", id, { read: true });
    }
    revalidatePath("/notifications");
  } catch (error) {
    console.error("[actions] Error marking notification as read:", error);
    throw error;
  }
}

export async function getBlacklist(): Promise<BlacklistEntry[]> {
  try {
    const entries = await db.blacklistEntry.findMany({
      orderBy: { createdAt: "desc" },
    });
    return entries.map((e) => ({
      id: e.id,
      name: e.name,
      organization: e.organization ?? undefined,
      email: e.email ?? undefined,
      phone: e.phone ?? undefined,
      reason: e.reason ?? undefined,
      active: e.active,
      createdAt: e.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("[actions] Error fetching blacklist:", error);
    return [];
  }
}

export async function saveBlacklistEntry(
  entry: Omit<BlacklistEntry, "createdAt" | "id"> & { id?: string },
): Promise<void> {
  try {
    const data = {
      name: entry.name,
      organization: entry.organization ?? null,
      email: entry.email ?? null,
      phone: entry.phone ?? null,
      reason: entry.reason ?? null,
      active: entry.active,
    };
    if (entry.id) {
      const updated = await db.blacklistEntry.update({
        where: { id: entry.id },
        data,
      });
      const admin = await db.user.findFirst({ where: { role: "admin" } });
      if (admin?.id) {
        await createAuditLog(
          admin.id,
          "UPDATE",
          "BlacklistEntry",
          updated.id,
          entry,
        );
      }
    } else {
      const created = await db.blacklistEntry.create({ data });
      const admin = await db.user.findFirst({ where: { role: "admin" } });
      if (admin?.id) {
        await createAuditLog(
          admin.id,
          "CREATE",
          "BlacklistEntry",
          created.id,
          entry,
        );
      }
    }
    revalidatePath("/admin");
  } catch (error) {
    console.error("[actions] Error saving blacklist entry:", error);
    throw error;
  }
}

export async function deleteBlacklistEntry(id: string): Promise<void> {
  try {
    await db.blacklistEntry.delete({ where: { id } });
    const admin = await db.user.findFirst({ where: { role: "admin" } });
    if (admin?.id) {
      await createAuditLog(admin.id, "DELETE", "BlacklistEntry", id, {});
    }
    revalidatePath("/admin");
  } catch (error) {
    console.error("[actions] Error deleting blacklist entry:", error);
    throw error;
  }
}

export async function checkBlacklist(guest: {
  name?: string;
  organization?: string;
  email?: string;
  phone?: string;
}): Promise<{ blacklisted: boolean; matchedBy?: string[] }> {
  try {
    const ors: any[] = [];
    if (guest.name) {
      ors.push({ name: { equals: guest.name, mode: "insensitive" } });
    }
    if (guest.organization) {
      ors.push({
        organization: { equals: guest.organization, mode: "insensitive" },
      });
    }
    if (guest.email) {
      ors.push({ email: { equals: guest.email, mode: "insensitive" } });
    }
    if (guest.phone) {
      ors.push({ phone: guest.phone });
    }
    if (ors.length === 0) {
      return { blacklisted: false };
    }
    const entry = await db.blacklistEntry.findFirst({
      where: {
        active: true,
        OR: ors,
      },
    });
    if (!entry) return { blacklisted: false };
    const matchedBy: string[] = [];
    if (guest.name && entry.name.toLowerCase() === guest.name.toLowerCase())
      matchedBy.push("name");
    if (
      guest.organization &&
      (entry.organization || "")?.toLowerCase() ===
        guest.organization.toLowerCase()
    )
      matchedBy.push("organization");
    if (
      guest.email &&
      (entry.email || "")?.toLowerCase() === guest.email.toLowerCase()
    )
      matchedBy.push("email");
    if (guest.phone && (entry.phone || "") === guest.phone)
      matchedBy.push("phone");
    return { blacklisted: true, matchedBy };
  } catch (error) {
    console.error("[actions] Error checking blacklist:", error);
    return { blacklisted: false };
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const client: any = db as any;
    if (!client.auditLog || !client.auditLog.findMany) {
      return [];
    }
    const logs = await client.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 100,
      include: { user: true },
    });
    return logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details as object,
      timestamp: log.timestamp.toISOString(),
      userId: log.userId,
      userName: log.user?.name || "System",
    }));
  } catch (error) {
    console.error("[actions] Error fetching audit logs:", error);
    return [];
  }
}
