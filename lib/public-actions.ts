import { db } from "./db";
import { tenantDb } from "./db-tenant";

/**
 * lib/public-actions.ts
 * 
 * Public server actions that do NOT require authentication.
 * Used for guest-facing features like feedback surveys.
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
