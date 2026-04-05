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
import { getTranslation } from "./notifications/i18n";
import { format } from "date-fns";
import { formatDateForDisplay } from "./date-utils";

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
    const commentText = finalApproverComment || ""; 
    const approvalNumber = request.approvalNumber;

    // Determine locale
    const requester = await db.user.findUnique({ where: { id: request.requestedById }, select: { id: true } });
    const userRow = await db.user.findUnique({ where: { id: request.requestedById } });
    const locale = (userRow as any)?.language || effectiveSettings?.defaultLanguage || "en";

    const commonParams = {
      name: request.requestedBy,
      destination: request.destination,
      approver: finalApproverName,
      id: approvalNumber,
      gate: request.gate,
      from: formatDateForDisplay(request.fromDate),
      to: formatDateForDisplay(request.toDate),
      comment: commentText ? getTranslation("common.approver_comment", locale, { comment: commentText }) : ""
    };

    const message = getTranslation("notifications.request_approved.body", locale, commonParams);
    const emailSubject = getTranslation("notifications.request_approved.subject", locale, { id: approvalNumber });

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

      const guestLocale = guest.preferredLanguage || locale; // fallback to requester locale if guest has none set yet
      const guestParams = { ...commonParams, name: guest.name };
      const guestMessage = getTranslation("notifications.request_approved.body", guestLocale, guestParams);
      const guestSubject = getTranslation("notifications.request_approved.subject", guestLocale, { id: approvalNumber });

      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({
          to: guest.email,
          subject: guestSubject,
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

    const userRow = await db.user.findUnique({ where: { id: request.requestedById } });
    const locale = (userRow as any)?.language || (effectiveSettings as any)?.defaultLanguage || "en";

    const commonParams = {
      destination: request.destination,
      gate: request.gate,
      date: formatDateForDisplay(request.fromDate),
      reason: comment ? getTranslation("common.reason", locale, { comment }) : ""
    };

    const message = getTranslation("notifications.request_rejected.body", locale, commonParams);
    const emailSubject = getTranslation("notifications.request_rejected.subject", locale, { destination: request.destination });

    const emailDispatches: { to: string; subject?: string; body: string }[] = [];
    const smsDispatches: { to: string; body: string }[] = [];

    if (effectiveSettings?.emailNotifications && request.requestedByEmail) {
      emailDispatches.push({
        to: request.requestedByEmail,
        subject: emailSubject,
        body: message,
      });
    }

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
      message: getTranslation("notifications.request_rejected.subject", locale, { destination: request.destination }),
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
    
    const userRow = await db.user.findUnique({ where: { id: request.requestedById } });
    const locale = (userRow as any)?.language || (effectiveSettings as any)?.defaultLanguage || "en";

    const message = getTranslation("notifications.guest_checkin.body", locale, {
      name: guest.name,
      organization: guest.organization,
      gate: request.gate
    });
    const emailSubject = getTranslation("notifications.guest_checkin.subject", locale, {});

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
    
    const userRow = await db.user.findUnique({ where: { id: request.requestedById } });
    const locale = (userRow as any)?.language || (effectiveSettings as any)?.defaultLanguage || "en";

    const message = getTranslation("notifications.guest_checkout.body", locale, {
      name: guest.name,
      destination: request.destination,
      surveyUrl: "#" // Survey URL is handled better in the event-driven trigger
    });
    
    const emailDispatches: { to: string; subject?: string; body: string }[] =
      [];
    const smsDispatches: { to: string; body: string }[] = [];
    
    if (effectiveSettings?.emailNotifications && request.requestedByEmail) {
      emailDispatches.push({
        to: request.requestedByEmail,
        subject: getTranslation("notifications.guest_checkout.subject", locale, {}),
        body: message,
      });
    }
    
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
    
    // Get guest language
    const locale = (effectiveSettings as any)?.defaultLanguage || "en"; // Default locale for guests if not specified
    
    const emailDispatches: { to: string; subject?: string; body: string }[] = [];
    const smsDispatches: { to: string; body: string }[] = [];

    for (const guest of request.guests) {
      const gLocale = (guest as any).preferredLanguage || locale;
      const gMsg = getTranslation("notifications.host_verified.body", gLocale, {
        name: guest.name,
        destination: request.destination,
        host: hostName
      });
      const gSub = getTranslation("notifications.host_verified.subject", gLocale, { destination: request.destination });

      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({ to: guest.email, subject: gSub, body: gMsg });
      }
      if (effectiveSettings?.smsNotifications && guest.phone) {
        smsDispatches.push({ to: guest.phone, body: gMsg });
      }
    }

    const requester = await db.user.findUnique({ where: { id: request.requestedById } });
    const rLocale = (requester as any)?.language || locale;

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "host_verified",
      message: getTranslation("notifications.host_verified.subject", rLocale, { destination: request.destination }),
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
    
    const locale = (effectiveSettings as any)?.defaultLanguage || "en";

    const emailDispatches: { to: string; subject?: string; body: string }[] = [];
    const smsDispatches: { to: string; body: string }[] = [];

    for (const guest of request.guests) {
      const gLocale = (guest as any).preferredLanguage || locale;
      const gMsg = getTranslation("notifications.host_denied.body", gLocale, {
        name: guest.name,
        destination: request.destination,
        host: hostName,
        reason: reason ? getTranslation("common.reason", gLocale, { comment: reason }) : ""
      });
      const gSub = getTranslation("notifications.host_denied.subject", gLocale, { destination: request.destination });

      if (effectiveSettings?.emailNotifications && guest.email) {
        emailDispatches.push({ to: guest.email, subject: gSub, body: gMsg });
      }
      if (effectiveSettings?.smsNotifications && guest.phone) {
        smsDispatches.push({ to: guest.phone, body: gMsg });
      }
    }

    const requester = await db.user.findUnique({ where: { id: request.requestedById } });
    const rLocale = (requester as any)?.language || locale;

    await createUserNotificationAndDispatch({
      userId: request.requestedById,
      type: "host_denied",
      message: getTranslation("notifications.host_denied.subject", rLocale, { destination: request.destination }),
      requestId: request.id,
      email: emailDispatches,
      sms: smsDispatches,
      tenantId: request.tenantId,
    });
  },

  // Notify all staff members of a given role about a request
  async notifyStaffByRole(
    tenantId: string,
    role: "approver1" | "approver2" | "reception",
    templateKey: string,
    request: Request,
    params: Record<string, any>,
    settings?: Settings
  ): Promise<void> {
    const effectiveSettings =
      settings ??
      (await db.settings.findFirst({ where: { tenantId } }).catch(() => null));

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const slug = tenant?.slug || "default";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // Construct role-specific dashboard URL
    const dashboardPath = role === "reception" ? "reception" : role;
    const url = `${baseUrl}/t/${slug}/${dashboardPath}`;

    // Find all users with this role in this tenant
    const users = await db.user.findMany({
      where: {
        tenantId,
        role: role as any,
      }
    });

    for (const user of users) {
      const locale = (user as any).language || effectiveSettings?.defaultLanguage || "en";
      const localizedParams = { 
        ...params, 
        url,
        requester: request.requestedBy
      };
      
      const message = getTranslation(`notifications.${templateKey}.body`, locale, localizedParams);
      const subject = getTranslation(`notifications.${templateKey}.subject`, locale, localizedParams);

      const emailDispatches = [];
      if (effectiveSettings?.emailNotifications && user.email) {
        emailDispatches.push({
          to: user.email,
          subject,
          body: message,
        });
      }

      await createUserNotificationAndDispatch({
        userId: user.id,
        type: templateKey as any,
        message,
        requestId: request.id,
        email: emailDispatches,
        tenantId: tenantId,
      });
    }
  },
};

export default notificationService;
