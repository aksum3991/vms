"use server";

import db from "./db";
import { tenantDb } from "./db-tenant";
import { requireTenantSession } from "./tenant-context";
import { getRequestById, triggerHostVerificationNotifications, triggerHostDenialNotifications } from "./actions";

/**
 * Update request schedule (fromDate and toDate only).
 * 
 * Security: Requires requester to own the request (or be admin)
 * Validation: Only allowed before final approval or check-in
 * Race-safe: Uses raw SQL with NOT EXISTS subquery (same pattern as withdrawRequest)
 * 
 * @returns {success: boolean, error?: string}
 */
export async function updateRequestSchedule(
  requestId: string,
  fromDate: string,
  toDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Verify authentication and derive tenant
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);

    // Step 2: Validate dates BEFORE transaction
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return { success: false, error: "Invalid date format" };
    }

    if (from >= to) {
      return { success: false, error: "End date must be after start date" };
    }

    return await tdb.$transaction(async (tx) => {
      // Step 3: Fetch request for ownership validation
      const request = await tx.request.findFirst({
        where: { id: requestId, tenantId },
        select: { 
          requestedById: true,
          fromDate: true,
          toDate: true
        }
      });

      if (!request) {
        return { success: false, error: "Request not found" };
      }

      // Step 4: Verify ownership
      if (request.requestedById !== session.userId && session.role !== "admin") {
        return { success: false, error: "Unauthorized: You can only edit your own requests" };
      }

      const now = new Date();

      // Step 5: ATOMIC UPDATE with race-safety (raw SQL)
      // Prevents concurrent: final approval, withdrawal, or check-in
      const updateResult = await tx.$executeRaw`
        UPDATE requests
        SET 
          "fromDate" = ${from},
          "toDate" = ${to},
          "updatedAt" = ${now}
        WHERE 
          id = ${requestId}
          AND "tenantId" = ${tenantId}
          AND status NOT IN ('approver2_approved', 'withdrawn')
          AND NOT EXISTS (
            SELECT 1 FROM guests 
            WHERE guests."requestId" = ${requestId} 
            AND guests."tenantId" = ${tenantId}
            AND guests."checkInTime" IS NOT NULL
          )
      `;

      // Step 6: Check if update succeeded
      if (updateResult === 0) {
        // Either status changed, request withdrawn, or guest checked in
        return {
          success: false,
          error: "Cannot update: request approved, withdrawn, or guest checked in"
        };
      }

      // Step 7: Audit log
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "UPDATE_SCHEDULE",
          entity: "Request",
          entityId: requestId,
          details: {
            oldFromDate: request.fromDate.toISOString(),
            oldToDate: request.toDate.toISOString(),
            newFromDate: from.toISOString(),
            newToDate: to.toISOString()
          },
          timestamp: now
        }
      });

      return { success: true };
    });
  } catch (error) {
    console.error("[updateRequestSchedule] Error:", error);
    return { success: false, error: "Schedule update failed" };
  }
}

/**
 * Withdraw an approved request.
 * 
 * Security: Requires requester to own the request (or be admin)
 * Validation: Only approved requests, no check-in, 30-minute rule
 * Race-safe: Uses raw SQL with NOT EXISTS subquery
 * 
 * @returns {success: boolean, error?: string}
 */
export async function withdrawRequest(
  requestId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Verify authentication and derive tenant
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);

    return await tdb.$transaction(async (tx) => {
      // Step 2: Fetch request with guests
      const request = await tx.request.findFirst({
        where: { id: requestId, tenantId },
        include: { guests: { where: { tenantId } } }
      });

      if (!request) {
        return { success: false, error: "Request not found" };
      }

      // Step 3: Verify ownership
      if (request.requestedById !== session.userId && session.role !== "admin") {
        return { success: false, error: "Unauthorized: You can only withdraw your own requests" };
      }

      // Step 4: Validate status
      if (request.status !== "approver2_approved") {
        return { success: false, error: "Only approved requests can be withdrawn" };
      }

      // Step 5: Validate no check-in
      const hasCheckedIn = request.guests.some(g => g.checkInTime !== null);
      if (hasCheckedIn) {
        return { success: false, error: "Cannot withdraw after guest check-in" };
      }

      // Step 6: Validate 30-minute rule
      const now = new Date();
      const scheduledStart = new Date(request.fromDate);
      const minutesUntilStart = (scheduledStart.getTime() - now.getTime()) / (1000 * 60);

      if (minutesUntilStart < 30) {
        const message = minutesUntilStart < 0 
          ? "Cannot withdraw: The scheduled start time has already passed."
          : `Requests cannot be withdrawn less than 30 minutes before the scheduled start time. (${Math.floor(minutesUntilStart)} minutes remaining)`;
        
        return {
          success: false,
          error: message
        };
      }

      // Step 7: ATOMIC UPDATE with guest check-in validation (race-safe)
      // Use raw SQL to ensure atomicity with subquery
      const updateResult = await tx.$executeRaw`
        UPDATE requests
        SET 
          status = 'withdrawn',
          "withdrawnAt" = ${now},
          "withdrawnById" = ${session.userId},
          "withdrawalReason" = ${reason},
          "updatedAt" = ${now}
        WHERE 
          id = ${requestId}
          AND "tenantId" = ${tenantId}
          AND status = 'approver2_approved'
          AND NOT EXISTS (
            SELECT 1 FROM guests 
            WHERE guests."requestId" = ${requestId} 
            AND guests."tenantId" = ${tenantId}
            AND guests."checkInTime" IS NOT NULL
          )
      `;

      // Step 8: Check if update succeeded
      if (updateResult === 0) {
        // Either status changed OR a guest was checked in (race condition)
        return {
          success: false,
          error: "Request status changed or guest checked in. Please try again."
        };
      }

      // Step 9: Audit log
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "WITHDRAW",
          entity: "Request",
          entityId: requestId,
          details: {
            reason,
            withdrawnAt: now.toISOString(),
            minutesBeforeStart: Math.floor(minutesUntilStart)
          },
          timestamp: now
        }
      });

      return { success: true };
    });
  } catch (error) {
    console.error("[withdrawRequest] Error:", error);
    return { success: false, error: "Withdrawal failed" };
  }
}

