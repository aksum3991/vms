
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

import { useParams } from "next/navigation"

export function AppSidebar({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Get tenant slug from URL or fallback to user's primary slug
  const tenantSlug = (params?.slug as string) || user?.tenantSlug

  useEffect(() => {
    const collapsed = localStorage.getItem("sidebar-collapsed")
    if (collapsed) {
      setIsCollapsed(collapsed === "true")
    }
  }, [])

  useEffect(() => {
    if (user) {
      const fetchUnreadCount = async () => {
        try {
          const notifications = await getNotificationsByUserId(user.id)
          const unread = notifications.filter((n) => !n.read).length
          setUnreadCount(unread)
        } catch (e) {
          console.error("Error fetching notification count", e)
        }
      }
      fetchUnreadCount()
    }
  }, [user, pathname])

  if (pathname === "/login" || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
  }

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", String(newState))
    window.dispatchEvent(new Event("storage"))
  }

  // Define links based on mode
  const tenantLinks = [
    { href: tenantSlug ? `/t/${tenantSlug}` : "/", label: "New Request", icon: FileText, roles: ["admin", "requester"] },
    { href: tenantSlug ? `/t/${tenantSlug}/requester` : "/requester", label: "My Requests", icon: ListChecks, roles: ["admin", "requester"] },
    { href: tenantSlug ? `/t/${tenantSlug}/dashboard` : "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin", "approver1", "approver2"] },
    { href: tenantSlug ? `/t/${tenantSlug}/approver1` : "/approver1", label: "Approver 1", icon: CheckCircle, roles: ["admin", "approver1"] },
    { href: tenantSlug ? `/t/${tenantSlug}/approver2` : "/approver2", label: "Approver 2", icon: CheckCheck, roles: ["admin", "approver2"] },
    { href: tenantSlug ? `/t/${tenantSlug}/reception` : "/reception", label: "Reception", icon: UserCheck, roles: ["admin", "reception"] },
    { href: tenantSlug ? `/t/${tenantSlug}/survey` : "/survey", label: "Survey", icon: ClipboardList, roles: ["admin", "requester"] },
    { href: tenantSlug ? `/t/${tenantSlug}/admin` : "/admin", label: "User Admin", icon: Users, roles: ["admin"] },
    { href: tenantSlug ? `/t/${tenantSlug}/admin/audit-log` : "/admin/audit-log", label: "Audit Log", icon: BookUser, roles: ["admin"] },
    { href: tenantSlug ? `/t/${tenantSlug}/settings` : "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    { href: tenantSlug ? `/t/${tenantSlug}/email-preview` : "/email-preview", label: "Templates", icon: Mail, roles: ["admin"] },
  ]

  const superAdminLinks = [
    { href: "/superadmin", label: "Tenants", icon: Building2, roles: ["superadmin"] },
    { href: "/superadmin/users", label: "Global Users", icon: Users, roles: ["superadmin"] },
    { href: "/superadmin/audit-logs", label: "Global Audit", icon: BookUser, roles: ["superadmin"] },
  ]

  const links = isSuperAdmin ? superAdminLinks : tenantLinks
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
            <h1 className="bg-clip-text text-lg font-semibold text-transparent bg-gradient-to-r from-teal-600 to-cyan-600">
              {isSuperAdmin ? "Platform Administration" : "VMS"}
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

          {!isSuperAdmin && (
             <Link href={tenantSlug ? `/t/${tenantSlug}/notifications` : "/notifications"}>
             <Button
               variant={pathname.includes("/notifications") ? "default" : "ghost"}
               size="sm"
               className={cn(
                 "relative w-full justify-start",
                 pathname.includes("/notifications")
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
          )}

          {/* Superadmin toggle for multi-role users */}
          {user.role === "superadmin" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
               <Link href={isSuperAdmin ? (tenantSlug ? `/t/${tenantSlug}/dashboard` : "/dashboard") : "/superadmin"}>
                <Button variant="outline" size="sm" className="w-full text-xs h-8 border-orange-200 text-orange-700 hover:bg-orange-50">
                   {isSuperAdmin ? "Switch to Tenant" : "Platform Management"}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* User Section at Bottom */}
      <div className="mt-auto shrink-0 border-t border-gray-200 bg-white p-3">
        {!isCollapsed ? (
          <div className="space-y-2">
            <div className="rounded-lg border p-3 border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="border-opacity-50 text-[10px] capitalize border-teal-300 text-teal-700">
                  {user.role}
                </Badge>
                {tenantSlug && !isSuperAdmin && (
                  <Badge variant="secondary" className="text-[10px] uppercase bg-white bg-opacity-50">
                    {tenantSlug}
                  </Badge>
                )}
              </div>
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
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white bg-gradient-to-br from-teal-500 to-cyan-600">
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

