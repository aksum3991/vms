"use server";

import { revalidatePath } from "next/cache";
import { encrypt } from "./crypto";
import db from "./db";
import { getServerSession } from "./auth-server";
import { getEmailProviderFromEnvOrSettings } from "./notifications/providers/email";
import { getSmsProviderFromEnvOrSettings } from "./notifications/providers/sms";
import { tenantDb } from "./db-tenant";
// requireAnySession removed from here as it's added above
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
  emitUserRegistrationNow,
} from "./notifications/dispatcher";
import {
  kcEnsureUser,
  kcSetEnabled,
  kcSetPassword,
  kcSetSingleRealmRole,
  type VmsRole,
} from "./keycloak-admin";
import {
  updateRequestSchedule as updateScheduleImpl,
  withdrawRequest as withdrawRequestImpl,
} from "./request-actions";
import { requireTenantSession, requireAnySession } from "./tenant-context";
import { mapRowToUser } from "./mappers";

// Mapper functions (internal to this module)
function mapRowToRequest(row: any, guests: Guest[]): Request {
  const status =
    typeof row.status === "string" ? row.status.replace(/_/g, "-") : row.status;
  return {
    id: row.id,
    approvalNumber: row.approvalNumber,
    requestedBy: row.requestedBy?.email === "public-portal@vms.system" 
      ? row.requestedByEmail // Store of Guest Name for public portal
      : (row.requestedBy?.name || row.requestedByEmail),
    requestedById: row.requestedById,
    requestedByEmail: row.requestedByEmail,
    destination: row.destination,
    gate: row.gate,
    fromDate: new Date(row.fromDate).toISOString(),
    toDate: new Date(row.toDate).toISOString(),
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
    withdrawnAt: row.withdrawnAt
      ? new Date(row.withdrawnAt).toISOString()
      : undefined,
    withdrawnById: row.withdrawnById,
    withdrawalReason: row.withdrawalReason,
    tenantId: row.tenantId,
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
    preferredLanguage: row.preferredLanguage || "en",
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

function mapRowToSettings(row: any): Settings {
  return {
    approvalSteps: (row.approvalSteps as 1 | 2) || 1,
    emailNotifications: row.emailNotifications,
    smsNotifications: row.smsNotifications,
    checkInOutNotifications: row.checkInOutNotifications,
    gates: row.gates,
    primaryColor: row.primaryColor || "#06b6d4",
    accentColor: row.accentColor || "#0891b2",
    smtpHost: row.smtpHost || undefined,
    smtpPort: row.smtpPort || undefined,
    smtpUser: row.smtpUser || undefined,
    // Use placeholder to avoid sending encrypted data to client
    smtpPassword: row.smtpPassword ? "__ENCRYPTED__" : undefined,
    smsGatewayUrl: row.smsGatewayUrl || undefined,
    smsApiKey: row.smsApiKey ? "__ENCRYPTED__" : undefined,
    emailGatewayUrl: row.emailGatewayUrl || undefined,
    emailApiKey: row.emailApiKey || undefined,
    defaultLanguage: row.defaultLanguage,
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

export async function getRequests(expectedSlug?: string): Promise<Request[]> {
  try {
    const { tenantId } = await requireTenantSession(expectedSlug);
    const tdb = tenantDb(tenantId);
    
    const requestsFromDb = await (tdb.request as any).findMany({
      include: { guests: true, requestedBy: true },
      orderBy: { createdAt: "desc" },
    });
    return requestsFromDb.map((req: any) =>
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
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    // Default requester to current session (for new requests)
    let requestedById = session.userId;
    let requestedByEmail = session.email;

    const { guests, ...requestData } = request;
    const isUpdate = !!request.id;

    // Step 2: For updates, verify ownership
    if (isUpdate) {
      // Use tdb.request.findFirst to ensure tenant isolation
      const existing = await (tdb.request as any).findFirst({
        where: { id: request.id },
      });

      if (!existing) {
        throw new Error("Request not found in this organization");
      }

      // Preserve original requester for updates
      requestedById = existing.requestedById;
      requestedByEmail = existing.requestedByEmail;

      // Authorization Check
      const isOwner = existing.requestedById === session.userId;
      const isAdmin = session.role === "admin";
      const isApprover1 = session.role === "approver1";
      const isApprover2 = session.role === "approver2";

      if (!isOwner && !isAdmin) {
        // Allow approvers to update requests in their queue
        let isAllowed = false;

        // Approver 1 can edit if Submitted, Pending A1, or Rejection correction
        // DB uses UNDERSCORES for status enum
        if (
          isApprover1 &&
          (existing.status === "submitted" ||
            existing.status === "approver1_pending" ||
            existing.status === "approver1_rejected")
        ) {
          isAllowed = true;
        }

        // Approver 2 can edit if Pending A2, or incoming from A1
        if (
          isApprover2 &&
          (existing.status === "approver2_pending" ||
            existing.status === "approver1_approved" ||
            existing.status === "approver2_rejected")
        ) {
          isAllowed = true;
        }

        if (!isAllowed) {
          console.error(
            `[actions] Unauthorized edit attempt. User: ${session.userId} (${session.role}), Request: ${existing.id} (${existing.status})`,
          );
          throw new Error("Unauthorized: You can only edit your own requests");
        }
      }
    }

    // Step 3: requestedById is already determined above
    // const requestedById = session.userId; // REMOVED
    // const requestedByEmail = session.email; // REMOVED

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
          requesterEmail: requestedByEmail,
          requesterName: session.email,
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

    const dataToUpsert = {
      requestedById,
      requestedByEmail,
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
      tenantId, 
    };

    if (isUpdate) {
      // Update existing guests or create new ones to preserve guest IDs and status
      const existingGuests = await (tdb.guest as any).findMany({
        where: { requestId: request.id },
      });
      const existingGuestMap = new Map(existingGuests.map((g: any) => [g.id, g]));

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
          approver1Status: guest.approver1Status || null,
          approver2Status: guest.approver2Status || null,
          approver1Comment: guest.approver1Comment || null,
          approver2Comment: guest.approver2Comment || null,
          preferredLanguage: guest.preferredLanguage || "en",
        };

        if (guest.id && existingGuestMap.has(guest.id)) {
          // Extension doesn't inject tenantId into update, so we use updateMany for safety
          await (tdb.guest as any).updateMany({
            where: { id: guest.id, tenantId },
            data: guestData,
          });
        } else {
          await (tdb.guest as any).create({
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
        (g: any) => !currentGuestIds.has(g.id),
      );
      for (const guest of guestsToDelete) {
        await (tdb.guest as any).deleteMany({ where: { id: guest.id, tenantId } });
      }

      const updatedReq = await (tdb.request as any).updateMany({
        where: { id: request.id, tenantId },
        data: dataToUpsert,
      });
      await createAuditLog(
        requestedById,
        "UPDATE",
        "Request",
        request.id as string,
        dataToUpsert,
      );
      revalidatePath("/requester");
      revalidatePath("/approver1");
      revalidatePath("/approver2");
      revalidatePath("/reception");
    } else {
      const createdReq = await (tdb.request as any).create({
        data: {
          ...dataToUpsert,
          guests: {
            create: guests.map((g) => ({
              ...g,
              idPhotoUrl: g.idPhotoUrl || null,
              approver1Status: g.approver1Status || null,
              approver2Status: g.approver2Status || null,
              approver1Comment: g.approver1Comment || null,
              approver2Comment: g.approver2Comment || null,
              tenantId,
            })),
          },
        },
        include: { guests: true },
      });
      await createAuditLog(
        requestedById,
        "CREATE",
        "Request",
        createdReq.id,
        dataToUpsert,
      );
      
      // Auto-notify all Approver 1 users of the new request
      try {
         const fullReq = mapRowToRequest(createdReq, createdReq.guests.map(mapRowToGuest));
         await notificationService.notifyStaffByRole(
           tenantId,
           "approver1",
           "request_submitted_approver",
           fullReq,
           { destination: fullReq.destination }
         );
      } catch (notifyError) {
         console.error("[saveRequest] Failed to notify approvers:", notifyError);
      }

      revalidatePath("/");
    }
  } catch (error) {
    console.error("[actions] Error saving request:", error);
    throw error;
  }
}

export async function getRequestById(id: string): Promise<Request | undefined> {
  try {
    const { tenantId } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    const requestFromDb = await (tdb.request as any).findFirst({
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
    const { tenantId } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    await (tdb.request as any).deleteMany({ where: { id, tenantId } });
    revalidatePath("/admin");
  } catch (error) {
    console.error("[actions] Error deleting request:", error);
    throw error;
  }
}

/**
 * Check in a guest for an approved request.
 *
 * Security: Requires reception or admin role
 * Race-safe: Uses atomic updateMany with compound WHERE
 * Validates: Request status, guest approval, no double check-in
 *
 * @returns {success: boolean, error?: string}
 */
export async function checkInGuest(
  requestId: string,
  guestId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Verify authorization
    const { tenantId, session } = await requireTenantSession();
    if (!["reception", "admin"].includes(session.role)) {
      return {
        success: false,
        error: "Unauthorized: Reception access required",
      };
    }

    const tdb = tenantDb(tenantId);

    return await tdb.$transaction(async (tx) => {
      // Step 2: Fetch request and verify guest belongs to it
      // use findFirst with tenantId for isolation
      const request = await (tx.request as any).findFirst({
        where: { id: requestId, tenantId },
        include: { guests: { where: { id: guestId, tenantId } } },
      });

      if (!request) {
        return { success: false, error: "Request not found" };
      }

      // Step 3: Validate request status
      if (request.status === "withdrawn") {
        return { success: false, error: "Cannot check in: request withdrawn" };
      }

      if (request.status !== "approver2_approved") {
        return {
          success: false,
          error: "Request must be approved before check-in",
        };
      }

      const guest = request.guests[0];
      if (!guest) {
        return { success: false, error: "Guest not found in this request" };
      }

      // Step 4: Validate guest approval
      if (guest.approver2Status !== "approved") {
        return {
          success: false,
          error: "Guest must be approved before check-in",
        };
      }

      if (guest.checkInTime) {
        return { success: false, error: "Guest already checked in" };
      }

      // Step 5: ATOMIC UPDATE with compound WHERE filter (race-safe)
      const updateResult = await (tx.guest as any).updateMany({
        where: {
          id: guestId,
          requestId: requestId, // Verify guest belongs to request
          checkInTime: null, // Prevent double check-in
          tenantId, // Mandatory for isolation
        },
        data: { checkInTime: new Date() },
      });

      if (updateResult.count === 0) {
        return {
          success: false,
          error: "Guest already checked in (race condition)",
        };
      }

      // Step 6: Audit log
      await (tx.auditLog as any).create({
        data: {
          userId: session.userId,
          action: "CHECK_IN",
          entity: "Guest",
          entityId: guestId,
          details: { requestId, guestId },
          timestamp: new Date(),
        },
      });

      return { success: true };
    });
  } catch (error) {
    console.error("[checkInGuest] Error:", error);
    return { success: false, error: "Check-in failed" };
  }
}

// ... (imports and other code)

export async function checkOutGuest(
  requestId: string,
  guestId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    const cfg = getNotificationConfig();

    const notificationId = await tdb.$transaction(async (tx) => {
      // Race condition check: Ensure guest isn't already checked out
      const existingGuest = await (tx.guest as any).findFirst({
        where: { id: guestId, tenantId },
      });

      if (!existingGuest) {
        throw new Error("Guest not found");
      }
      if (existingGuest.checkOutTime) {
        throw new Error("Guest already checked out");
      }

      await (tx.guest as any).updateMany({
        where: { id: guestId, tenantId },
        data: { checkOutTime: new Date() },
      });

      const [req, guest, settings] = await Promise.all([
        (tx.request as any).findFirst({ where: { id: requestId, tenantId } }),
        (tx.guest as any).findFirst({ where: { id: guestId, tenantId } }),
        (tx.settings as any).findFirst({ where: { tenantId } }),
      ]);
      if (!req || !guest || !settings) return null;

      const surveyUrl = cfg.appBaseUrl
        ? `${cfg.appBaseUrl}/public/survey?requestId=${encodeURIComponent(requestId)}&guestId=${encodeURIComponent(guestId)}`
        : `/public/survey?requestId=${encodeURIComponent(requestId)}&guestId=${encodeURIComponent(guestId)}`;

      const body = `Hello${guest.name ? ` ${guest.name}` : ""}, your check-out has been recorded. We value your feedback. Please share your experience here: ${surveyUrl}`;
      
      const emailDispatches = settings.emailNotifications && guest.email
        ? [{ to: guest.email, subject: "VMS3 Check-out Confirmation", body }]
        : [];
      const smsDispatches = settings.smsNotifications && guest.phone
        ? [{ to: guest.phone, body }]
        : [];

      return await createUserNotificationAndDispatchRecords(tx, {
        userId: req.requestedById,
        type: "guest_checkout_confirmation_sent",
        message: `Check-out confirmation queued for guest ${guest.name}.`,
        requestId,
        tenantId,
        email: emailDispatches,
        sms: smsDispatches,
      });
    });

    if (notificationId) {
      await enqueueNotificationProcessing(notificationId);
    }

    const req = await (tdb.request as any).findFirst({ where: { id: requestId } });
    if (req?.requestedById) {
      await createAuditLog(req.requestedById, "CHECK_OUT", "Guest", guestId, {
        requestId,
        guestId,
      });
    }
    revalidatePath("/reception");
    revalidatePath("/survey");

    return { success: true };
  } catch (error) {
    console.error("[actions] Error checking out guest", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during checkout",
    };
  }
}

// Pending approval reminder (>24h in approver1_pending)
export async function runApprover1PendingReminders(): Promise<{
  scanned: number;
}> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = await (db.request as any).findMany({
    where: { status: "approver1_pending", createdAt: { lt: cutoff } },
    select: { id: true, createdAt: true },
    take: 200,
    orderBy: { createdAt: "asc" },
  });

  await Promise.allSettled(
    pending.map(async (r: any) => {
      await notificationService.approver1PendingReminder({
        requestId: r.id,
        approver1UserId: "role:approver1",
        createdAt: r.createdAt.toISOString(),
      });
    }),
  );

  return { scanned: pending.length };
}

// Export request management actions
// Request management imports moved to top

export async function updateRequestSchedule(
  requestId: string,
  fromDate: string,
  toDate: string,
) {
  return await updateScheduleImpl(requestId, fromDate, toDate);
}

export async function withdrawRequest(requestId: string, reason: string) {
  return await withdrawRequestImpl(requestId, reason);
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
    const { tenantId } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    return await (tdb.survey as any).findMany({
      where: { tenantId },
      orderBy: { submittedAt: "desc" },
    });
  } catch (error) {
    console.error("[actions] Error fetching surveys:", error);
    return [];
  }
}

export async function saveSurvey(survey: Omit<Survey, "id" | "submittedAt">): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    // Check for existing survey for this guest
    const existing = await (tdb.survey as any).findUnique({
      where: { guestId: survey.guestId },
    });

    if (existing) {
      return { success: false, error: "Feedback already submitted for this visit" };
    }

    await (tdb.survey as any).create({
      data: {
        requestId: survey.requestId,
        guestId: survey.guestId,
        rating: survey.rating,
        comment: survey.comment,
        tenantId: tenantId, // Explicit for safety
      },
    });
    revalidatePath("/admin");
    revalidatePath("/survey");
    revalidatePath("/t/[slug]/survey", "layout");
    return { success: true };
  } catch (error: any) {
    console.error("[actions] Error saving survey:", error);
    return { success: false, error: error.message || "An unexpected error occurred" };
  }
}

export async function getUsers(expectedSlug?: string): Promise<User[]> {
  try {
    const { tenantId } = await requireTenantSession(expectedSlug);
    const tdb = tenantDb(tenantId);
    
    const users = await tdb.user.findMany({
      orderBy: { name: "asc" },
    });
    return users.map(mapRowToUser);
  } catch (error) {
    console.error("[actions] Error fetching users:", error);
    return [];
  }
}

//working with vms
// export async function saveUser(
//   user: Omit<User, "id" | "createdAt"> & { id?: string },
// ): Promise<void> {
//   try {
//     if (user.id) {
//       const updated = await db.user.update({
//         where: { id: user.id },
//         data: user,
//       });
//     } else {
//       const created = await db.user.create({ data: user });
//     }
//     const admin = await db.user.findFirst({ where: { role: "admin" } });
//     if (admin?.id) {
//       await createAuditLog(
//         admin.id,
//         user.id ? "UPDATE" : "CREATE",
//         "User",
//         user.id || "new",
//         user,
//       );
//     }
//     revalidatePath("/admin");
//     revalidatePath("/settings");
//   } catch (error) {
//     console.error("[actions] Error saving user:", error);
//     throw error;
//   }
// }

export async function updateMyProfile(data: {
  language: string;
  phone?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, session } = await requireTenantSession();
    if (!session || !session.userId) {
       return { success: false, error: "Unauthorized" };
    }
    const tdb = tenantDb(tenantId);

    // Update using updateMany for tenant-scope safety
    await (tdb.user as any).updateMany({
      where: { id: session.userId, tenantId },
      data: {
        language: data.language,
        phone: data.phone,
      },
    });

    await createAuditLog(
      session.userId,
      "UPDATE_PROFILE",
      "User",
      session.userId,
      { language: data.language, phone: data.phone },
    );

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("[actions] Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

// Keycloak imports moved to top

export async function saveUser(user: Partial<User> & { id?: string }): Promise<void> {
  try {
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    if (user.id) {
      // Use updateMany for tenant safety
      await tdb.user.updateMany({
        where: { id: user.id, tenantId },
        data: {
          ...user,
        },
      });
      await createAuditLog(session.userId, "UPDATE", "User", user.id, user);
    } else {
      if (!user.email) throw new Error("Email is required for new users");
      
      const temporaryPassword = (user as any).password || Math.random().toString(36).slice(-10);
      const role = user.role || "requester";

      // 1. Create in Keycloak
      try {
        const kcUser = await kcEnsureUser(user.email, user.name || "");
        await kcSetPassword(kcUser.id, temporaryPassword);
        await kcSetSingleRealmRole(kcUser.id, role as VmsRole);
      } catch (kcError) {
        console.error("[actions] Keycloak sync failed:", kcError);
        // We continue to create in DB so the user exists locally, 
        // but it's a critical warning.
      }

      // 2. Create in Local DB
      const newUser = await (tdb as any).user.create({
        data: {
          email: user.email.toLowerCase(),
          name: user.name || "",
          role: role,
          password: temporaryPassword,
          active: user.active ?? true,
          tenantId,
        },
      });

      // 3. Trigger notification
      try {
        const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
        await emitUserRegistrationNow({
          userId: newUser.id,
          tenantId,
          email: user.email,
          name: user.name || "",
          temporaryPassword,
          tenantName: tenant?.name || "Organization",
          role: role,
        });
      } catch (notifError) {
        console.error("[actions] Notification failed:", notifError);
      }

      await createAuditLog(session.userId, "CREATE", "User", newUser.id, user);
    }
    revalidatePath("/admin");
  } catch (error) {
    console.error("[actions] Error saving user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const userFromDb = await db.user.findFirst({ where: { email } });
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

export async function getSettings(expectedSlug?: string): Promise<Settings> {
  try {
    const { tenantId } = await requireTenantSession(expectedSlug);
    const tdb = tenantDb(tenantId);
    
    const settings = await tdb.settings.findFirst({
      where: { tenantId }
    });
    if (!settings) {
      throw new Error("Settings not found for this organization");
    }
    return mapRowToSettings(settings);
  } catch (error) {
    console.error("[actions] Error fetching settings:", error);
    throw error;
  }
}

export async function saveSettings(
  settings: Partial<Settings>,
  expectedSlug?: string,
): Promise<void> {
  try {
    const { tenantId, session } = await requireTenantSession(expectedSlug);
    const tdb = tenantDb(tenantId);

    // Upsert pattern using updateMany/create
    const existing = await tdb.settings.findFirst({ where: { tenantId } });

    // Build a clean data object with only known Prisma fields
    // We do this explicitly to avoid type mismatches silently dropping fields
    const dbData: Record<string, any> = {};

    if (settings.approvalSteps !== undefined) dbData.approvalSteps = settings.approvalSteps;
    if (settings.emailNotifications !== undefined) dbData.emailNotifications = settings.emailNotifications;
    if (settings.smsNotifications !== undefined) dbData.smsNotifications = settings.smsNotifications;
    if (settings.checkInOutNotifications !== undefined) dbData.checkInOutNotifications = settings.checkInOutNotifications;
    if (settings.gates !== undefined) dbData.gates = settings.gates;
    if (settings.primaryColor !== undefined) dbData.primaryColor = settings.primaryColor;
    if (settings.accentColor !== undefined) dbData.accentColor = settings.accentColor;
    if (settings.smtpHost !== undefined) dbData.smtpHost = settings.smtpHost || null;
    if (settings.smtpPort !== undefined) dbData.smtpPort = settings.smtpPort || null;
    if (settings.smtpUser !== undefined) dbData.smtpUser = settings.smtpUser || null;
    if (settings.smsGatewayUrl !== undefined) dbData.smsGatewayUrl = settings.smsGatewayUrl || null;
    if (settings.emailGatewayUrl !== undefined) dbData.emailGatewayUrl = settings.emailGatewayUrl || null;

    // Handle encrypted fields - only update if a new value is provided (not the placeholder)
    if (settings.smtpPassword) {
      dbData.smtpPassword = settings.smtpPassword === "__ENCRYPTED__"
        ? undefined  // Keep existing value
        : encrypt(settings.smtpPassword);
    }
    if (settings.smsApiKey) {
      dbData.smsApiKey = settings.smsApiKey === "__ENCRYPTED__"
        ? undefined
        : encrypt(settings.smsApiKey);
    }
    if (settings.emailApiKey) {
      dbData.emailApiKey = settings.emailApiKey === "__ENCRYPTED__"
        ? undefined
        : encrypt(settings.emailApiKey);
    }

    // Remove any 'undefined' values so Prisma ignores them (keeps existing)
    Object.keys(dbData).forEach(k => dbData[k] === undefined && delete dbData[k]);

    console.log(`[saveSettings] tenantId=${tenantId}, fields being saved:`, Object.keys(dbData));
    console.log(`[saveSettings] smtpHost=${dbData.smtpHost}, smtpUser=${dbData.smtpUser}, smtpPassword=${dbData.smtpPassword ? "SET" : "not set"}`);

    if (existing) {
      await tdb.settings.updateMany({
        where: { tenantId },
        data: dbData,
      });
      await createAuditLog(session.userId, "UPDATE", "Settings", existing.id, dbData);
    } else {
      await tdb.settings.create({
        data: {
          ...dbData,
          tenantId,
        } as any,
      });
      await createAuditLog(session.userId, "CREATE", "Settings", "new", dbData);
    }

    console.log(`[saveSettings] Save successful for tenant ${tenantId}`);
    revalidatePath("/settings");
  } catch (error) {
    console.error("[actions] Error saving settings:", error);
    throw error;
  }
}

export async function getNotifications(): Promise<Notification[]> {
  try {
    const { tenantId } = await requireAnySession().then(async (s: any) => {
      if (s.role === "superadmin") return { tenantId: null, session: s };
      const ctx = await requireTenantSession();
      return { tenantId: ctx.tenantId, session: ctx.session };
    });

    if (!tenantId) return [];
    
    const tdb = tenantDb(tenantId);
    
    const results = await tdb.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return results.map(mapRowToNotification);
  } catch (error) {
    console.error("[actions] Error fetching notifications:", error);
    return [];
  }
}

export async function saveNotification(
  notification: Omit<Notification, "id" | "createdAt" | "read"> & { read?: boolean },
): Promise<void> {
  try {
    const { tenantId } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    await tdb.notification.create({
      data: {
        ...notification,
        tenantId,
      },
    });
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
    const { tenantId } = await requireAnySession().then(async (s: any) => {
      if (s.role === "superadmin") return { tenantId: null, session: s };
      const ctx = await requireTenantSession();
      return { tenantId: ctx.tenantId, session: ctx.session };
    });

    if (!tenantId) return [];

    const tdb = tenantDb(tenantId);
    
    const results = await tdb.notification.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: "desc" },
    });
    return results.map(mapRowToNotification);
  } catch (error) {
    console.error("[actions] Error fetching user notifications:", error);
    return [];
  }
}

export async function triggerApprovalNotifications(
  request: Request,
): Promise<void> {
  try {
    const { tenantId } = await requireTenantSession();
    const settings = await getSettings();
    
    // 1. Notify Requester and Guests
    if (settings.emailNotifications || settings.smsNotifications) {
      await notificationService.sendApprovalNotifications(request, settings);
    }

    // 2. Notify Staff based on workflow stage
    if (request.status === "approver2-pending") {
      // Notify Approver 2 that a request is ready for final review
      await notificationService.notifyStaffByRole(
        tenantId,
        "approver2",
        "request_ready_approver2",
        request,
        { destination: request.destination },
        settings
      );
    } else if (request.status === "approver2-approved") {
      // Notify Reception that a visit has been fully finalized
      await notificationService.notifyStaffByRole(
        tenantId,
        "reception",
        "request_finalized_reception",
        request,
        { 
          destination: request.destination,
          guestCount: request.guests.length,
          fromDate: request.fromDate,
          toDate: request.toDate
        },
        settings
      );
    }
  } catch (error) {
    console.error("[actions] Error triggering approval notifications:", error);
  }
}

export async function triggerRejectionNotifications(
  request: Request,
  comment: string,
): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.emailNotifications || settings.smsNotifications) {
      await notificationService.sendRejectionNotifications(request, comment, settings);
    }
  } catch (error) {
    console.error("[actions] Error triggering rejection notifications:", error);
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

export async function triggerHostVerificationNotifications(
  request: Request,
  hostName: string,
): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.emailNotifications || settings.smsNotifications) {
      await notificationService.sendHostVerificationNotification(request, hostName, settings);
    }
  } catch (error) {
    console.error("[actions] Error triggering host verification notifications:", error);
  }
}

