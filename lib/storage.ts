import type { User } from "./types"

// This file now only handles client-side storage for the currently logged-in user.
// All other data is fetched from the server via server actions.

export const storage = {
  getCurrentUser(): User | null {
    if (typeof window === "undefined") return null
    const data = localStorage.getItem("document_management_current_user")
    return data ? JSON.parse(data) : null
  },

  setCurrentUser(user: User | null): void {
    if (typeof window === "undefined") return;
    if (user) {
      localStorage.setItem("document_management_current_user", JSON.stringify(user))
    } else {
      localStorage.removeItem("document_management_current_user")
    }
  },
}
