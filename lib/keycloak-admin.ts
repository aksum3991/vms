// lib/keycloak-admin.ts
export type KcUser = { id: string; email?: string; username?: string };

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const KC_ISSUER = () => env("AUTH_KEYCLOAK_ISSUER"); // http://localhost:8081/realms/vms
const KC_ADMIN_BASE = () => env("KC_ADMIN_BASE"); // http://localhost:8081/admin/realms/vms
const KC_ADMIN_CLIENT_ID = () => env("KC_ADMIN_CLIENT_ID"); // vms3-admin
const KC_ADMIN_CLIENT_SECRET = () => env("KC_ADMIN_CLIENT_SECRET");

async function getAdminToken(): Promise<string> {
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", KC_ADMIN_CLIENT_ID());
  body.set("client_secret", KC_ADMIN_CLIENT_SECRET());

  const res = await fetch(`${KC_ISSUER()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Keycloak token failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

async function kcFetch(path: string, init: RequestInit = {}) {
  const token = await getAdminToken();
  return fetch(`${KC_ADMIN_BASE()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function kcFindUserByEmail(email: string): Promise<KcUser | null> {
  const res = await kcFetch(`/users?email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    throw new Error(
      `Keycloak find user failed: ${res.status} ${await res.text()}`,
    );
  }
  const users = (await res.json()) as KcUser[];
  return users?.[0] ?? null;
}

export async function kcEnsureUser(
  email: string,
  name?: string,
  enabled = true,
): Promise<KcUser> {
  const existing = await kcFindUserByEmail(email);
  if (existing) return existing;

  const res = await kcFetch(`/users`, {
    method: "POST",
    body: JSON.stringify({
      username: email,
      email,
      enabled,
      emailVerified: false,
      firstName: name || undefined,
    }),
  });

  if (res.status !== 201 && res.status !== 204 && res.status !== 409) {
    throw new Error(
      `Keycloak create user failed: ${res.status} ${await res.text()}`,
    );
  }

  const created = await kcFindUserByEmail(email);
  if (!created) {
    throw new Error("Keycloak user created but could not be found afterwards");
  }
  return created;
}

export async function kcSetPassword(
  userId: string,
  password: string,
  temporary = true,
) {
  const res = await kcFetch(`/users/${userId}/reset-password`, {
    method: "PUT",
    body: JSON.stringify({ type: "password", value: password, temporary }),
  });
  if (!res.ok) {
    throw new Error(
      `Keycloak set password failed: ${res.status} ${await res.text()}`,
    );
  }
}

export async function kcSetEnabled(userId: string, enabled: boolean) {
  const res = await kcFetch(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    throw new Error(
      `Keycloak enable/disable failed: ${res.status} ${await res.text()}`,
    );
  }
}

/**
 * VMS business roles stored as Realm Roles in Keycloak.
 * We keep exactly ONE of these roles per user to match your DB (user.role).
 */
const VMS_REALM_ROLES = [
  "admin",
  "requester",
  "approver1",
  "approver2",
  "reception",
] as const;

export type VmsRole = (typeof VMS_REALM_ROLES)[number];

type RoleRep = { id: string; name: string };

/**
 * Set exactly one realm role for the user:
 * - removes other VMS roles (if present)
 * - assigns the requested role
 */
export async function kcSetSingleRealmRole(userId: string, role: VmsRole) {
  // 1) Get current realm role mappings
  const curRes = await kcFetch(`/users/${userId}/role-mappings/realm`, {
    method: "GET",
  });
  if (!curRes.ok) {
    throw new Error(
      `Keycloak role-mappings fetch failed: ${curRes.status} ${await curRes.text()}`,
    );
  }

  const current = (await curRes.json()) as RoleRep[];

  // 2) Remove any existing VMS roles
  const toRemove = current.filter((r) =>
    (VMS_REALM_ROLES as readonly string[]).includes(r.name),
  );

  if (toRemove.length > 0) {
    const delRes = await kcFetch(`/users/${userId}/role-mappings/realm`, {
      method: "DELETE",
      body: JSON.stringify(toRemove),
    });
    if (!delRes.ok) {
      throw new Error(
        `Keycloak role remove failed: ${delRes.status} ${await delRes.text()}`,
      );
    }
  }

  // 3) Lookup role representation
  const roleRes = await kcFetch(`/roles/${encodeURIComponent(role)}`, {
    method: "GET",
  });
  if (!roleRes.ok) {
    throw new Error(
      `Keycloak role lookup failed (${role}): ${roleRes.status} ${await roleRes.text()}`,
    );
  }

  const roleRep = (await roleRes.json()) as RoleRep;

  // 4) Assign role
  const addRes = await kcFetch(`/users/${userId}/role-mappings/realm`, {
    method: "POST",
    body: JSON.stringify([roleRep]),
  });
  if (!addRes.ok) {
    throw new Error(
      `Keycloak role assign failed: ${addRes.status} ${await addRes.text()}`,
    );
  }
}