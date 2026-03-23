import type { Request, Guest, Settings } from "./types";
import db from "./db";
import {
  createUserNotificationAndDispatch,
  emitApprover1PendingReminderNow,
  emitBlacklistAttemptNow,
  emitEmergencyPanicNow,
  emitGuestCheckoutConfirmationNow,
} from "./notifications/dispatcher";

export const notificationService = {
  // Generate a unique approval number
  generateApprovalNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `APV-${timestamp}-${random}`;
  },

  // Send approval notifications to requester and all guests
  async sendApprovalNotifications(
    request: Request,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: request.tenantId ? { tenantId: request.tenantId } : {} }).catch(() => null));
    if (!request.approvalNumber) {
      console.error("[notifications] No approval number found on request");
      return;
    }

    const finalApproverName = request.approver2By || request.approver1By || "an approver";
    const finalApproverComment = request.approver2Comment || request.approver1Comment || "";
    const commentText = finalApproverComment ? `\n\nApprover Comment: ${finalApproverComment}` : "";

    const approvalNumber = request.approvalNumber;
    const message = `Your visit request has been approved by ${finalApproverName}! Approval Number: ${approvalNumber}. Gate: ${request.gate}. Date: ${request.fromDate} to ${request.toDate}. Please present this approval number at reception.${commentText}`;
    const emailSubject = `Visit Request Approved - ${approvalNumber}`;

    const emailDispatches: { to: string; subject?: string; body: string }[] =
      [];
    const smsDispatches: { to: string; body: string }[] = [];

    if (effectiveSettings?.emailNotifications && request.requestedByEmail) {
      emailDispatches.push({
        to: request.requestedByEmail,
        subject: emailSubject,
        body: message,
      });
    }

    for (const guest of request.guests) {
      const guestMessage = `Dear ${guest.name}, your visit to ${request.destination} has been approved by ${finalApproverName}! Approval Number: ${approvalNumber}. Gate: ${request.gate}. Date: ${request.fromDate} to ${request.toDate}.${commentText}`;
      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({
          to: guest.email,
          subject: `Visit Approved - ${approvalNumber}`,
          body: guestMessage,
        });
      }
      if (effectiveSettings?.smsNotifications && guest.phone) {
        smsDispatches.push({ to: guest.phone, body: guestMessage });
      }
    }

    // In-app notification for requester + outbound dispatches for requester/guests (emit-and-forget)
    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "request_approved",
      message: `Request approved. Approval number: ${approvalNumber}.`,
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },

  async sendRejectionNotifications(
    request: Request,
    comment: string,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: request.tenantId ? { tenantId: request.tenantId } : {} }).catch(() => null));

    const message = `Your visit request to ${request.destination} (Gate: ${request.gate}) on ${request.fromDate} has been rejected.${comment ? `\n\nReason: ${comment}` : ""}`;
    const emailSubject = `Visit Request Rejected - ${request.destination}`;

    const emailDispatches: { to: string; subject?: string; body: string }[] = [];
    const smsDispatches: { to: string; body: string }[] = [];

    if (effectiveSettings?.emailNotifications && request.requestedByEmail) {
      emailDispatches.push({
        to: request.requestedByEmail,
        subject: emailSubject,
        body: message,
      });
    }

    // Only send the SMS to the requester if they have their phone mapped in the guests list
    if (effectiveSettings?.smsNotifications) {
      const requesterAsGuest = request.guests.find(
        (g) => g.email === request.requestedByEmail
      );
      if (requesterAsGuest?.phone) {
        smsDispatches.push({ to: requesterAsGuest.phone, body: message });
      }
    }

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "request_rejected",
      message: `Request rejected. ${comment ? `Reason: ${comment}` : ""}`,
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },

  async sendCheckInNotification(
    request: Request,
    guest: Guest,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: request.tenantId ? { tenantId: request.tenantId } : {} }).catch(() => null));
    const message = `Guest ${guest.name} from ${guest.organization} has checked in at Gate ${request.gate}.`;
    const emailDispatches: { to: string; subject?: string; body: string }[] =
      [];
    const smsDispatches: { to: string; body: string }[] = [];
    
    if (effectiveSettings?.emailNotifications && request.requestedByEmail) {
      emailDispatches.push({
        to: request.requestedByEmail,
        subject: "Guest Check-In Alert",
        body: message,
      });
    }
    
    // Add SMS support - send to requester if they have a phone number
    // Note: User model doesn't have phone, but we can check if requester email matches a guest
    if (effectiveSettings?.smsNotifications) {
      // Try to find requester's phone from their own guest entry if they're also a guest
      const requesterAsGuest = request.guests.find(
        (g) => g.email === request.requestedByEmail
      );
      if (requesterAsGuest?.phone) {
        smsDispatches.push({
          to: requesterAsGuest.phone,
          body: message,
        });
      }
    }

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "guest_checkin",
      message,
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },

  async sendCheckOutNotification(
    request: Request,
    guest: Guest,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: request.tenantId ? { tenantId: request.tenantId } : {} }).catch(() => null));
    const message = `Guest ${guest.name} from ${guest.organization} has checked out from ${request.destination}.`;
    const emailDispatches: { to: string; subject?: string; body: string }[] =
      [];
    const smsDispatches: { to: string; body: string }[] = [];
    
    if (effectiveSettings?.emailNotifications && request.requestedByEmail) {
      emailDispatches.push({
        to: request.requestedByEmail,
        subject: "Guest Check-Out Alert",
        body: message,
      });
    }
    
    // Add SMS support - send to requester if they have a phone number
    if (effectiveSettings?.smsNotifications) {
      const requesterAsGuest = request.guests.find(
        (g) => g.email === request.requestedByEmail
      );
      if (requesterAsGuest?.phone) {
        smsDispatches.push({
          to: requesterAsGuest.phone,
          body: message,
        });
      }
    }

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "guest_checkout",
      message,
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },

  // New triggers (event-driven)
  async blacklistAttempt(input: {
    requesterId: string;
    requesterEmail?: string;
    requesterName?: string;
    guest: {
      name: string;
      organization?: string;
      email?: string;
      phone?: string;
    };
    requestId?: string;
    matchedBy?: string[];
  }): Promise<void> {
    await emitBlacklistAttemptNow({
      requesterId: input.requesterId,
      requesterEmail: input.requesterEmail,
      requesterName: input.requesterName,
      requestId: input.requestId,
      guest: input.guest,
      matchedBy: input.matchedBy,
    });
  },

  async approver1PendingReminder(input: {
    requestId: string;
    approver1UserId: string;
    createdAt: string;
  }): Promise<void> {
    await emitApprover1PendingReminderNow(input);
  },

  async guestCheckoutConfirmation(input: {
    requestId: string;
    guestId: string;
    guest: { name: string; email?: string; phone?: string };
  }): Promise<void> {
    await emitGuestCheckoutConfirmationNow(input);
  },

  async emergencyPanic(input: {
    triggeredByUserId: string;
    location?: string;
    message?: string;
  }): Promise<void> {
    await emitEmergencyPanicNow(input);
  },

  async sendHostVerificationNotification(
    request: Request,
    hostName: string,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: request.tenantId ? { tenantId: request.tenantId } : {} }).catch(() => null));
    
    const message = `Your visit request to ${request.destination} has been verified by ${hostName} and is now under security review. You will receive another update once final approval is granted.`;
    const emailSubject = `Visit Request Verified - ${request.destination}`;

    const emailDispatches: { to: string; subject?: string; body: string }[] = [];
    const smsDispatches: { to: string; body: string }[] = [];

    for (const guest of request.guests) {
      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({ to: guest.email, subject: emailSubject, body: `Dear ${guest.name}, ${message}` });
      }
      if (effectiveSettings?.smsNotifications && guest.phone) {
        smsDispatches.push({ to: guest.phone, body: `Dear ${guest.name}, ${message}` });
      }
    }

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "host_verified",
      message: `Request verified by ${hostName}.`,
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },

  async sendHostDenialNotification(
    request: Request,
    hostName: string,
    reason: string,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: request.tenantId ? { tenantId: request.tenantId } : {} }).catch(() => null));
    
    const message = `Your visit request to ${request.destination} has been declined by ${hostName}.${reason ? `\n\nReason: ${reason}` : ""}`;
    const emailSubject = `Visit Request Declined - ${request.destination}`;

    const emailDispatches: { to: string; subject?: string; body: string }[] = [];
    const smsDispatches: { to: string; body: string }[] = [];

    for (const guest of request.guests) {
      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({ to: guest.email, subject: emailSubject, body: `Dear ${guest.name}, ${message}` });
      }
      if (effectiveSettings?.smsNotifications && guest.phone) {
        smsDispatches.push({ to: guest.phone, body: `Dear ${guest.name}, ${message}` });
      }
    }

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "host_denied",
      message: `Request declined by ${hostName}.`,
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },
};

export default notificationService;
