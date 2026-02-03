
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
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Building2,
  Users,
  BookUser,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { getNotificationsByUserId } from "@/lib/actions"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const collapsed = localStorage.getItem("sidebar-collapsed")
    if (collapsed) {
      setIsCollapsed(collapsed === "true")
    }
  }, [])

  useEffect(() => {
    if (user) {
      const fetchUnreadCount = async () => {
        const notifications = await getNotificationsByUserId(user.id)
        const unread = notifications.filter((n) => !n.read).length
        setUnreadCount(unread)
      }
      fetchUnreadCount()
    }
  }, [user, pathname])

  if (pathname === "/login" || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
    window.dispatchEvent(new Event("storage"))
  }

  const links = [
    { href: "/", label: "New Request", icon: FileText, roles: ["admin", "requester"] },
    { href: "/requester", label: "My Requests", icon: ListChecks, roles: ["admin", "requester"] },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin", "approver1", "approver2"] },
    { href: "/approver1", label: "Approver 1", icon: CheckCircle, roles: ["admin", "approver1"] },
    { href: "/approver2", label: "Approver 2", icon: CheckCheck, roles: ["admin", "approver2"] },
    { href: "/reception", label: "Reception", icon: UserCheck, roles: ["admin", "reception"] },
    { href: "/survey", label: "Survey", icon: ClipboardList, roles: ["admin", "requester"] },
    { href: "/admin", label: "User Admin", icon: Users, roles: ["admin"] },
    { href: "/admin/audit-log", label: "Audit Log", icon: BookUser, roles: ["admin"] },
    { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    { href: "/email-preview", label: "Templates", icon: Mail, roles: ["admin"] },
  ]

  const visibleLinks = links.filter((link) => link.roles.includes(user.role))

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 md:flex",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
              <Building2 className="size-5 text-white" />
            </div>
            <h1 className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-lg font-semibold text-transparent">
              VMS
            </h1>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
            <Building2 className="size-5 text-white" />
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={toggleCollapse} className="size-8 shrink-0">
          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>
      
      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <div className="flex flex-col gap-1">
          {visibleLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start",
                    isActive
                      ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
                      : "",
                    isCollapsed && "justify-center px-2",
                  )}
                  title={isCollapsed ? link.label : undefined}
                >
                  <Icon className={cn("size-4 shrink-0", !isCollapsed && "mr-3")} />
                  {!isCollapsed && <span className="truncate">{link.label}</span>}
                </Button>
              </Link>
            )
          })}

          {/* Notifications Link */}
          <Link href="/notifications">
            <Button
              variant={pathname === "/notifications" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "relative w-full justify-start",
                pathname === "/notifications"
                  ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
                  : "",
                isCollapsed && "justify-center px-2",
              )}
              title={isCollapsed ? "Notifications" : undefined}
            >
              <Bell className={cn("size-4 shrink-0", !isCollapsed && "mr-3")} />
              {!isCollapsed && <span>Notifications</span>}
              {unreadCount > 0 && (
                <Badge
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full bg-red-500 p-0 text-xs text-white",
                    isCollapsed ? "absolute -right-1 -top-1" : "ml-auto",
                  )}
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* User Section at Bottom */}
      <div className="mt-auto shrink-0 border-t border-gray-200 bg-white p-3">
        {!isCollapsed ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-3">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
              <Badge variant="outline" className="mt-1 border-teal-300 text-xs capitalize text-teal-700">
                {user.role}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full bg-transparent hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="mr-2 size-4" />
              Logout
            </Button>
            <div className="border-t pt-2 text-center">
              <p className="text-xs text-gray-500">
                Powered by{" "}
                <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text font-semibold text-transparent">
                  MInT
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-semibold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="size-8 hover:bg-red-50 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
