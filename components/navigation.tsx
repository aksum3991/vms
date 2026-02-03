"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  CheckCircle,
  CheckCheck,
  UserCheck,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Mail,
  ListChecks,
  Building2,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { getNotificationsByUserId } from "@/lib/actions"
import { useEffect, useState } from "react"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user) {
      const fetchNotifications = async () => {
        const notifications = await getNotificationsByUserId(user.id)
        const unread = notifications.filter((n) => !n.read).length
        setUnreadCount(unread)
      }
      fetchNotifications()
    }
  }, [user, pathname])

  if (pathname === "/login" || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const links = [
    { href: "/", label: "New Request", icon: FileText, roles: ["admin", "requester"] },
    { href: "/requester", label: "My Requests", icon: ListChecks, roles: ["admin", "requester"] },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin", "approver1", "approver2"] },
    { href: "/approver1", label: "Approver 1", icon: CheckCircle, roles: ["admin", "approver1"] },
    { href: "/approver2", label: "Approver 2", icon: CheckCheck, roles: ["admin", "approver2"] },
    { href: "/reception", label: "Reception", icon: UserCheck, roles: ["admin", "reception"] },
    { href: "/survey", label: "Survey", icon: ClipboardList, roles: ["admin", "requester"] },
    { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    { href: "/admin", label: "User Admin", icon: Settings, roles: ["admin"] },
    { href: "/email-preview", label: "Templates", icon: Mail, roles: ["admin"] },
  ]

  const visibleLinks = links.filter((link) => link.roles.includes(user.role))

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-cyan-600 flex items-center justify-center">
              <Building2 className="size-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-cyan-700">VMS</h1>
          </div>
          <div className="flex items-center gap-2">
            {visibleLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={isActive ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                  >
                    <Icon className="mr-2 size-4" />
                    {link.label}
                  </Button>
                </Link>
              )
            })}
            <Link href="/notifications">
              <div className="relative">
                <Button variant="ghost" size="sm">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 p-0 text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </Link>
            <div className="ml-2 flex items-center gap-2 border-l pl-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
