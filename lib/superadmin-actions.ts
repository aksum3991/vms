"use server";

import db from "./db";
import { requireSuperAdminSession } from "./tenant-context";
import { revalidatePath } from "next/cache";
import {
  kcEnsureUser,
  kcSetPassword,
  kcSetSingleRealmRole,
} from "./keycloak-admin";
import { emitUserRegistrationNow } from "./notifications/dispatcher";
import { mapRowToUser } from "./mappers";
import { User } from "./types";

export type TenantWithCounts = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  _count: {
    users: number;
    requests: number;
  };
};

export async function getTenants(): Promise<TenantWithCounts[]> {
  try {
    await requireSuperAdminSession();
    return (await (db as any).tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            requests: true,
          },
        },
      },
    })) as TenantWithCounts[];
  } catch (error) {
    console.error("[superadmin-actions] Error fetching tenants:", error);
    return [];
  }
}

export async function saveTenant(data: {
  id?: string;
  name: string;
  slug: string;
  active?: boolean;
}) {
  try {
    const session = await requireSuperAdminSession();

    if (data.id) {
      await (db as any).tenant.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug: data.slug.toLowerCase(),
          active: data.active ?? true,
        },
      });
    } else {
      // Create tenant and default settings
      await db.$transaction(async (tx) => {
        const tenant = await (tx as any).tenant.create({
          data: {
            name: data.name,
            slug: data.slug.toLowerCase(),
            active: true,
          },
        });

        await tx.settings.create({
          data: {
            tenantId: tenant.id,
            approvalSteps: 2,
            gates: ["Gate 1"],
            emailNotifications: true,
            smsNotifications: false,
            checkInOutNotifications: true,
          } as any,
        });
      });
    }

    revalidatePath("/superadmin");
    return { success: true };
  } catch (error: any) {
    console.error("[superadmin-actions] Error saving tenant:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleTenantActive(id: string, active: boolean) {
  try {
    await requireSuperAdminSession();
    await (db as any).tenant.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/superadmin");
  } catch (error) {
    console.error("[superadmin-actions] Error toggling tenant active status:", error);
    throw error;
  }
}

export async function getGlobalUsers(): Promise<User[]> {
  try {
    await requireSuperAdminSession();
    const users = await (db.user as any).findMany({
      include: {
        tenant: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map(mapRowToUser);
  } catch (error) {
    console.error("[superadmin-actions] Error fetching global users:", error);
    return [];
  }
}
export async function createTenantAdmin(data: {
  tenantId: string;
  email: string;
  name: string;
  password?: string;
}) {
  try {
    await requireSuperAdminSession();
    
    // 1. Check if user already exists in DB
    const existingUser = await (db.user as any).findFirst({
      where: { email: data.email.toLowerCase() },
    });
    if (existingUser) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    // 2. Fetch tenant for notification info
    const tenant = await (db as any).tenant.findUnique({
      where: { id: data.tenantId },
    });
    if (!tenant) throw new Error("Tenant not found");

    const temporaryPassword = data.password || Math.random().toString(36).slice(-10);

    // 3. Create in Keycloak
    const kcUser = await kcEnsureUser(data.email, data.name);
    await kcSetPassword(kcUser.id, temporaryPassword);
    await kcSetSingleRealmRole(kcUser.id, "admin");

    // 4. Create in Local DB
    const newUser = await (db as any).user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        role: "admin",
        password: temporaryPassword,
        tenantId: data.tenantId,
        active: true,
      },
    });

    // 5. Trigger notification
    await emitUserRegistrationNow({
      userId: newUser.id,
      tenantId: data.tenantId,
      email: data.email,
      name: data.name,
      temporaryPassword,
      tenantName: tenant.name,
      role: "admin",
    });

    revalidatePath("/superadmin");
    return { success: true };
  } catch (error: any) {
    console.error("[superadmin-actions] Error creating tenant admin:", error);
    return { success: false, error: error.message };
  }
}
