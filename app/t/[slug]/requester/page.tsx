"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, Calendar, AlertTriangle } from "lucide-react"
import type { Request } from "@/lib/types"
import { getRequests } from "@/lib/actions"
import { updateRequestSchedule, withdrawRequest } from "@/lib/request-actions"
import { useAuth } from "@/lib/auth"
import { ProtectedRoute } from "@/components/protected-route"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/dialog"
import { useToast } from "@/components/ui/use-toast"
import { useServerErrorHandler } from "@/lib/auth-client"

// Helper to convert ISO string to datetime-local value
function toDateTimeLocal(isoString: string): string {
  if (!isoString) return ""
  const date = new Date(isoString)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

function RequesterContent() {
  const params = useParams()
  const slug = params?.slug as string

  const { user } = useAuth()
  const { toast } = useToast()
  const handleError = useServerErrorHandler()
  const [requests, setRequests] = useState<Request[]>([])
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)

  // Edit Schedule State
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false)
  const [editForm, setEditForm] = useState({ id: "", fromDate: "", toDate: "" })
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  // Withdraw State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState("")
  const [requestToWithdraw, setRequestToWithdraw] = useState<Request | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadRequests = async () => {
    if (!user) return

    const allRequests = await getRequests(slug)
    // Filter requests by current logged-in user
    const userRequests = allRequests
      .filter((r) => r.requestedById === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setRequests(userRequests)
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRequests)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRequests(newExpanded)
  }

  const handleView = (request: Request) => {
    setSelectedRequest(request)
  }

  // --- Schedule Update Handlers ---

  const openEditSchedule = (request: Request) => {
    setEditForm({
      id: request.id,
      fromDate: toDateTimeLocal(request.fromDate),
      toDate: toDateTimeLocal(request.toDate)
    })
    setIsEditScheduleOpen(true)
  }

  const handleUpdateSchedule = async () => {
    setIsSavingSchedule(true)
    
    // Convert local datetime back to UTC ISO for server
    const fromDateISO = new Date(editForm.fromDate).toISOString()
    const toDateISO = new Date(editForm.toDate).toISOString()

    const result = await updateRequestSchedule(editForm.id, fromDateISO, toDateISO)
    
    setIsSavingSchedule(false)

    if (result.success) {
      toast({ title: "Schedule Updated", description: "The visit schedule has been updated successfully." })
      setIsEditScheduleOpen(false)
      loadRequests() // Refresh list
    } else {
      // Use explicit feedback for domain errors
      if (result.error?.toLowerCase().includes("unauthorized")) {
        handleError(result)
      } else {
        toast({ 
          variant: "destructive", 
          title: "Cannot update schedule", 
          description: result.error || "An unexpected error occurred." 
        })
      }
    }
  }

  // --- Withdrawal Handlers ---

  const openWithdraw = (request: Request) => {
    setRequestToWithdraw(request)
    setWithdrawReason("")
    setIsWithdrawOpen(true)
  }

  const handleWithdraw = async () => {
    if (!requestToWithdraw) return
    
    // Validation: Enforce reason
    if (!withdrawReason.trim()) {
      toast({ 
        variant: "destructive", 
        title: "Reason required", 
        description: "Please enter a reason for withdrawal." 
      })
      return
    }

    setIsWithdrawing(true)

    const result = await withdrawRequest(requestToWithdraw.id, withdrawReason.trim())
    
    setIsWithdrawing(false)

    if (result.success) {
      toast({ title: "Request Withdrawn", description: "The request has been withdrawn successfully." })
      setIsWithdrawOpen(false)
      loadRequests() // Refresh list
    } else {
       // Use explicit feedback for domain errors
       if (result.error?.toLowerCase().includes("unauthorized")) {
        handleError(result)
      } else {
        toast({ 
          variant: "destructive", 
          title: "Cannot withdraw request", 
          description: result.error || "An unexpected error occurred." 
        })
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-700">Submitted</Badge>
      case "approver1-pending":
        return <Badge className="bg-yellow-100 text-yellow-700">Approver 1 - Pending</Badge>
      case "approver1-approved":
        return <Badge className="bg-green-100 text-green-700">Approver 1 - Approved</Badge>
      case "approver1-rejected":
        return <Badge className="bg-red-100 text-red-700">Approver 1 - Rejected</Badge>
      case "approver2-pending":
        return <Badge className="bg-yellow-100 text-yellow-700">Approver 2 - Pending</Badge>
      case "approver2-approved":
        return <Badge className="bg-green-100 text-green-700">Final Approved</Badge>
      case "approver2-rejected":
        return <Badge className="bg-red-100 text-red-700">Approver 2 - Rejected</Badge>
      case "withdrawn":
        return <Badge className="bg-gray-200 text-gray-600">Withdrawn</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>
    }
  }

  const getGuestStatus = (requestStatus: string, approvalNumber?: string) => {
    if (requestStatus === "withdrawn") return "Withdrawn"
    switch (requestStatus) {
      case "submitted":
      case "approver1-pending":
        return "Requested"
      case "approver1-approved":
        return "Approved 1"
      case "approver2-approved":
        return `Final Approved (${approvalNumber})`
      case "approver1-rejected":
      case "approver2-rejected":
        return "Rejected"
      default:
        return "Unknown"
    }
  }

  const getGuestStatusBadge = (status: string) => {
    switch (status) {
      case "Requested":
        return <Badge className="bg-blue-100 text-blue-700">Requested</Badge>
      case "Approved 1":
        return <Badge className="bg-green-100 text-green-700">Approved 1</Badge>
      case "Rejected":
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>
      case "Withdrawn":
        return <Badge className="bg-gray-200 text-gray-600">Withdrawn</Badge>
      default:
        if (status.startsWith("Final Approved")) {
          return <Badge className="bg-green-100 text-green-700">{status}</Badge>
        }
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>
    }
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentRequests = requests.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(requests.length / itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-cyan-600">My Requests</h1>
          <Button onClick={() => (window.location.href = `/t/${slug}`)}>New Request</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
          {requests.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center animate-in fade-in-50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No requests found</h3>
              <p className="mt-2 text-sm text-gray-500">
                You haven&apos;t made any visit requests yet. Create one to get started.
              </p>
              <Button className="mt-6" onClick={() => (window.location.href = `/t/${slug}`)}>
                Create New Request
              </Button>
            </div>
          ) : (
            currentRequests.map((request) => (
              <Card
                key={request.id}
                className={`flex flex-col border p-4 transition-all hover:shadow-md cursor-pointer ${
                  selectedRequest?.id === request.id ? 'border-primary bg-primary/5' : 'bg-white'
                }`}
                onClick={() => handleView(request)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{request.destination}</h3>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    {request.approvalNumber && (
                      <p className="mt-1 text-xs font-mono font-bold text-green-600 px-1.5 py-0.5 bg-green-50 rounded w-fit">
                        {request.approvalNumber}
                      </p>
                    )}
                    
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <p className="flex items-center gap-2">
                        <span className="font-medium text-gray-500 text-xs uppercase tracking-wider">Gate</span>
                        {request.gate}
                      </p>
                      <p className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-gray-400" />
                        <span className="text-xs">
                          {new Date(request.fromDate).toLocaleDateString()} - {new Date(request.toDate).toLocaleDateString()}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                         <Users className="size-3.5 text-gray-400" />
                         <span className="text-xs">{request.guests.length} guest(s)</span>
                      </p>
                    </div>

                    {expandedRequests.has(request.id) && (
                      <div className="mt-3 space-y-2 border-t pt-3 animate-in slide-in-from-top-2">
                        <p className="text-xs font-semibold text-gray-700">Guest List:</p>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {request.guests.map((guest, index) => (
                            <div key={guest.id} className="rounded bg-gray-50 p-2 text-sm border">
                              <p className="font-medium text-xs">
                                {index + 1}. {guest.name}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate">{guest.organization}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 w-[90px]" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs justify-start px-2 bg-white w-full" 
                      onClick={() => handleView(request)}
                    >
                      <Eye className="size-3.5 mr-1" /> Details
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs justify-start px-2 text-gray-500 w-full" 
                      onClick={() => toggleExpand(request.id)}
                    >
                      {expandedRequests.has(request.id) ? (
                        <><ChevronUp className="size-3.5 mr-1" /> Hide</>
                      ) : (
                        <><ChevronDown className="size-3.5 mr-1" /> Guests</>
                      )}
                    </Button>

                     {/* Edit Schedule Button */}
                    {request.status !== "approver2-approved" && request.status !== "withdrawn" && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-7 text-xs justify-start px-2 text-gray-500 hover:text-amber-600 w-full"
                        onClick={() => openEditSchedule(request)}
                      >
                        <Calendar className="size-3.5 mr-1" /> Edit
                      </Button>
                    )}

                    {/* Withdraw Button */}
                    {request.status === "approver2-approved" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-xs justify-start px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 w-full"
                        onClick={() => openWithdraw(request)}
                      >
                        <AlertTriangle className="size-3.5 mr-1" /> Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="mr-1 size-4" /> Previous
            </Button>
            <span className="text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        )}

        {/* Request Details Dialog */}
        <Dialog open={selectedRequest !== null} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl overflow-hidden p-0">
             <div className="bg-primary/5 p-6 pb-4 border-b">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-xl">Request Details</DialogTitle>
                    {selectedRequest && getStatusBadge(selectedRequest.status)}
                  </div>
                  <DialogDescription>
                    ID: <span className="font-mono text-xs">{selectedRequest?.id}</span>
                  </DialogDescription>
                </DialogHeader>
             </div>
             
            {selectedRequest && (
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Approval Banner */}
                {selectedRequest.approvalNumber && (
                   <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Approval Number</p>
                        <p className="font-mono text-2xl font-bold">{selectedRequest.approvalNumber}</p>
                      </div>
                      <div className="rounded-full bg-green-200 p-2">
                        <Users className="size-6 text-green-700" />
                      </div>
                   </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                     <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Destination</Label>
                        <p className="font-medium text-gray-900">{selectedRequest.destination}</p>
                     </div>
                     <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gate</Label>
                        <p className="font-medium text-gray-900">{selectedRequest.gate}</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">From</Label>
                        <p className="font-medium text-gray-900">{new Date(selectedRequest.fromDate).toLocaleString()}</p>
                     </div>
                     <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">To</Label>
                        <p className="font-medium text-gray-900">{new Date(selectedRequest.toDate).toLocaleString()}</p>
                     </div>
                  </div>
                </div>

                <div>
                   <Label className="text-xs text-muted-foreground uppercase tracking-wider">Purpose</Label>
                   <div className="mt-1 rounded-md bg-gray-50 p-3 text-sm text-gray-700 border">
                      {selectedRequest.purpose}
                   </div>
                </div>

                <div>
                   <Label className="mb-2 block text-xs text-muted-foreground uppercase tracking-wider">
                      Guest List ({selectedRequest.guests.length})
                   </Label>
                   <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedRequest.guests.map((guest) => (
                            <TableRow key={guest.id}>
                              <TableCell className="font-medium">{guest.name}</TableCell>
                              <TableCell>{guest.organization}</TableCell>
                              <TableCell>
                                {getGuestStatusBadge(getGuestStatus(selectedRequest.status, selectedRequest.approvalNumber))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                   </div>
                </div>

                {/* Comments Section */}
                {(selectedRequest.approver1Comment || selectedRequest.approver2Comment) && (
                   <div className="space-y-3 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-gray-900">Approver Comments</h4>
                      {selectedRequest.approver1Comment && (
                        <div className="flex gap-3 text-sm">
                           <div className="shrink-0 w-1 bg-blue-400 rounded-full my-1"></div>
                           <div>
                              <p className="text-xs font-medium text-blue-600">Approver 1</p>
                              <p className="text-gray-700">{selectedRequest.approver1Comment}</p>
                           </div>
                        </div>
                      )}
                      {selectedRequest.approver2Comment && (
                        <div className="flex gap-3 text-sm">
                           <div className="shrink-0 w-1 bg-purple-400 rounded-full my-1"></div>
                           <div>
                              <p className="text-xs font-medium text-purple-600">Approver 2</p>
                              <p className="text-gray-700">{selectedRequest.approver2Comment}</p>
                           </div>
                        </div>
                      )}
                   </div>
                )}
              </div>
            )}
            <DialogFooter className="bg-gray-50 p-4 border-t">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close Details</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Schedule Dialog */}
        <Dialog open={isEditScheduleOpen} onOpenChange={setIsEditScheduleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Visit Schedule</DialogTitle>
              <DialogDescription>
                Update the &apos;From Date&apos; and &apos;To Date&apos; for the request.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fromDate" className="text-right">
                  From Date
                </Label>
                <Input
                  id="fromDate"
                  type="datetime-local"
                  value={editForm.fromDate}
                  onChange={(e) => setEditForm({ ...editForm, fromDate: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="toDate" className="text-right">
                  To Date
                </Label>
                <Input
                  id="toDate"
                  type="datetime-local"
                  value={editForm.toDate}
                  onChange={(e) => setEditForm({ ...editForm, toDate: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditScheduleOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateSchedule} disabled={isSavingSchedule}>
                {isSavingSchedule ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Withdraw Request Dialog */}
        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to withdraw this request? Please provide a reason.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label htmlFor="withdrawReason">Reason for withdrawal:</Label>
              <Textarea
                id="withdrawReason"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="e.g., Change of plans, incorrect details"
              />
              <p className="text-xs text-muted-foreground text-right">
                {withdrawReason.length} characters (Reason required)
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleWithdraw} 
                disabled={isWithdrawing || !withdrawReason.trim()}
              >
                {isWithdrawing ? "Withdrawing..." : "Withdraw Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function RequesterPage() {
  return (
    <ProtectedRoute allowedRoles={["requester", "admin"]}>
      <RequesterContent />
    </ProtectedRoute>
  )
}
