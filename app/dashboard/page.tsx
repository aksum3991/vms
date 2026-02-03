"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Building2, MapPin, UserCircle, Star, Download, TrendingUp, Calendar, CheckCircle } from "lucide-react"
import { getRequests, getSurveys } from "@/lib/actions"
import { ProtectedRoute } from "@/components/protected-route"

interface Analytics {
  totalRequests: number
  approvedRequests: number
  pendingRequests: number
  rejectedRequests: number
  totalGuests: number
  frequentGuests: { name: string; count: number; organization: string }[]
  topOrganizations: { name: string; count: number }[]
  topDestinations: { name: string; count: number }[]
  topRequesters: { name: string; count: number }[]
  surveyStats: {
    totalSurveys: number
    averageRating: number
    ratingDistribution: { [key: number]: number }
  }
}

function DashboardContent() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    calculateAnalytics()
  }, [dateRange])

  const calculateAnalytics = async () => {
    const requests = await getRequests()
    const surveys = await getSurveys()

    const filteredRequests = requests
      .filter((r) => {
        const createdDate = new Date(r.createdAt)
        const fromDate = new Date(dateRange.from)
        const toDate = new Date(dateRange.to)
        return createdDate >= fromDate && createdDate <= toDate
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Calculate request stats
    const totalRequests = filteredRequests.length
    const approvedRequests = filteredRequests.filter(
      (r) => r.status === "approver2-approved" || r.status === "approver1-approved",
    ).length
    const pendingRequests = filteredRequests.filter(
      (r) =>
        r.status === "submitted" ||
        r.status === "approver1-pending" ||
        r.status === "approver2-pending" ||
        r.status === "approver1-approved",
    ).length
    const rejectedRequests = filteredRequests.filter(
      (r) => r.status === "approver1-rejected" || r.status === "approver2-rejected",
    ).length

    // Calculate guest stats
    const guestMap = new Map<string, { name: string; count: number; organization: string }>()
    filteredRequests.forEach((request) => {
      request.guests.forEach((guest) => {
        const key = `${guest.name}-${guest.organization}`
        if (guestMap.has(key)) {
          const existing = guestMap.get(key)!
          guestMap.set(key, { ...existing, count: existing.count + 1 })
        } else {
          guestMap.set(key, { name: guest.name, count: 1, organization: guest.organization })
        }
      })
    })
    const totalGuests = Array.from(guestMap.values()).reduce((sum, g) => sum + g.count, 0)
    const frequentGuests = Array.from(guestMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate organization stats
    const orgMap = new Map<string, number>()
    filteredRequests.forEach((request) => {
      request.guests.forEach((guest) => {
        orgMap.set(guest.organization, (orgMap.get(guest.organization) || 0) + 1)
      })
    })
    const topOrganizations = Array.from(orgMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate destination stats
    const destMap = new Map<string, number>()
    filteredRequests.forEach((request) => {
      destMap.set(request.destination, (destMap.get(request.destination) || 0) + 1)
    })
    const topDestinations = Array.from(destMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate requester stats
    const requesterMap = new Map<string, number>()
    filteredRequests.forEach((request) => {
      requesterMap.set(request.requestedBy, (requesterMap.get(request.requestedBy) || 0) + 1)
    })
    const topRequesters = Array.from(requesterMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate survey stats
    const totalSurveys = surveys.length
    const averageRating = totalSurveys > 0 ? surveys.reduce((sum, s) => sum + s.rating, 0) / totalSurveys : 0
    const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    surveys.forEach((survey) => {
      ratingDistribution[survey.rating] = (ratingDistribution[survey.rating] || 0) + 1
    })

    setAnalytics({
      totalRequests,
      approvedRequests,
      pendingRequests,
      rejectedRequests,
      totalGuests,
      frequentGuests,
      topOrganizations,
      topDestinations,
      topRequesters,
      surveyStats: {
        totalSurveys,
        averageRating,
        ratingDistribution,
      },
    })
  }

  const exportToCSV = async () => {
    if (!analytics) return

    const requests = await getRequests()
    const filteredRequests = requests.filter((r) => {
      const createdDate = new Date(r.createdAt)
      const fromDate = new Date(dateRange.from)
      const toDate = new Date(dateRange.to)
      return createdDate >= fromDate && createdDate <= toDate
    })

    // Create CSV content
    let csv =
      "Request ID,Requested By,Destination,Gate,From Date,To Date,Status,Guest Name,Organization,Check In,Check Out\n"

    filteredRequests.forEach((request) => {
      request.guests.forEach((guest) => {
        csv += `"${request.id}","${request.requestedBy}","${request.destination}","${request.gate}","${request.fromDate}","${request.toDate}","${request.status}","${guest.name}","${guest.organization}","${guest.checkInTime || ""}","${guest.checkOutTime || ""}"\n`
      })
    })

    // Download CSV
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `guest-report-${dateRange.from}-to-${dateRange.to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const exportSurveyReport = async () => {
    const surveys = await getSurveys()

    let csv = "Survey ID,Request ID,Guest ID,Rating,Comment,Submitted At\n"

    surveys.forEach((survey) => {
      csv += `"${survey.id}","${survey.requestId}","${survey.guestId}","${survey.rating}","${survey.comment.replace(/"/g, '""')}","${survey.submittedAt}"\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `survey-report-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (!analytics) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading analytics...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-cyan-600">Analytics Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline">
              <Download className="mr-2 size-4" />
              Export Requests
            </Button>
            <Button onClick={exportSurveyReport} variant="outline">
              <Download className="mr-2 size-4" />
              Export Surveys
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Calendar className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalRequests}</div>
              <p className="text-xs text-muted-foreground">In selected period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="size-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{analytics.approvedRequests}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.totalRequests > 0
                  ? Math.round((analytics.approvedRequests / analytics.totalRequests) * 100)
                  : 0}
                % approval rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <TrendingUp className="size-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{analytics.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalGuests}</div>
              <p className="text-xs text-muted-foreground">Across all requests</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Lists */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Frequent Guests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Frequent Guests
              </CardTitle>
              <CardDescription>Top 10 guests by visit count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.frequentGuests.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No data available</p>
                ) : (
                  analytics.frequentGuests.map((guest, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium text-gray-900">{guest.name}</p>
                        <p className="text-xs text-gray-500">{guest.organization}</p>
                      </div>
                      <Badge variant="secondary">{guest.count} visits</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Organizations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5" />
                Top Organizations
              </CardTitle>
              <CardDescription>By number of guests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topOrganizations.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No data available</p>
                ) : (
                  analytics.topOrganizations.map((org, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-2">
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <Badge variant="secondary">{org.count} guests</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Destinations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Top Destinations
              </CardTitle>
              <CardDescription>Most requested offices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topDestinations.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No data available</p>
                ) : (
                  analytics.topDestinations.map((dest, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-2">
                      <p className="font-medium text-gray-900">{dest.name}</p>
                      <Badge variant="secondary">{dest.count} requests</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Requesters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="size-5" />
                Top Requesters
              </CardTitle>
              <CardDescription>By number of requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topRequesters.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No data available</p>
                ) : (
                  analytics.topRequesters.map((requester, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-2">
                      <p className="font-medium text-gray-900">{requester.name}</p>
                      <Badge variant="secondary">{requester.count} requests</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Survey Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-5" />
              Survey Summary
            </CardTitle>
            <CardDescription>Guest feedback and ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total Surveys</span>
                  <span className="text-2xl font-bold">{analytics.surveyStats.totalSurveys}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Average Rating</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{analytics.surveyStats.averageRating.toFixed(1)}</span>
                    <Star className="size-5 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-gray-600">Rating Distribution</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="w-8 text-sm">{rating}★</span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full bg-yellow-400"
                          style={{
                            width: `${analytics.surveyStats.totalSurveys > 0 ? (analytics.surveyStats.ratingDistribution[rating] / analytics.surveyStats.totalSurveys) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm text-gray-600">
                        {analytics.surveyStats.ratingDistribution[rating]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "approver1", "approver2"]}>
      <DashboardContent />
    </ProtectedRoute>
  )
}
