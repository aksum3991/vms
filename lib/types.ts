export interface Guest {
  id: string;
  name: string;
  organization: string;
  email?: string;
  phone?: string;
  laptop: boolean;
  mobile: boolean;
  flash: boolean;
  otherDevice: boolean;
  otherDeviceDescription?: string;
  idPhotoUrl?: string;
  checkInTime?: string;
  checkOutTime?: string;
  approver1Status?: "pending" | "approved" | "rejected" | "blacklisted";
  approver2Status?: "pending" | "approved" | "rejected" | "blacklisted";
  approver1Comment?: string;
  approver2Comment?: string;
  preferredLanguage?: string;
}

export interface Request {
  id: string;
  approvalNumber?: string;
  requestedBy: string;
  requestedById: string;
  requestedByEmail: string;
  destination: string;
  gate: string;
  fromDate: string;
  toDate: string;
  purpose: string;
  guests: Guest[];
  status:
    | "draft"
    | "submitted"
    | "host-pending"
    | "approver1-pending"
    | "approver1-approved"
    | "approver1-rejected"
    | "approver2-pending"
    | "approver2-approved"
    | "approver2-rejected"
    | "withdrawn";
  createdAt: string;
  updatedAt: string;
  approver1Comment?: string;
  approver1Date?: string;
  approver1By?: string;
  approver2Comment?: string;
  approver2Date?: string;
  approver2By?: string;
  withdrawnAt?: string;
  withdrawnById?: string;
  withdrawalReason?: string;
  tenantId?: string;
}

export interface Survey {
  id: string;
  requestId: string;
  guestId: string;
  rating: number;
  comment: string;
  submittedAt: string;
}

export type UserRole =
  | "admin"
  | "requester"
  | "approver1"
  | "approver2"
  | "reception"
  | "superadmin";

export interface User {
  id: string;
  email: string;
  password: string; // In production, this would be hashed
  name: string;
  role: UserRole;
  assignedGates?: string[]; // For reception users
  active?: boolean; // Added active field for account activation
  tenantId?: string | null;
  tenantSlug?: string | null;
  language?: string;
  phone?: string;
  createdAt: string;
}

export interface Settings {
  approvalSteps: 1 | 2;
  emailNotifications: boolean;
  smsNotifications: boolean;
  checkInOutNotifications: boolean;
  gates: string[];
  primaryColor?: string;
  accentColor?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smsGatewayUrl?: string;
  smsApiKey?: string;
  emailGatewayUrl?: string;
  emailApiKey?: string;
  defaultLanguage?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  requestId: string;
  read: boolean;
  createdAt: string;
}

export interface BlacklistEntry {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  reason?: string;
  active: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: object;
  timestamp: string;
  userId: string;
  userName: string;
}
