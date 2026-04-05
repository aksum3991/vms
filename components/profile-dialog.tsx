"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { updateMyProfile } from "@/lib/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { User, Globe } from "lucide-react"

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [language, setLanguage] = useState(user?.language || "en")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateMyProfile({ language })
      if (result.success) {
        toast({
          title: "Profile Updated",
          description: "Your language preference has been saved.",
        })
        onOpenChange(false)
        // Optionally reload to apply language changes if UI translation is implemented
        window.location.reload()
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: result.error || "An unexpected error occurred.",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not connect to the server.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="size-5 text-cyan-600" />
            My Profile
          </DialogTitle>
          <DialogDescription>
            Manage your personal account settings and preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">Account Details</Label>
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="mt-1 text-xs font-semibold text-cyan-700 capitalize">Role: {user.role}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-gray-500" />
              <Label htmlFor="language" className="text-sm font-medium">Notification Language</Label>
            </div>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600 transition-all"
            >
              <option value="en">English (US)</option>
              <option value="am">Amharic (አማርኛ)</option>
            </select>
            <p className="text-[11px] text-gray-500 italic">
              * This preference determines the language of the automated notifications you receive.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
