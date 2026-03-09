export type NotificationEvent =
  | BlacklistAttemptEvent
  | Approver1PendingReminderEvent
  | GuestCheckoutConfirmationEvent
  | EmergencyPanicEvent
  | UserRegistrationEvent;

export type UserRegistrationEvent = {
  type: "user.registration";
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  temporaryPassword?: string;
  tenantName: string;
  role: string;
  timestamp: string; // ISO
};

export type BlacklistAttemptEvent = {
  type: "blacklist.attempt";
  requestId?: string;
  requesterId: string;
  requesterEmail?: string;
  requesterName?: string;
  guest: {
    name: string;
    organization?: string;
    email?: string;
    phone?: string;
  };
  matchedBy?: string[];
  timestamp: string; // ISO
};

export type Approver1PendingReminderEvent = {
  type: "approval.approver1.pending-reminder";
  requestId: string;
  createdAt: string; // ISO
  timestamp: string; // ISO
};

export type GuestCheckoutConfirmationEvent = {
  type: "guest.checkout.confirmation";
  requestId: string;
  guestId: string;
  guest: {
    name: string;
    email?: string;
    phone?: string;
  };
  timestamp: string; // ISO
};

export type EmergencyPanicEvent = {
  type: "security.panic";
  triggeredByUserId: string;
  location?: string;
  message?: string;
  timestamp: string; // ISO
};
