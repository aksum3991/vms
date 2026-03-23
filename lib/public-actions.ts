"use server";

import { db } from "./db";
import { tenantDb } from "./db-tenant";

/**
 * lib/public-actions.ts
 * 
 * Public server actions that do NOT require authentication.
 * Used for guest-facing features like feedback surveys and self-registration.
 */

export async function saveGuestSurvey(data: {
  requestId: string;
  guestId: string;
  rating: number;
  comment: string;
}) {
  try {
    // 1. Resolve tenantId from the request/guest
    const guest = await (db.guest as any).findUnique({
      where: { id: data.guestId },
      select: { 
        tenantId: true,
        requestId: true,
        checkOutTime: true,
      },
    });

    if (!guest) {
      throw new Error("Invalid guest ID");
    }

    if (guest.requestId !== data.requestId) {
      throw new Error("Request ID mismatch");
    }

    if (!guest.checkOutTime) {
      throw new Error("Guest must be checked out before providing feedback");
    }

    // 2. Check for existing survey
    const existing = await (db.survey as any).findUnique({
      where: { guestId: data.guestId },
    });

    if (existing) {
      throw new Error("Feedback already submitted for this visit");
    }

    // 3. Save survey using tenantDb for isolation safety
    const tdb = tenantDb(guest.tenantId);
    
    await (tdb.survey as any).create({
      data: {
        requestId: data.requestId,
        guestId: data.guestId,
        rating: data.rating,
        comment: data.comment,
        tenantId: guest.tenantId, // Explicit for safety
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[public-actions] Error saving guest survey:", error);
    return { success: false, error: error.message };
  }
}

export async function getGuestSurveyInfo(guestId: string, requestId: string) {
  try {
    const guest = await (db.guest as any).findUnique({
      where: { id: guestId },
      select: {
        name: true,
        organization: true,
        requestId: true,
        tenant: { select: { name: true } },
      },
    });

    if (!guest || guest.requestId !== requestId) {
      return null;
    }

    return {
      guestName: guest.name,
      organization: guest.organization,
      tenantName: guest.tenant?.name,
    };
  } catch (error) {
    console.error("[public-actions] Error fetching survey info:", error);
    return null;
  }
}

export async function submitSelfRegistration(
  slug: string,
  guestData: {
    name: string;
    organization: string;
    email: string;
    phone: string;
    laptop: boolean;
    mobile: boolean;
    flash: boolean;
    otherDevice: boolean;
    otherDeviceDescription: string;
    idPhotoUrl: string;
  },
  requestData: {
    destination: string;
    gate: string;
    fromDate: string;
    toDate: string;
    purpose: string;
    hostEmail?: string;
  }
) {
  try {
    // Determine the tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!tenant) throw new Error("Invalid tenant URL slug.");

    if (!tenant.active) {
      throw new Error("This organization's portal is currently inactive.");
    }

    // Determine the Host (Requested By)
    let hostUserId: string | null = null;
    let hostUserEmail: string | null = null;
    let newStatus = "approver1_pending";

    const tdb = tenantDb(tenant.id);

    if (requestData.hostEmail) {
      const host = await db.user.findFirst({
        where: { tenantId: tenant.id, email: requestData.hostEmail },
      });

      if (host) {
        hostUserId = host.id;
        hostUserEmail = host.email;
        newStatus = "host_pending"; // Route to host verification step
      } else {
         throw new Error("Host email was not found in our directory. Please check the spelling or leave it blank.");
      }
    } else {
      // Use a dedicated system account for public registrations
      const SYSTEM_EMAIL = "public-portal@vms.system";
      let systemUser = await db.user.findFirst({
        where: { tenantId: tenant.id, email: SYSTEM_EMAIL },
      });

      if (!systemUser) {
        // Create the system user if it doesn't exist
        systemUser = await db.user.create({
          data: {
            email: SYSTEM_EMAIL,
            name: "Visitor (Self-Registered)",
            role: "requester",
            password: "system-generated-account", // Placeholder
            active: true,
            tenantId: tenant.id,
          },
        });
      }

      hostUserId = systemUser.id;
      // We store the guest's name in this field to be used as 'Requested By'
      hostUserEmail = guestData.name; 
    }

    // Create the Request and Guest atomically using Tenant DB
    await (tdb.request as any).create({
      data: {
        requestedById: hostUserId!,
        requestedByEmail: hostUserEmail!,
        destination: requestData.destination,
        gate: requestData.gate,
        fromDate: new Date(requestData.fromDate),
        toDate: new Date(requestData.toDate),
        purpose: `[Public Registration] ${requestData.purpose}`,
        status: newStatus,
        tenantId: tenant.id,
        guests: {
          create: {
            name: guestData.name,
            organization: guestData.organization,
            email: guestData.email,
            phone: guestData.phone,
            laptop: guestData.laptop,
            mobile: guestData.mobile,
            flash: guestData.flash,
            otherDevice: guestData.otherDevice,
            otherDeviceDescription: guestData.otherDeviceDescription,
            idPhotoUrl: guestData.idPhotoUrl,
            tenantId: tenant.id,
          },
        },
      },
    });

    return { success: true, statusAssigned: newStatus };
  } catch (error: any) {
    console.error("[public-actions] Error saving self registration:", error);
    return { success: false, error: error.message };
  }
}

export async function getPublicTenantGates(slug: string): Promise<string[]> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true }
    });

    if (!tenant) return [];

    const settings = await (db.settings as any).findFirst({
      where: { tenantId: tenant.id },
      select: { gates: true }
    });

    return settings?.gates || ["Main Gate"];
  } catch (error) {
    console.error("[public-actions] Error fetching gates:", error);
    return ["Main Gate"];
  }
}