/**
 * Verify a host_pending request (Public Registration Workflow).
 * 
 * Security: Requires requester (host) to own the request (or be admin)
 * Validation: Only host_pending requests
 * Race-safe: Uses raw SQL with NOT EXISTS subquery
 */
export async function verifyHostRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);

    return await tdb.$transaction(async (tx) => {
      const request = await tx.request.findFirst({
        where: { id: requestId, tenantId }
      });

      if (!request) {
        return { success: false, error: "Request not found" };
      }

      if (request.requestedById !== session.userId && session.role !== "admin") {
        return { success: false, error: "Unauthorized: You can only verify requests assigned to you." };
      }

      if ((request.status as string) !== "host_pending") {
        return { success: false, error: "This request is not pending host verification." };
      }

      const now = new Date();

      const updateResult = await tx.$executeRaw`
        UPDATE requests
        SET 
          status = 'approver1_pending',
          "updatedAt" = ${now}
        WHERE 
          id = ${requestId}
          AND "tenantId" = ${tenantId}
          AND status = 'host_pending'
      `;

      if (updateResult === 0) {
        return {
          success: false,
          error: "Request status already changed. Please refresh."
        };
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "VERIFY_HOST",
          entity: "Request",
          entityId: requestId,
          details: {
            verifiedAt: now.toISOString(),
          },
          timestamp: now
        }
      });

      // Step 6: Trigger notifications
      const [fullRequest, hostUser] = await Promise.all([
        getRequestById(requestId),
        db.user.findUnique({ where: { id: session.userId }, select: { name: true } })
      ]);
      
      if (fullRequest) {
        await triggerHostVerificationNotifications(fullRequest, hostUser?.name || session.email);
      }

      return { success: true };
    });
  } catch (error) {
    console.error("[verifyHostRequest] Error:", error);
    return { success: false, error: "Verification failed" };
  }
}

/**
 * Deny (Withdraw) a host_pending request (Public Registration Workflow).
 * 
 * Security: Requires requester (host) to own the request (or be admin)
 * Validation: Only host_pending requests
 * Race-safe: Uses raw SQL with NOT EXISTS subquery
 */
export async function denyHostRequest(
  requestId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, session } = await requireTenantSession();
    const tdb = tenantDb(tenantId);

    return await tdb.$transaction(async (tx) => {
      const request = await tx.request.findFirst({
        where: { id: requestId, tenantId }
      });

      if (!request) {
        return { success: false, error: "Request not found" };
      }

      if (request.requestedById !== session.userId && session.role !== "admin") {
        return { success: false, error: "Unauthorized: You can only deny requests assigned to you." };
      }

      if ((request.status as string) !== "host_pending") {
        return { success: false, error: "This request is not pending host verification." };
      }

      const now = new Date();

      const updateResult = await tx.$executeRaw`
        UPDATE requests
        SET 
          status = 'withdrawn',
          "withdrawnAt" = ${now},
          "withdrawnById" = ${session.userId},
          "withdrawalReason" = ${reason},
          "updatedAt" = ${now}
        WHERE 
          id = ${requestId}
          AND "tenantId" = ${tenantId}
          AND status = 'host_pending'
      `;

      if (updateResult === 0) {
        return {
          success: false,
          error: "Request status already changed. Please refresh."
        };
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "DENY_HOST_GUEST",
          entity: "Request",
          entityId: requestId,
          details: {
            reason,
            deniedAt: now.toISOString(),
          },
          timestamp: now
        }
      });

      // Step 6: Trigger notifications
      const [fullRequest, hostUser] = await Promise.all([
        getRequestById(requestId),
        db.user.findUnique({ where: { id: session.userId }, select: { name: true } })
      ]);

      if (fullRequest) {
        await triggerHostDenialNotifications(fullRequest, hostUser?.name || session.email, reason);
      }

      return { success: true };
    });
  } catch (error) {
    console.error("[denyHostRequest] Error:", error);
    return { success: false, error: "Denial failed. Try again." };
  }
}
