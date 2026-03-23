import type { Request, Guest, Settings } from "./types";
import db from "./db";
import {
  createUserNotificationAndDispatch,
  emitApprover1PendingReminderNow,
  emitBlacklistAttemptNow,
  emitEmergencyPanicNow,
  emitGuestCheckoutConfirmationNow,
} from "./notifications/dispatcher";
import QRCode from "qrcode";

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
    const commentText = finalApproverComment || ""; // Use raw text to avoid double labeling later

    const approvalNumber = request.approvalNumber;
    const message = `Your visit request has been approved by ${finalApproverName}! Approval Number: ${approvalNumber}. Gate: ${request.gate}. Date: ${request.fromDate} to ${request.toDate}. Please present this approval number at reception.${commentText ? `\n\nApprover Comment: ${commentText}` : ""}`;
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

    const isFinalApproval = (request.status as string) === "approver2-approved";

    for (const guest of request.guests) {
      let htmlMessage: string | undefined = undefined;
      let attachments: any[] | undefined = undefined;

      if (isFinalApproval) {
        // Generate QR Code only for final approval
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
        const scanUrl = `${baseUrl}/t/${request.tenantId}/reception/scan?r=${request.id}&g=${guest.id}`;
        const qrDataUrl = await QRCode.toDataURL(scanUrl, { margin: 1 });
        const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
        const cid = `qr-${guest.id}`;

        htmlMessage = `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <p>Dear ${guest.name},</p>
          <p>Your visit to <strong>${request.destination}</strong> has been approved by ${finalApproverName}.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 25px 0; max-width: 400px;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Visit Details</p>
            <p style="margin: 0 0 5px 0;"><strong>Approval Number:</strong> <span style="font-family: monospace; color: #2563eb;">${approvalNumber}</span></p>
            <p style="margin: 0 0 5px 0;"><strong>Gate:</strong> ${request.gate}</p>
            <p style="margin: 0 0 5px 0;"><strong>Date:</strong> ${request.fromDate} to ${request.toDate}</p>
          </div>
          ${commentText ? `<div style="border-left: 4px solid #2563eb; padding-left: 15px; margin: 20px 0; font-style: italic; color: #4b5563;"><strong>Approver Comment:</strong> ${commentText}</div>` : ""}
          <p><strong>Check-in Pass:</strong> Please present this QR code at the gate/reception desk.</p>
          <div style="margin: 25px 0; text-align: center; max-width: 200px;">
            <img src="cid:${cid}" alt="Visit QR Code" style="display: block; width: 200px; height: 200px; border: 1px solid #e2e8f0; border-radius: 8px;" />
          </div>
          <p style="font-size: 14px; color: #64748b;">This code is valid only for the dates specified above.</p>
          <p>Thank you!</p>
        </div>
      `;

        attachments = [
          {
            filename: `qr-${guest.id}.png`,
            content: qrBuffer.toString("base64"), // Store as string for DB safety
            cid: cid,
            contentType: "image/png",
            encoding: "base64",
          },
        ];
      }

      const guestMessage = `Dear ${guest.name}, your visit to ${request.destination} has been approved by ${finalApproverName}! Approval Number: ${approvalNumber}. Gate: ${request.gate}. Date: ${request.fromDate} to ${request.toDate}.${commentText ? `\n\nApprover Comment: ${commentText}` : ""}`;

      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({
          to: guest.email,
          subject: `Visit Approved - ${approvalNumber}`,
          body: guestMessage,
          html: htmlMessage,
          attachments: attachments,
        } as any);
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
