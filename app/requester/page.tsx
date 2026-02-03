"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users } from "lucide-react"
import type { Request } from "@/lib/types"
import { getRequests } from "@/lib/actions"
import { useAuth } from "@/lib/auth"
import { ProtectedRoute } from "@/components/protected-route"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

function RequesterContent() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  useEffect(() => {
    loadRequests()
  }, [user])

  const loadRequests = async () => {
    if (!user) return

    const allRequests = await getRequests()
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
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>
    }
  }

  const getGuestStatus = (requestStatus: string, approvalNumber?: string) => {
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
        <h1 className="mb-6 text-3xl font-bold text-cyan-600">My Requests</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Request List */}
          <div>
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Request History</h2>
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No requests found</p>
                ) : (
                  <>
                    {currentRequests.map((request) => (
                      <Card
                        key={request.id}
                        className={`border p-4 transition-colors ${selectedRequest?.id === request.id ? 'border-cyan-500 bg-cyan-50' : 'bg-white'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{request.destination}</h3>
                              {getStatusBadge(request.status)}
                            </div>
                            {request.approvalNumber && (
                              <p className="mt-1 text-xs font-mono text-green-600">
                                Approval: {request.approvalNumber}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-gray-600">
                              Gate: <span className="font-medium">{request.gate}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              {request.fromDate} to {request.toDate}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                              <Users className="size-4" />
                              {request.guests.length} guest(s)
                            </p>

                            {expandedRequests.has(request.id) && (
                              <div className="mt-3 space-y-2 border-t pt-3">
                                <p className="text-xs font-medium text-gray-700">Guests:</p>
                                {request.guests.map((guest, index) => (
                                  <div key={guest.id} className="rounded bg-gray-50 p-2 text-sm">
                                    <p className="font-medium">
                                      {index + 1}. {guest.name}
                                    </p>
                                    <p className="text-xs text-gray-600">{guest.organization}</p>
                                    {guest.email && <p className="text-xs text-gray-500">Email: {guest.email}</p>}
                                    {guest.phone && <p className="text-xs text-gray-500">Phone: {guest.phone}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="ml-4 flex flex-col gap-2">
                            <Button size="sm" variant="outline" onClick={() => toggleExpand(request.id)}>
                              {expandedRequests.has(request.id) ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleView(request)}>
                              <Eye className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between border-t pt-4">
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
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Request Details */}
          <div>
            {selectedRequest ? (
              <Card className="sticky top-6 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Request Details</h2>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(null)}>
                    Close
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-600">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                  </div>

                  {selectedRequest.approvalNumber && (
                    <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
                      <Label className="text-sm text-gray-600">Approval Number</Label>
                      <p className="mt-1 font-mono text-lg font-bold text-green-700">
                        {selectedRequest.approvalNumber}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm text-gray-600">Requested By</Label>
                    <p className="mt-1 font-medium">{selectedRequest.requestedBy}</p>
                    {selectedRequest.requestedByEmail && (
                      <p className="text-sm text-gray-500">{selectedRequest.requestedByEmail}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Destination</Label>
                    <p className="mt-1 font-medium">{selectedRequest.destination}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Gate</Label>
                    <p className="mt-1 font-medium">{selectedRequest.gate}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Date Range</Label>
                    <p className="mt-1 font-medium">
                      {selectedRequest.fromDate} to {selectedRequest.toDate}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Purpose</Label>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">{selectedRequest.purpose}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Guest List ({selectedRequest.guests.length})</Label>
                    <div className="mt-2 overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedRequest.guests.map((guest) => (
                            <TableRow key={guest.id}>
                              <TableCell className="font-medium">{guest.name}</TableCell>
                              <TableCell>{guest.organization}</TableCell>
                              <TableCell>{guest.email || '-'}</TableCell>
                              <TableCell>{guest.phone || '-'}</TableCell>
                              <TableCell>
                                {getGuestStatusBadge(getGuestStatus(selectedRequest.status, selectedRequest.approvalNumber))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {selectedRequest.approver1Comment && (
                    <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-3">
                      <Label className="text-sm text-gray-600">Approver 1 Comment</Label>
                      <p className="mt-1 text-sm text-gray-700">{selectedRequest.approver1Comment}</p>
                    </div>
                  )}

                  {selectedRequest.approver2Comment && (
                    <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-3">
                      <Label className="text-sm text-gray-600">Approver 2 Comment</Label>
                      <p className="mt-1 text-sm text-gray-700">{selectedRequest.approver2Comment}</p>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="flex h-64 items-center justify-center p-6">
                <p className="text-center text-gray-500">Select a request to view details</p>
              </Card>
            )}
          </div>
        </div>
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