export async function triggerHostDenialNotifications(
  request: Request,
  hostName: string,
  reason: string,
): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.emailNotifications || settings.smsNotifications) {
      await notificationService.sendHostDenialNotification(request, hostName, reason, settings);
    }
  } catch (error) {
    console.error("[actions] Error triggering host denial notifications:", error);
  }
}

export async function testEmailGateway(
  to: string,
  testSettings?: Partial<Settings>,
  expectedSlug?: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const { tenantId } = await requireTenantSession(expectedSlug);
    const tdb = tenantDb(tenantId);

    // Fetch RAW settings from DB (with real encrypted password, not placeholder)
    const rawDbSettings = await tdb.settings.findFirst({ where: { tenantId } });
    if (!rawDbSettings) {
      return { ok: false, error: "Settings not found for this organization" };
    }

    // Merge: start with raw DB settings, overlay any test overrides from UI
    const mergedSettings: any = { ...rawDbSettings };
    if (testSettings) {
      // Apply non-placeholder overrides from UI
      for (const [key, value] of Object.entries(testSettings)) {
        if (value !== undefined && value !== "__ENCRYPTED__") {
          mergedSettings[key] = value;
        }
      }
    }

    // If SMTP password from UI is a new value (not placeholder), use it directly
    // by encrypting it so getEmailProviderFromEnvOrSettings can decrypt it
    if (testSettings?.smtpPassword && testSettings.smtpPassword !== "__ENCRYPTED__") {
      mergedSettings.smtpPassword = encrypt(testSettings.smtpPassword);
    }
    // Otherwise mergedSettings.smtpPassword already has the real encrypted value from DB

    const provider = await getEmailProviderFromEnvOrSettings(mergedSettings);
    if (!provider) {
      return { ok: false, error: "Email can't be sent \"contact your administrator\"" };
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
  expectedSlug?: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const { tenantId } = await requireTenantSession(expectedSlug);
    const tdb = tenantDb(tenantId);

    // Fetch RAW settings from DB (with real encrypted API key, not placeholder)
    const rawDbSettings = await tdb.settings.findFirst({ where: { tenantId } });
    if (!rawDbSettings) {
      return { ok: false, error: "Settings not found for this organization" };
    }

    // Merge: start with raw DB settings, overlay any test overrides from UI
    const mergedSettings: any = { ...rawDbSettings };
    if (testSettings) {
      for (const [key, value] of Object.entries(testSettings)) {
        if (value !== undefined && value !== "__ENCRYPTED__") {
          mergedSettings[key] = value;
        }
      }
    }

    // If SMS API key from UI is a new value (not placeholder), encrypt it
    if (testSettings?.smsApiKey && testSettings.smsApiKey !== "__ENCRYPTED__") {
      mergedSettings.smsApiKey = encrypt(testSettings.smsApiKey);
    }

    const provider = await getSmsProviderFromEnvOrSettings(mergedSettings);
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
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);
    
    const existing = await tdb.notification.findFirst({ where: { id, tenantId } });
    if (!existing) return;

    await tdb.notification.updateMany({
      where: { id, tenantId },
      data: { read: true },
    });
    
    await createAuditLog(session.userId, "UPDATE", "Notification", id, { read: true });
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
      const created = await db.blacklistEntry.create({ data: { ...data, tenantId: (data as any).tenantId ?? "default-tenant-id" } });
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
