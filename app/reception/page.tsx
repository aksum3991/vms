"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, UserCheck, CheckCircle2, Clock, Star, ChevronLeft, ChevronRight } from "lucide-react"
import { getRequests, checkInGuest, checkOutGuest, getRequestById, saveSurvey, getSettings, triggerCheckInNotification, triggerCheckOutNotification } from "@/lib/actions"
import type { Guest, Request, Settings } from "@/lib/types"
import ProtectedRoute from "@/components/protected-route"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

interface GuestWithRequest extends Guest {
  requestId: string
  requestedBy: string
  destination: string
  fromDate: string
  toDate: string
  gateNumber?: string
  approver1By?: string
  approvalNumber?: string
}

function ReceptionPageContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [allGuests, setAllGuests] = useState<GuestWithRequest[]>([])
  const [filteredGuests, setFilteredGuests] = useState<GuestWithRequest[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [viewingIdPhoto, setViewingIdPhoto] = useState<{ url: string; guestName: string } | null>(null)
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false)
  const [currentGuest, setCurrentGuest] = useState<GuestWithRequest | null>(null)
  const [surveyRating, setSurveyRating] = useState(0)
  const [surveyComment, setSurveyComment] = useState("")
  const [gateFilter, setGateFilter] = useState<string>("")
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showApprovalDetails, setShowApprovalDetails] = useState(false)
  const [selectedApprovalGuests, setSelectedApprovalGuests] = useState<GuestWithRequest[]>([])

  const loadGuests = async () => {
    try {
      const [allRequests, fetchedSettings] = await Promise.all([getRequests(), getSettings()])
      setSettings(fetchedSettings)
      // Collect all guests that have been approved by Approver 2 regardless of overall request status.
      // Previously we only included guests from requests where the whole request status was "approver2-approved".
      const guestList: GuestWithRequest[] = []

      allRequests.forEach((request) => {
        // Check if this request should be included based on gate access
        const isAdmin = user?.role === "admin"
        const hasGateAccess = user?.assignedGates && 
                              Array.isArray(user.assignedGates) && 
                              user.assignedGates.includes(request.gate)
        const shouldIncludeRequest = isAdmin || (user?.role === "reception" && hasGateAccess)

        if (!shouldIncludeRequest) return

        // Include any guest that has approver2Status === "approved"
        const approvedGuests = request.guests.filter(guest => guest.approver2Status === "approved")
        approvedGuests.forEach((guest) => {
          guestList.push({
            ...guest,
            requestId: request.id,
            requestedBy: request.requestedBy,
            destination: request.destination,
            fromDate: request.fromDate,
            toDate: request.toDate,
            gateNumber: request.gate,
            approver1By: request.approver1By,
            approvalNumber: request.approvalNumber,
          })
        })
      })

      guestList.sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime())
      setAllGuests(guestList)
      setFilteredGuests(guestList)
    } catch (error) {
      console.error("Error loading guests:", error)
    }
  }

  useEffect(() => {
    if (user) {
      loadGuests()
      // Refresh guests every 2 seconds to get latest approved guests
      const interval = setInterval(() => {
        loadGuests()
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    let filtered = allGuests
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(
        (guest) =>
          guest.name.toLowerCase().includes(term) ||
          guest.organization.toLowerCase().includes(term) ||
          guest.requestedBy.toLowerCase().includes(term) ||
          (guest.phone && guest.phone.toLowerCase().includes(term)) ||
          (guest.approvalNumber && guest.approvalNumber.toLowerCase().includes(term)),
      )
    }
    if (gateFilter) {
      filtered = filtered.filter((guest) => guest.gateNumber === gateFilter)
    }
    setFilteredGuests(filtered)
    setCurrentPage(1)
  }, [searchTerm, gateFilter, allGuests])

  const handleCheckIn = async (guestId: string, requestId: string) => {
    const request = await getRequestById(requestId)
    if (!request) return

    await checkInGuest(requestId, guestId)

    await triggerCheckInNotification(requestId, guestId)

    await loadGuests()
    toast({
      title: "Guest Checked In",
      description: "Guest checked in successfully! Notification sent to requester.",
    })
  }

  const handleCheckOut = async (guest: GuestWithRequest) => {
    setCurrentGuest(guest)
    setShowCheckoutDialog(true)
    setSurveyRating(0)
    setSurveyComment("")
  }

  const submitSurveyAndCheckout = async () => {
    if (!currentGuest) return

    if (surveyRating === 0) {
      toast({
        variant: "destructive",
        title: "Rating Required",
        description: "Please provide a rating before checking out.",
      })
      return
    }

    await saveSurvey({
      requestId: currentGuest.requestId,
      guestId: currentGuest.id,
      rating: surveyRating,
      comment: surveyComment,
    })

    await checkOutGuest(currentGuest.requestId, currentGuest.id)

    await triggerCheckOutNotification(currentGuest.requestId, currentGuest.id)

    setShowCheckoutDialog(false)
    setCurrentGuest(null)
    setSurveyRating(0)
    setSurveyComment("")
    await loadGuests()
    toast({
      title: "Guest Checked Out",
      description: "Guest checked out successfully! Thank you for the feedback.",
    })
  }

  const getStatusBadge = (guest: GuestWithRequest) => {
    if (guest.checkOutTime) {
      return <Badge className="bg-gray-100 text-gray-700">Checked Out</Badge>
    }
    if (guest.checkInTime) {
      return <Badge className="bg-green-100 text-green-700">Checked In</Badge>
    }
    return <Badge className="bg-blue-100 text-blue-700">Expected</Badge>
  }

  const handleApprovalClick = (approvalNumber: string | undefined) => {
    if (!approvalNumber) return
    const guests = allGuests.filter(guest => guest.approvalNumber === approvalNumber)
    setSelectedApprovalGuests(guests)
    setShowApprovalDetails(true)
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentGuests = filteredGuests.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredGuests.length / itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-cyan-600">Reception Desk</h1>
        </div>

        {/* Filters */}
        <Card className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-gray-400" />
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by approval number, guest name, or phone..."
                  className="pl-9"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Search by approval number, guest name, organization, or phone number
              </p>
            </div>
            {(user?.role === "admin" || (user?.assignedGates && user.assignedGates.length > 0)) && (
              <div>
                <Label htmlFor="gate-select">Gate</Label>
                <Select
                  value={gateFilter || "all"}
                  onValueChange={(v) => {
                    setGateFilter(v === "all" ? "" : v)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger id="gate-select" className="mt-2">
                    <SelectValue placeholder="All gates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All gates</SelectItem>
                    {((user?.role === "admin" ? (settings?.gates || []) : (user?.assignedGates || [])) as string[]).map(
                      (gate) => (
                        <SelectItem key={gate} value={gate}>
                          {gate}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-gray-500">Filter guests by gate number</p>
              </div>
            )}
          </div>
        </Card>

        {/* Guest List */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Guest List ({filteredGuests.length} {filteredGuests.length === 1 ? "guest" : "guests"})
          </h2>

          {filteredGuests.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              {searchTerm
                ? "No guests found matching your search criteria"
                : "No guests found for the selected criteria"}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b bg-gray-50">
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Approval #
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Guest Name
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Organization
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">Phone</TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Requested By
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">Approver</TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Destination
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">Gate</TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                        Visiting Schedule
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                        ID Photo
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">Devices</TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                        Check In Time
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                        Check Out Time
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-sm font-medium text-gray-600">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentGuests.map((guest) => (
                      <TableRow key={`${guest.requestId}-${guest.id}`} className="border-b hover:bg-gray-50">
                        <TableCell className="px-4 py-3">
                          {guest.approvalNumber ? (
                            <button
                              onClick={() => handleApprovalClick(guest.approvalNumber)}
                              className="font-mono text-xs text-green-600 hover:underline cursor-pointer"
                            >
                              {guest.approvalNumber}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <p className="font-medium text-gray-900">{guest.name}</p>
                          {guest.email && <p className="text-xs text-gray-500">{guest.email}</p>}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">{guest.organization}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">{guest.phone || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">{guest.requestedBy}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">{guest.approver1By || "-"}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">{guest.destination}</TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <Badge variant="outline" className="font-mono">
                            {guest.gateNumber}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm text-gray-700">
                          <div className="text-xs">
                            <div className="font-medium">From: {new Date(guest.fromDate).toLocaleDateString()}</div>
                            <div className="font-medium mt-1">To: {new Date(guest.toDate).toLocaleDateString()}</div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          {guest.idPhotoUrl ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewingIdPhoto({ url: guest.idPhotoUrl!, guestName: guest.name })}
                            >
                              <UserCheck className="size-4 text-blue-600" />
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">No ID</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            {guest.laptop && (
                              <Badge variant="secondary" className="text-xs">
                                L
                              </Badge>
                            )}
                            {guest.mobile && (
                              <Badge variant="secondary" className="text-xs">
                                M
                              </Badge>
                            )}
                            {guest.flash && (
                              <Badge variant="secondary" className="text-xs">
                                F
                              </Badge>
                            )}
                            {guest.otherDevice && (
                              <Badge variant="secondary" className="text-xs">
                                O
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">{getStatusBadge(guest)}</TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm text-gray-700">
                          {guest.checkInTime ? (
                            <div className="text-xs">
                              <div>{new Date(guest.checkInTime).toLocaleDateString()}</div>
                              <div className="text-gray-500">{new Date(guest.checkInTime).toLocaleTimeString()}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm text-gray-700">
                          {guest.checkOutTime ? (
                            <div className="text-xs">
                              <div>{new Date(guest.checkOutTime).toLocaleDateString()}</div>
                              <div className="text-gray-500">{new Date(guest.checkOutTime).toLocaleTimeString()}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            {!guest.checkInTime && (
                              <Button
                                size="sm"
                                onClick={() => handleCheckIn(guest.id, guest.requestId)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <UserCheck className="mr-1 size-3" />
                                Check In
                              </Button>
                            )}
                            {guest.checkInTime && !guest.checkOutTime && (
                              <Button size="sm" onClick={() => handleCheckOut(guest)} variant="outline">
                                <Clock className="mr-1 size-3" />
                                Check Out
                              </Button>
                            )}
                            {guest.checkOutTime && (
                              <span className="flex items-center text-sm text-gray-500">
                                <CheckCircle2 className="mr-1 size-4" />
                                Complete
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t pt-4 gap-4">
                  <div className="text-sm text-gray-600">
                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredGuests.length)} of{" "}
                    {filteredGuests.length} guests
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="size-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
                        const page = i + 1 + (currentPage > 2 ? currentPage - 2 : 0)
                        if (page > totalPages) return null
                        return (
                          <Button
                            key={page}
                            size="sm"
                            variant={currentPage === page ? "default" : "outline"}
                            onClick={() => setCurrentPage(page)}
                            className="min-w-[40px]"
                          >
                            {page}
                          </Button>
                        )
                      })}
                      {totalPages > 3 && <span className="px-2">...</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        <Dialog open={!!viewingIdPhoto} onOpenChange={() => setViewingIdPhoto(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>ID Photo - {viewingIdPhoto?.guestName}</DialogTitle>
            </DialogHeader>
            {viewingIdPhoto && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
                <img src={viewingIdPhoto.url || "/placeholder.svg"} alt={`ID photo for ${viewingIdPhoto.guestName}`} />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showCheckoutDialog} onOpenChange={() => setShowCheckoutDialog(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Guest Checkout Survey</DialogTitle>
            </DialogHeader>
            {currentGuest && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Guest: {currentGuest.name}</p>
                  <p className="text-sm text-gray-600">Organization: {currentGuest.organization}</p>
                </div>

                <div>
                  <Label className="mb-2 block">How would you rate your visit?</Label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setSurveyRating(rating)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`size-8 ${surveyRating >= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="survey-comment">Comments (Optional)</Label>
                  <Input
                    id="survey-comment"
                    value={surveyComment}
                    onChange={(e) => setSurveyComment(e.target.value)}
                    placeholder="Please share your feedback..."
                    className="mt-2"
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={submitSurveyAndCheckout} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    Submit & Check Out
                  </Button>
                  <Button onClick={() => setShowCheckoutDialog(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showApprovalDetails} onOpenChange={() => setShowApprovalDetails(false)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Approval Details - {selectedApprovalGuests[0]?.approvalNumber}</DialogTitle>
            </DialogHeader>
            {selectedApprovalGuests.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium text-gray-900">Request Details</h4>
                    <p className="text-sm text-gray-600">Requested By: {selectedApprovalGuests[0].requestedBy}</p>
                    <p className="text-sm text-gray-600">Approver: {selectedApprovalGuests[0].approver1By}</p>
                    <p className="text-sm text-gray-600">Destination: {selectedApprovalGuests[0].destination}</p>
                    <p className="text-sm text-gray-600">Gate: {selectedApprovalGuests[0].gateNumber}</p>
                    <p className="text-sm text-gray-600">From: {new Date(selectedApprovalGuests[0].fromDate).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-600">To: {new Date(selectedApprovalGuests[0].toDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Guests ({selectedApprovalGuests.length})</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedApprovalGuests.map((guest) => (
                        <div key={guest.id} className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-gray-900">{guest.name}</p>
                          <p className="text-sm text-gray-600">{guest.organization}</p>
                          <p className="text-sm text-gray-600">{guest.email}</p>
                          <p className="text-sm text-gray-600">{guest.phone}</p>
                          <div className="flex gap-1 mt-1">
                            {guest.laptop && <Badge variant="secondary" className="text-xs">Laptop</Badge>}
                            {guest.mobile && <Badge variant="secondary" className="text-xs">Mobile</Badge>}
                            {guest.flash && <Badge variant="secondary" className="text-xs">Flash</Badge>}
                            {guest.otherDevice && <Badge variant="secondary" className="text-xs">Other</Badge>}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Status: {getStatusBadge(guest)}</p>
                          <div className="flex gap-2 mt-2">
                            {!guest.checkInTime && (
                              <Button
                                size="sm"
                                onClick={() => handleCheckIn(guest.id, guest.requestId)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <UserCheck className="mr-1 size-3" />
                                Check In
                              </Button>
                            )}
                            {guest.checkInTime && !guest.checkOutTime && (
                              <Button size="sm" onClick={() => handleCheckOut(guest)} variant="outline">
                                <Clock className="mr-1 size-3" />
                                Check Out
                              </Button>
                            )}
                            {guest.checkOutTime && (
                              <span className="flex items-center text-sm text-gray-500">
                                <CheckCircle2 className="mr-1 size-4" />
                                Complete
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function ReceptionPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "reception"]}>
      <div className="min-h-screen w-full bg-gray-50">
        <ReceptionPageContent />
      </div>
    </ProtectedRoute>
  )
}
