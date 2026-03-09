"use client"

import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"

/**
 * Handles server action errors with automatic logout on unauthorized.
 * 
 * Usage:
 *   const handleError = useServerErrorHandler()
 *   const result = await someServerAction()
 *   if (!result.success) {
 *     handleError(result)
 *     return
 *   }
 */
export function useServerErrorHandler() {
  const router = useRouter()
  const { toast } = useToast()

  return (result: { success: boolean; error?: string }) => {
    if (result.success) return

    // Check if error is unauthorized
    const isUnauthorized =
      result.error?.toLowerCase().includes("unauthorized") ||
      result.error?.toLowerCase().includes("please log in")

    if (isUnauthorized) {
      // Clear localStorage
      localStorage.removeItem("user")

      // Show toast
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Please log in again to continue.",
      })

      // Redirect to login
      router.push("/login")
    } else {
      // Show generic error toast
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "An error occurred",
      })
    }
  }
}
