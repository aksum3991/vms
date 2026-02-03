import type { Request, Guest } from "./types"

interface EmailTemplate {
  subject: string
  body: string
}

interface SMSTemplate {
  message: string
}

export const emailTemplates = {
  requestSubmitted: (request: Request): EmailTemplate => ({
    subject: "Request Submitted Successfully",
    body: `
Dear ${request.requestedBy},

Your visitor request has been submitted successfully and is now pending approval.

Request Details:
- Destination: ${request.destination}
- Gate: ${request.gate}
- Date: ${request.fromDate} to ${request.toDate}
- Number of Guests: ${request.guests.length}

You will receive a notification once your request is reviewed.

Best regards,
Document Management System
    `.trim(),
  }),

  requestApprovedApprover1: (request: Request): EmailTemplate => ({
    subject: "Request Approved by Approver 1",
    body: `
Dear ${request.requestedBy},

Good news! Your visitor request has been approved by Approver 1.

Request Details:
- Destination: ${request.destination}
- Gate: ${request.gate}
- Date: ${request.fromDate} to ${request.toDate}
- Status: Approved by Approver 1

Your request will now proceed to Approver 2 for final approval.

Best regards,
Document Management System
    `.trim(),
  }),

  requestApprovedFinal: (request: Request): EmailTemplate => ({
    subject: "Request Approved - Visitor Access Granted",
    body: `
Dear ${request.requestedBy},

Congratulations! Your visitor request has been fully approved.

Request Details:
- Destination: ${request.destination}
- Gate: ${request.gate}
- Date: ${request.fromDate} to ${request.toDate}
- Number of Guests: ${request.guests.length}

Guests:
${request.guests.map((guest, index) => `${index + 1}. ${guest.name} - ${guest.organization}`).join("\n")}

Your guests can now check in at Gate ${request.gate} during the approved dates.

Best regards,
Document Management System
    `.trim(),
  }),

  requestRejected: (request: Request, comment: string): EmailTemplate => ({
    subject: "Request Rejected",
    body: `
Dear ${request.requestedBy},

We regret to inform you that your visitor request has been rejected.

Request Details:
- Destination: ${request.destination}
- Gate: ${request.gate}
- Date: ${request.fromDate} to ${request.toDate}

Reason for Rejection:
${comment}

Please contact the approver if you have any questions or need to resubmit your request.

Best regards,
Document Management System
    `.trim(),
  }),

  guestInvitation: (request: Request, guest: Guest): EmailTemplate => ({
    subject: `Invitation to Visit ${request.destination}`,
    body: `
Dear ${guest.name},

You have been invited to visit ${request.destination}.

Visit Details:
- Host: ${request.requestedBy}
- Destination: ${request.destination}
- Gate Number: ${request.gate}
- Date: ${request.fromDate} to ${request.toDate}
- Organization: ${guest.organization}

Approved Devices:
${guest.laptop ? "✓ Laptop" : ""}
${guest.mobile ? "✓ Mobile Phone" : ""}
${guest.flash ? "✓ Flash Drive" : ""}
${guest.otherDevice ? `✓ Other: ${guest.otherDeviceDescription}` : ""}

Please present a valid ID at Gate ${request.gate} upon arrival.

Best regards,
Document Management System
    `.trim(),
  }),

  guestCheckIn: (request: Request, guest: Guest): EmailTemplate => ({
    subject: "Guest Checked In",
    body: `
Dear ${request.requestedBy},

Your guest has checked in successfully.

Guest Details:
- Name: ${guest.name}
- Organization: ${guest.organization}
- Check-in Time: ${guest.checkInTime ? new Date(guest.checkInTime).toLocaleString() : "N/A"}
- Gate: ${request.gate}
- Destination: ${request.destination}

Best regards,
Document Management System
    `.trim(),
  }),

  guestCheckOut: (request: Request, guest: Guest): EmailTemplate => ({
    subject: "Guest Checked Out",
    body: `
Dear ${request.requestedBy},

Your guest has checked out successfully.

Guest Details:
- Name: ${guest.name}
- Organization: ${guest.organization}
- Check-out Time: ${guest.checkOutTime ? new Date(guest.checkOutTime).toLocaleString() : "N/A"}
- Gate: ${request.gate}

Best regards,
Document Management System
    `.trim(),
  }),
}

export const smsTemplates = {
  requestApproved: (request: Request): SMSTemplate => ({
    message: `Your visitor request for ${request.destination} on ${request.fromDate} has been approved. Gate: ${request.gate}. Check your email for details.`,
  }),

  requestRejected: (request: Request): SMSTemplate => ({
    message: `Your visitor request for ${request.destination} has been rejected. Please check your email for details.`,
  }),

  guestInvitation: (request: Request, guest: Guest): SMSTemplate => ({
    message: `You're invited to visit ${request.destination} on ${request.fromDate}. Gate: ${request.gate}. Host: ${request.requestedBy}. Check email for details.`,
  }),

  guestCheckIn: (request: Request, guest: Guest): SMSTemplate => ({
    message: `Your guest ${guest.name} has checked in at Gate ${request.gate} for ${request.destination}.`,
  }),

  reminderBeforeVisit: (request: Request, guest: Guest): SMSTemplate => ({
    message: `Reminder: Your visit to ${request.destination} is scheduled for tomorrow ${request.fromDate}. Gate: ${request.gate}.`,
  }),
}

// Notification helper function
export function sendNotification(
  userId: string,
  type: "request_submitted" | "request_approved" | "request_rejected" | "guest_checkin",
  message: string,
  requestId: string,
) {
  const notification = {
    id: crypto.randomUUID(),
    userId,
    type,
    message,
    requestId,
    read: false,
    createdAt: new Date().toISOString(),
  }

  // In a real app, this would also trigger email/SMS sending based on settings
  // For now, we just store the notification in localStorage
  return notification
}
