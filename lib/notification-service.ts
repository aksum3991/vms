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
      (await db.settings.findFirst({ where: { id: 1 } }).catch(() => null));
    if (!request.approvalNumber) {
      console.error("[notifications] No approval number found on request");
      return;
    }

    const approvalNumber = request.approvalNumber;
    const message = `Your visit request has been approved! Approval Number: ${approvalNumber}. Gate: ${request.gate}. Date: ${request.fromDate} to ${request.toDate}. Please present this approval number at reception.`;
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
      const guestMessage = `Dear ${guest.name}, your visit to ${request.destination} has been approved! Approval Number: ${approvalNumber}. Gate: ${request.gate}. Date: ${request.fromDate} to ${request.toDate}.`;
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
    });
  },

  async sendCheckInNotification(
    request: Request,
    guest: Guest,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: { id: 1 } }).catch(() => null));
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
    });
  },

  async sendCheckOutNotification(
    request: Request,
    guest: Guest,
    settings?: Settings,
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: { id: 1 } }).catch(() => null));
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
};

export default notificationService;
