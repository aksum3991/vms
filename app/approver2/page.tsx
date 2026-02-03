
"use client"

import { useState, useEffect, Fragment } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, X, Edit, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, User, Ban, ListFilter, Clock, CheckCircle } from "lucide-react"
import type { Request, Guest, Settings } from "@/lib/types"
import { getRequests, getSettings, saveRequest, saveNotification, saveBlacklistEntry, triggerApprovalNotifications } from "@/lib/actions"
import { ProtectedRoute } from "@/components/protected-route"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"

function generateApprovalNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `APV-${timestamp}-${random}`
}
export default function Approver2Page() {
  return (
    <ProtectedRoute allowedRoles={["admin", "approver2"]}>
      <Approver2PageContent />
    </ProtectedRoute>
  )
}

function Approver2PageContent() {
  const [requests, setRequests] = useState<Request[]>([])
  const [allRequests, setAllRequests] = useState<Request[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const { toast } = useToast()
  const [viewingIdPhoto, setViewingIdPhoto] = useState<{ url: string; guestName: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending")

  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editedRequest, setEditedRequest] = useState<Partial<Request> & { guests: Partial<Guest>[] } | null>(null)
  const [rowComments, setRowComments] = useState<Record<string, string>>({})
  const [selectedGuests, setSelectedGuests] = useState<Record<string, string[]>>({})
  const [pendingAction, setPendingAction] = useState<null | { type: 'approve' | 'reject' | 'blacklist'; requestId: string }>(null)
  const [pendingActionComment, setPendingActionComment] = useState<string>('')

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      loadData()
    }, 2000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    setRequests(buildRequestsForFilter(allRequests, statusFilter))
    setCurrentPage(1)
  }, [statusFilter, allRequests])

  const loadData = async () => {
    const [fetchedRequests, fetchedSettings] = await Promise.all([getRequests(), getSettings()])
    setAllRequests(fetchedRequests)
    setRequests(buildRequestsForFilter(fetchedRequests, statusFilter))
    setSettings(fetchedSettings)
  }

  function buildRequestsForFilter(base: Request[], filter: "pending" | "approved" | "rejected" | "all"): Request[] {
    const list =
      filter === "pending"
        ? base.filter(
            (r) =>
              r.status === "approver2-pending" &&
              r.guests.some((g) => 
                (g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted") &&
                !g.approver2Status
              ),
          )
        : filter === "approved"
          ? base.filter((r) => r.status === "approver2-approved")
          : filter === "rejected"
            ? base.filter((r) => r.status === "approver2-rejected")
            : base.filter(
                (r) =>
                  r.status === "approver2-pending" ||
                  r.status === "approver2-approved" ||
                  r.status === "approver2-rejected",
              )
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRequests)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRequests(newExpanded)
    if (editingRowId === id) {
      setEditingRowId(null)
      setEditedRequest(null)
    }
  }
  
  const getGuestStatusBadge = (status?: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>
      case "blacklisted":
        return <Badge className="bg-orange-100 text-orange-700">Blacklisted</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
    }
  }

  const matchSearch = (r: Request) => {
    const t = searchTerm.trim().toLowerCase()
    if (!t) return true
    return (
      r.requestedBy.toLowerCase().includes(t) ||
      r.destination.toLowerCase().includes(t) ||
      r.gate.toLowerCase().includes(t) ||
      (r.approvalNumber ? r.approvalNumber.toLowerCase().includes(t) : false) ||
      r.guests.some(g => g.name.toLowerCase().includes(t) || g.organization.toLowerCase().includes(t))
    )
  }

  const filteredRequests = requests.filter((r) => matchSearch(r))
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentRequests = filteredRequests.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage)

  const startRowEdit = (request: Request) => {
    setEditingRowId(request.id)
    setEditedRequest({ ...request, guests: [...request.guests] })
    if (!expandedRequests.has(request.id)) {
      toggleExpand(request.id)
    }
  }
  
  const updateEditedField = (field: keyof Request, value: string) => {
    if (editedRequest) {
      setEditedRequest(prev => ({ ...prev!, [field]: value }))
    }
  }
  
  const updateEditedGuest = (index: number, field: keyof Guest, value: any) => {
    if (editedRequest) {
      const updatedGuests = [...editedRequest.guests];
      updatedGuests[index] = { ...updatedGuests[index], [field]: value };
      setEditedRequest(prev => ({ ...prev!, guests: updatedGuests }));
    }
  };

  const saveRowEdit = async () => {
    if (!editedRequest || !editingRowId) return;
    
    const originalRequest = requests.find(r => r.id === editingRowId);
    if (!originalRequest) return;
    
    const requestToSave = {
      ...originalRequest,
      ...editedRequest,
      guests: editedRequest.guests.map((guest, index) => ({
        ...originalRequest.guests[index],
        ...guest
      })),
      updatedAt: new Date().toISOString(),
    } as Request;

    await saveRequest(requestToSave)
    await loadData()
    setEditingRowId(null)
    setEditedRequest(null)
    toast({ title: "Row Updated", description: "Request details updated." })
  }

  const cancelRowEdit = () => {
    setEditingRowId(null)
    setEditedRequest(null)
  }

  const handleSelectGuest = (requestId: string, guestId: string, checked: boolean) => {
    setSelectedGuests(prev => {
      const currentSelected = prev[requestId] || []
      if (checked) {
        return { ...prev, [requestId]: [...currentSelected, guestId] }
      } else {
        return { ...prev, [requestId]: currentSelected.filter(id => id !== guestId) }
      }
    })
  }

  const handleSelectAllGuests = (requestId: string, guests: Guest[], checked: boolean) => {
    const unprocessedGuests = guests.filter(g => 
      (g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted") && 
      !g.approver2Status
    ) // Select unprocessed guests that have been processed by Approver 1 (approved, rejected, or blacklisted)
    if (checked) {
      setSelectedGuests(prev => ({ ...prev, [requestId]: unprocessedGuests.map(g => g.id) }))
    } else {
      setSelectedGuests(prev => {
        const copy = { ...prev }
        delete copy[requestId]
        return copy
      })
    }
  }

  const isGuestSelected = (requestId: string, guestId: string) => {
    return selectedGuests[requestId]?.includes(guestId) || false
  }

  const areAllGuestsSelected = (requestId: string, guests: Guest[]) => {
    const selected = selectedGuests[requestId] || []
    const unprocessedGuests = guests.filter(g => 
      (g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted") && 
      !g.approver2Status
    ) // Count unprocessed guests that have been processed by Approver 1 (approved, rejected, or blacklisted)
    return unprocessedGuests.length > 0 && selected.length === unprocessedGuests.length
  }

  const approveRow = async (request: Request, commentOverride?: string) => {
    const selectedIds = selectedGuests[request.id] || []
    if (selectedIds.length === 0) return

    // 1. Update guests
    const updatedGuests = request.guests.map(g => {
      if (selectedIds.includes(g.id)) {
        return { ...g, approver2Status: "approved" as const, approver2Comment: (commentOverride ?? rowComments[request.id] ?? "").trim() || undefined }
      }
      return g
    })

    // 2. Check overall status
    const areAllProcessed = updatedGuests.every(g => 
        g.approver2Status === "approved" || 
        g.approver2Status === "rejected" || 
        g.approver2Status === "blacklisted" ||
        !(g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted") // Guests not processed by Approver 1 don't count
    )

    let requestUpdate: Partial<Request> = {
        guests: updatedGuests,
        updatedAt: new Date().toISOString(),
    }

    let notificationToSend: { type: string, message: string } | null = null
    let wasFullyApproved = false

    if (areAllProcessed) {
        // Calculate final request status
        const hasApprovedGuests = updatedGuests.some(g => g.approver2Status === "approved")
        
        if (hasApprovedGuests) {
            const approvalNumber = request.approvalNumber || generateApprovalNumber()
            wasFullyApproved = true
            
            requestUpdate = {
                ...requestUpdate,
                status: "approver2-approved",
                approvalNumber,
                approver2Comment: (commentOverride ?? rowComments[request.id] ?? "").trim() || "",
                approver2Date: new Date().toISOString(),
                approver2By: "Approver 2",
            }

            notificationToSend = {
                type: "request_approved",
                message: `Your request for ${request.destination} has been fully approved! Approval Number: ${approvalNumber}`
            }
        } else {
            // All guests rejected/blacklisted -> Request Rejected
            requestUpdate = {
                ...requestUpdate,
                status: "approver2-rejected",
                approver2Comment: rowComments[request.id] || "All guests rejected",
                approver2Date: new Date().toISOString(),
                approver2By: "Approver 2",
            }
            
            notificationToSend = {
                type: "request_rejected",
                message: `Your request for ${request.destination} has been rejected by Approver 2.`
            }
        }
    } else {
        // Not all processed -> Request stays in pending
        if (request.status === 'approver1-approved') {
            requestUpdate.status = "approver2-pending"
        }
    }

    const updated = { ...request, ...requestUpdate } as Request
    
    await saveRequest(updated)

    if (notificationToSend) {
        await saveNotification({
            userId: request.requestedById,
            type: notificationToSend.type as any,
            message: notificationToSend.message,
            requestId: request.id,
            read: false,
        })
        if (wasFullyApproved) {
            await triggerApprovalNotifications(updated)
        }
    }

    // Reload data to get fresh state from database
    await loadData()
    
    setSelectedGuests(prev => {
        const copy = { ...prev }
        delete copy[request.id]
        return copy
    })
    toast({ 
      variant: "success",
      title: "Guests Approved", 
      description: `${selectedIds.length} guest(s) approved${wasFullyApproved ? '. Request fully approved and sent to Reception!' : '.'}` 
    })
  }

  const rejectRow = async (request: Request, commentOverride?: string) => {
    const selectedIds = selectedGuests[request.id] || []
    if (selectedIds.length === 0) return
    
    const comment = (commentOverride ?? rowComments[request.id]?.trim() ?? "").trim()

    // 1. Update guests
    const updatedGuests = request.guests.map(g => {
      if (selectedIds.includes(g.id)) {
        return { ...g, approver2Status: "rejected" as const, approver2Comment: comment }
      }
      return g
    })

    // 2. Check overall status
    const areAllProcessed = updatedGuests.every(g => 
        g.approver2Status === "approved" || 
        g.approver2Status === "rejected" || 
        g.approver2Status === "blacklisted" ||
        g.approver1Status !== "approved"
    )

    let requestUpdate: Partial<Request> = {
        guests: updatedGuests,
        updatedAt: new Date().toISOString(),
    }

    let notificationToSend: { type: string, message: string } | null = null

    if (areAllProcessed) {
        const hasApprovedGuests = updatedGuests.some(g => g.approver2Status === "approved")
        
        if (!hasApprovedGuests) {
            // All guests rejected/blacklisted -> Request Rejected
            requestUpdate = {
                ...requestUpdate,
                status: "approver2-rejected",
                approver2Comment: comment,
                approver2Date: new Date().toISOString(),
                approver2By: "Approver 2",
            }
            
            notificationToSend = {
                type: "request_rejected",
                message: `Your request for ${request.destination} has been rejected by Approver 2: ${comment}`
            }
        }
    }

    const updated = { ...request, ...requestUpdate } as Request
    
    await saveRequest(updated)

    if (notificationToSend) {
        await saveNotification({
            userId: request.requestedById,
            type: notificationToSend.type as any,
            message: notificationToSend.message,
            requestId: request.id,
            read: false,
        })
    }

    // Reload data to get fresh state from database
    await loadData()

    setSelectedGuests(prev => {
        const copy = { ...prev }
        delete copy[request.id]
        return copy
    })
    toast({ variant: "destructive", title: "Guests Rejected", description: `${selectedIds.length} guests rejected.` })
  }

  const blacklistRow = async (request: Request, commentOverride?: string) => {
    const selectedIds = selectedGuests[request.id] || []
    if (selectedIds.length === 0) return
    
    const comment = (commentOverride ?? rowComments[request.id]?.trim() ?? "").trim()

    // 1. Update guests and add to blacklist
    const selectedGuestsList = request.guests.filter(g => selectedIds.includes(g.id))
    
    for (const guest of selectedGuestsList) {
        await saveBlacklistEntry({
          name: guest.name,
          organization: guest.organization,
          email: guest.email,
          phone: guest.phone,
          reason: comment || "Blacklisted by Approver 2",
          active: true,
        })
    }

    const updatedGuests = request.guests.map(g => {
      if (selectedIds.includes(g.id)) {
        return { ...g, approver2Status: "blacklisted" as const, approver2Comment: comment || undefined }
      }
      return g
    })

    // 2. Check overall status
    const areAllProcessed = updatedGuests.every(g => 
        g.approver2Status === "approved" || 
        g.approver2Status === "rejected" || 
        g.approver2Status === "blacklisted" ||
        g.approver1Status !== "approved"
    )

    let requestUpdate: Partial<Request> = {
        guests: updatedGuests,
        updatedAt: new Date().toISOString(),
    }

    if (areAllProcessed) {
        const hasApprovedGuests = updatedGuests.some(g => g.approver2Status === "approved")
        if (!hasApprovedGuests) {
            requestUpdate.status = "approver2-rejected"
            requestUpdate.approver2Comment = comment || "All guests blacklisted"
            requestUpdate.approver2Date = new Date().toISOString()
            requestUpdate.approver2By = "Approver 2"
        }
    }

    const updated = { ...request, ...requestUpdate } as Request
    await saveRequest(updated)
    
    // Reload data to get fresh state from database
    await loadData()

    setSelectedGuests(prev => {
        const copy = { ...prev }
        delete copy[request.id]
        return copy
    })
    toast({ variant: "destructive", title: "Guests Blacklisted", description: `${selectedIds.length} guest(s) blacklisted.` })
  }

  const pendingCount = allRequests.filter(r => r.status === "approver1-approved" || r.status === "approver2-pending").length;
  const approvedCount = allRequests.filter(r => r.status === "approver2-approved").length;
  const rejectedCount = allRequests.filter(r => r.status === "approver2-rejected").length;

  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="flex-shrink-0">
        <h1 className="mb-6 text-3xl font-bold text-cyan-600">Approver 2 Dashboard</h1>
      </div>
      
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card onClick={() => setStatusFilter("pending")} className={statusFilter === "pending" ? "ring-2 ring-cyan-500 cursor-pointer" : "cursor-pointer"}>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card onClick={() => setStatusFilter("approved")} className={statusFilter === "approved" ? "ring-2 ring-cyan-500 cursor-pointer" : "cursor-pointer"}>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Approved</h3>
            <p className="text-2xl font-bold">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card onClick={() => setStatusFilter("rejected")} className={statusFilter === "rejected" ? "ring-2 ring-cyan-500 cursor-pointer" : "cursor-pointer"}>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Rejected</h3>
            <p className="text-2xl font-bold">{rejectedCount}</p>
          </CardContent>
        </Card>
        <Card onClick={() => setStatusFilter("all")} className={statusFilter === "all" ? "ring-2 ring-cyan-500 cursor-pointer" : "cursor-pointer"}>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-gray-500">All</h3>
            <p className="text-2xl font-bold">{allRequests.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-1 flex-col p-6 min-w-0">
        <div className="mb-4 flex flex-col items-center justify-between gap-4 md:flex-row">
          <h2 className="text-xl font-semibold text-gray-900">Requests</h2>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full md:w-64"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3 overflow-y-auto">
          {filteredRequests.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No requests found.</p>
          ) : (
            <>
              <div className="overflow-x-auto max-w-full rounded-lg border">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Gate</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead className="min-w-[200px]">Comment</TableHead>
                      <TableHead className="min-w-[300px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRequests.map((request) => {
                      const isEditingRow = editingRowId === request.id
                      return (
                        <Fragment key={request.id}>
                          <TableRow className={isEditingRow ? 'bg-blue-50' : ''}>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => toggleExpand(request.id)}>
                                {expandedRequests.has(request.id) ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">{request.requestedBy}</TableCell>
                            <TableCell>{request.destination}</TableCell>
                            <TableCell>{request.gate}</TableCell>
                            <TableCell className="min-w-[180px]">{request.fromDate} to {request.toDate}</TableCell>
                            <TableCell>{request.guests.filter(g => (g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted") && !g.approver2Status).length} / {request.guests.filter(g => g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted").length}</TableCell>
                            <TableCell>
                              <Input
                                placeholder="Add comment..."
                                value={rowComments[request.id] || ""}
                                onChange={(e) => setRowComments((prev) => ({ ...prev, [request.id]: e.target.value }))}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                 <Button size="sm" variant="outline" onClick={() => startRowEdit(request)} disabled={isEditingRow}>
                                  <Edit className="mr-1 size-3" /> Edit
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700" 
                                  onClick={() => { setPendingAction({ type: 'approve', requestId: request.id }); setPendingActionComment(rowComments[request.id] || '') }}
                                  disabled={(selectedGuests[request.id] || []).length === 0}
                                >
                                  <Check className="mr-1 size-3" /> Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  onClick={() => { setPendingAction({ type: 'reject', requestId: request.id }); setPendingActionComment(rowComments[request.id] || '') }} 
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={(selectedGuests[request.id] || []).length === 0}
                                >
                                  <X className="mr-1 size-3" /> Reject
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="border-orange-300 text-orange-600 hover:bg-orange-50" 
                                  onClick={() => { setPendingAction({ type: 'blacklist', requestId: request.id }); setPendingActionComment(rowComments[request.id] || '') }}
                                  disabled={(selectedGuests[request.id] || []).length === 0}
                                >
                                  <Ban className="mr-1 size-3" /> Blacklist
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedRequests.has(request.id) && (
                            <TableRow>
                              <TableCell colSpan={8}>
                              {isEditingRow && editedRequest ? (
                                 <div className="border-blue-200 bg-blue-50 p-4">
                                  <h3 className="mb-4 text-base font-semibold">Editing Request</h3>
                                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-dest">Destination</Label>
                                      <Input id="edit-dest" value={editedRequest.destination || ''} onChange={e => updateEditedField('destination', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-gate">Gate</Label>
                                      <Input id="edit-gate" value={editedRequest.gate || ''} onChange={e => updateEditedField('gate', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-from">From Date</Label>
                                      <Input id="edit-from" type="date" value={editedRequest.fromDate || ''} onChange={e => updateEditedField('fromDate', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-to">To Date</Label>
                                      <Input id="edit-to" type="date" value={editedRequest.toDate || ''} onChange={e => updateEditedField('toDate', e.target.value)} />
                                    </div>
                                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                      <Label htmlFor="edit-purpose">Purpose</Label>
                                      <Textarea id="edit-purpose" value={editedRequest.purpose || ''} onChange={e => updateEditedField('purpose', e.target.value)} />
                                    </div>
                                    
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <h4 className="mb-2 mt-2 font-medium">Guests</h4>
                                        {editedRequest.guests.map((guest, idx) => (
                                            <div key={idx} className="grid grid-cols-1 gap-4 border-t py-4 sm:grid-cols-2 md:grid-cols-3">
                                                <div className="space-y-2">
                                                    <Label>Name</Label>
                                                    <Input value={guest.name || ''} onChange={e => updateEditedGuest(idx, 'name', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Organization</Label>
                                                    <Input value={guest.organization || ''} onChange={e => updateEditedGuest(idx, 'organization', e.target.value)} />
                                                </div>
                                                 <div className="space-y-2">
                                                    <Label>Email</Label>
                                                    <Input type="email" value={guest.email || ''} onChange={e => updateEditedGuest(idx, 'email', e.target.value)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                  </div>
                                  <div className="mt-6 flex justify-end gap-2">
                                    <Button variant="outline" onClick={cancelRowEdit}>Cancel</Button>
                                    <Button onClick={saveRowEdit}>Save Changes</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-lg border bg-gray-50 p-4">
                                  <h4 className="mb-3 font-semibold text-gray-800">Guests Details</h4>
                                  <Table className="w-full">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[50px]">
                                          <Checkbox 
                                            checked={areAllGuestsSelected(request.id, request.guests)}
                                            onCheckedChange={(checked) => handleSelectAllGuests(request.id, request.guests, checked as boolean)}
                                            disabled={request.guests.filter(g => (g.approver1Status === "approved" || g.approver1Status === "rejected" || g.approver1Status === "blacklisted") && !g.approver2Status).length === 0}
                                          />
                                        </TableHead>
                                        <TableHead>Guest</TableHead>
                                        <TableHead>Organization</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>ID Photo</TableHead>
                                        <TableHead>Devices</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {request.guests
                                        .filter(guest => (guest.approver1Status === "approved" || guest.approver1Status === "rejected" || guest.approver1Status === "blacklisted") && !guest.approver2Status) // Show guests processed by Approver 1 (approved, rejected, or blacklisted) but not yet processed by Approver 2
                                        .map((guest) => (
                                        <TableRow key={guest.id}>
                                            <TableCell>
                                              <Checkbox 
                                                checked={isGuestSelected(request.id, guest.id)}
                                                onCheckedChange={(checked) => handleSelectGuest(request.id, guest.id, checked as boolean)}
                                              />
                                            </TableCell>
                                            <TableCell className="font-medium">{guest.name}</TableCell>
                                            <TableCell>{guest.organization}</TableCell>
                                            <TableCell>{guest.email || "-"}</TableCell>
                                          <TableCell>{getGuestStatusBadge(guest.approver2Status || guest.approver1Status)}</TableCell>
                                          <TableCell>
                                            {guest.idPhotoUrl ? (
                                              <Button size="sm" variant="link" onClick={() => setViewingIdPhoto({ url: guest.idPhotoUrl!, guestName: guest.name })}>
                                                <User className="mr-1 size-4" /> View ID
                                              </Button>
                                            ) : (
                                              <span className="text-xs text-gray-500">N/A</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="max-w-xs truncate text-xs text-gray-600">
                                             {[
                                                guest.laptop && "Laptop",
                                                guest.mobile && "Mobile",
                                                guest.flash && "Flash Drive",
                                                guest.otherDevice && `Other (${guest.otherDeviceDescription})`
                                            ].filter(Boolean).join(", ") || "—"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {request.guests.filter(guest => (guest.approver1Status === "approved" || guest.approver1Status === "rejected" || guest.approver1Status === "blacklisted") && !guest.approver2Status).length === 0 && (
                                        <TableRow>
                                          <TableCell colSpan={7} className="text-center text-gray-500 py-4">
                                            All guests have been processed
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                 <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-600">Page {currentPage} of {totalPages}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="size-4" /> Previous
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                      Next <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
      <Dialog open={!!viewingIdPhoto} onOpenChange={() => setViewingIdPhoto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ID Photo - {viewingIdPhoto?.guestName}</DialogTitle>
          </DialogHeader>
          {viewingIdPhoto && (
            <img src={viewingIdPhoto.url || "/placeholder.svg"} alt={`ID photo for ${viewingIdPhoto.guestName}`} className="max-h-[80vh] w-full rounded object-contain"/>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!pendingAction} onOpenChange={() => { setPendingAction(null); setPendingActionComment('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === 'blacklist' ? 'Blacklist Guests' : 
               pendingAction?.type === 'reject' ? 'Reject Guests' : 
               'Approve Guests'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Label>Comment {pendingAction?.type === 'reject' || pendingAction?.type === 'blacklist' ? '(Required)' : '(Optional)'}</Label>
            <Textarea value={pendingActionComment} onChange={(e) => setPendingActionComment(e.target.value)} placeholder={pendingAction?.type === 'reject' || pendingAction?.type === 'blacklist' ? "Provide a reason..." : "Add a comment (optional)..."} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPendingAction(null); setPendingActionComment('') }}>Cancel</Button>
              <Button onClick={async () => {
                if (!pendingAction) return
                const req = requests.find(r => r.id === pendingAction.requestId)
                if (!req) return
                const comment = pendingActionComment.trim()
                if ((pendingAction.type === 'reject' || pendingAction.type === 'blacklist') && !comment) {
                  toast({ variant: 'destructive', title: 'Comment required', description: 'Please provide a reason.' })
                  return
                }
                setPendingAction(null)
                setPendingActionComment('')
                if (pendingAction.type === 'approve') {
                  await approveRow(req, comment)
                } else if (pendingAction.type === 'reject') {
                  await rejectRow(req, comment)
                } else {
                  await blacklistRow(req, comment)
                }
              }}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

    
