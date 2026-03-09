import type { User, Settings, Notification, Survey, Guest, Request } from "./types";

// NOTE: This file intentionally does NOT have a `"use server"` directive.
// These pure mapping helpers are synchronous and can be safely imported
// from both server and client modules without being treated as server actions.

export function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    assignedGates: row.assignedGates,
    active: row.active ?? true,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

