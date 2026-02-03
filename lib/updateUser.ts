import { saveUser } from "./actions"
import type { User } from "./types"

export async function updateUser(user: User): Promise<void> {
  return saveUser(user)
}
