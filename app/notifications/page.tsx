"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { getNotificationsByUserId, markNotificationAsRead } from "@/lib/actions"
import { useAuth } from "@/lib/auth"
import type { Notification } from "@/lib/types"
import { ProtectedRoute } from "@/components/protected-route"

function NotificationsPageContent() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  useEffect(() => {
    if (user) {
      loadNotifications()
    }
  }, [user])

  const loadNotifications = async () => {
    if (!user) return
    const userNotifications = await getNotificationsByUserId(user.id)
    setNotifications(
      userNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    )
  }

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId)
    await loadNotifications()
  }

  const markAllAsRead = async () => {
    for (const n of notifications) {
      if (!n.read) {
        await markNotificationAsRead(n.id)
      }
    }
    await loadNotifications()
  }

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "request_approved":
        return <CheckCircle className="size-5 text-green-600" />
      case "request_rejected":
        return <XCircle className="size-5 text-red-600" />
      case "request_submitted":
        return <AlertCircle className="size-5 text-blue-600" />
      case "guest_checkin":
        return <CheckCircle className="size-5 text-green-600" />
      default:
        return <Bell className="size-5 text-gray-600" />
    }
  }

  const filteredNotifications = filter === "unread" ? notifications.filter((n) => !n.read) : notifications

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentNotifications = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 pb-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-cyan-600">Notifications</h1>
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            Mark All as Read
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
                All ({notifications.length})
              </Button>
              <Button
                variant={filter === "unread" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("unread")}
              >
                Unread ({notifications.filter((n) => !n.read).length})
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {currentNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="mx-auto mb-4 size-12 text-gray-400" />
                <p className="text-gray-500">No notifications to display</p>
              </CardContent>
            </Card>
          ) : (
            currentNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-colors ${notification.read ? "bg-white" : "border-l-4 border-l-blue-600 bg-blue-50"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{notification.message}</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <Button size="sm" variant="ghost" onClick={() => handleMarkAsRead(notification.id)}>
                            <CheckCircle className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <Card className="mt-4">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsPageContent />
    </ProtectedRoute>
  )
}
