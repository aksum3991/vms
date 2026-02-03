"use client"

import type React from "react"

import { usePathname } from "next/navigation"
import { AppSidebar } from "./app-sidebar"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PanelLeftIcon, LogOut, Building2 } from "lucide-react"
import { useAuth } from "@/lib/auth"

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()

  useEffect(() => {
    const collapsed = localStorage.getItem("sidebar-collapsed")
    if (collapsed) {
      setIsCollapsed(collapsed === "true")
    }

    const handleStorageChange = () => {
      const collapsed = localStorage.getItem("sidebar-collapsed")
      setIsCollapsed(collapsed === "true")
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  if (pathname === "/login") {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      {isMobile && user && (
        <>
          <div className="fixed left-0 top-0 z-30 flex h-12 w-full items-center justify-between border-b border-gray-200 bg-white px-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="size-8">
                <PanelLeftIcon className="size-4" />
              </Button>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                <Building2 className="size-5 text-white" />
              </div>
              <span className="text-sm font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                VMS
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="size-8">
              <LogOut className="size-4" />
            </Button>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-3/4 sm:max-w-sm p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <div className="border-b border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                      <Building2 className="size-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                      VMS
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {user && (
                    <div className="grid gap-1">
                      {[
                        { href: "/", label: "New Request", roles: ["admin", "requester"] },
                        { href: "/requester", label: "My Requests", roles: ["admin", "requester"] },
                        { href: "/dashboard", label: "Dashboard", roles: ["admin", "approver1", "approver2"] },
                        { href: "/approver1", label: "Approver 1", roles: ["admin", "approver1"] },
                        { href: "/approver2", label: "Approver 2", roles: ["admin", "approver2"] },
                        { href: "/reception", label: "Reception", roles: ["admin", "reception"] },
                        { href: "/survey", label: "Survey", roles: ["admin", "requester"] },
                        { href: "/admin", label: "User Admin", roles: ["admin"] },
                        { href: "/settings", label: "Settings", roles: ["admin"] },
                        { href: "/email-preview", label: "Templates", roles: ["admin"] },
                        { href: "/notifications", label: "Notifications", roles: ["admin", "approver1", "approver2", "reception", "requester"] },
                      ]
                        .filter((l) => l.roles.includes(user.role))
                        .map((l) => (
                          <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-gray-100">
                            {l.label}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 p-3">
                  <Button variant="outline" className="w-full" onClick={() => { logout(); setMobileOpen(false) }}>
                    <LogOut className="mr-2 size-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          isMobile ? "ml-0 pt-12" : isCollapsed ? "ml-16" : "ml-64",
        )}
      >
        {children}
      </main>
    </div>
  )
}
