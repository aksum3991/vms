"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserCheck, CheckCircle2, Clock, ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { getRequestById, checkInGuest, checkOutGuest, triggerCheckInNotification, triggerCheckOutNotification, getSettings } from "@/lib/actions"
import type { Guest, Request } from "@/lib/types"
import ProtectedRoute from "@/components/protected-route"
import { useToast } from "@/components/ui/use-toast"

export default function ScanPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "reception"]}>
      <ScanPageContent />
    </ProtectedRoute>
  )
}

function ScanPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const slug = params?.slug as string
  const requestId = searchParams?.get("r")
  const guestId = searchParams?.get("g")

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [request, setRequest] = useState<Request | null>(null)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (requestId && guestId) {
      loadData()
    } else {
      setError("Invalid scan data. Missing IDs.")
      setLoading(false)
    }
  }, [requestId, guestId])

  const loadData = async () => {
    setLoading(true)
    try {
      const fetchedRequest = await getRequestById(requestId!)
      if (!fetchedRequest) {
        setError("Request not found.")
        return
      }

      const fetchedGuest = fetchedRequest.guests.find(g => g.id === guestId)
      if (!fetchedGuest) {
        setError("Guest not found in this request.")
        return
      }

      setRequest(fetchedRequest)
      setGuest(fetchedGuest)
      setError(null)
    } catch (err) {
      setError("Failed to load guest data.")
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: "check-in" | "check-out") => {
    if (!request || !guest) return
    setProcessing(true)
    try {
      if (action === "check-in") {
        const result = await checkInGuest(request.id, guest.id)
        if (result.success) {
          toast({ title: "Checked In", description: `${guest.name} has been checked in.` })
          await triggerCheckInNotification(request.id, guest.id)
        } else {
          toast({ variant: "destructive", title: "Error", description: result.error || "Failed to check in." })
        }
      } else {
        const result = await checkOutGuest(request.id, guest.id)
        if (result.success) {
          toast({ title: "Checked Out", description: `${guest.name} has been checked out.` })
          await triggerCheckOutNotification(request.id, guest.id)
        } else {
          toast({ variant: "destructive", title: "Error", description: result.error || "Failed to check out." })
        }
      }
      await loadData() // Refresh status
    } catch (err) {
      toast({ variant: "destructive", title: "Unexpected Error", description: "Something went wrong." })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-xl font-bold">Scan Error</h2>
        <p className="mb-6 text-gray-600">{error}</p>
        <Button onClick={() => router.push(`/t/${slug}/reception`)}>
          Return to Reception
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-md">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => router.push(`/t/${slug}/reception`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="overflow-hidden shadow-lg">
          <CardHeader className="bg-cyan-600 text-white">
            <CardTitle className="text-lg">Visit Pass Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                <UserCheck className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{guest?.name}</h3>
              <p className="text-gray-500">{guest?.organization}</p>
              
              <div className="mt-4">
                {guest?.checkInTime ? (
                   guest?.checkOutTime ? (
                    <Badge className="bg-gray-100 text-gray-700">Checked Out</Badge>
                   ) : (
                    <Badge className="bg-green-100 text-green-700">Currently On-site</Badge>
                   )
                ) : (
                  <Badge className="bg-blue-100 text-blue-700">Scheduled Visit</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="space-y-1">
                <p className="text-gray-500">Destination</p>
                <p className="font-semibold">{request?.destination}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">Gate</p>
                <p className="font-semibold">{request?.gate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">Start Date</p>
                <p className="font-semibold">{request?.fromDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">End Date</p>
                <p className="font-semibold">{request?.toDate}</p>
              </div>
            </div>

            <div className="space-y-3">
              {!guest?.checkInTime && (
                <Button 
                  className="w-full bg-green-600 py-6 text-lg hover:bg-green-700" 
                  onClick={() => handleAction("check-in")}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  Check In Guest
                </Button>
              )}

              {guest?.checkInTime && !guest?.checkOutTime && (
                <Button 
                  className="w-full bg-orange-600 py-6 text-lg hover:bg-orange-700"
                  onClick={() => handleAction("check-out")}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Clock className="mr-2 h-5 w-5" />}
                  Check Out Guest
                </Button>
              )}

              {guest?.checkOutTime && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="font-medium text-gray-900">Visit Completed</p>
                  <p className="text-sm text-gray-500">Checked out at {new Date(guest.checkOutTime).toLocaleTimeString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
