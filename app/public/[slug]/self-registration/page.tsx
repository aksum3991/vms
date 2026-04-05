"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { CheckCircle2, Loader2, Building2, User } from "lucide-react"
import { submitSelfRegistration, getPublicTenantGates } from "@/lib/public-actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DualCalendarPicker } from "@/components/ui/dual-calendar-picker"

// Reusing the modern focus styles from the main app
const focusStyles = "bg-white focus-visible:ring-cyan-600 focus-visible:border-cyan-500 transition-all duration-200"

export default function PublicRegistrationPage() {
  const params = useParams()
  const slug = params?.slug as string
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [gatesLoading, setGatesLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [statusAssigned, setStatusAssigned] = useState("")
  const [availableGates, setAvailableGates] = useState<string[]>([])

  const [guestData, setGuestData] = useState({
    name: "",
    organization: "",
    email: "",
    phone: "",
    laptop: false,
    mobile: false,
    flash: false,
    otherDevice: false,
    otherDeviceDescription: "",
    idPhotoUrl: "",
  })

  const [requestData, setRequestData] = useState({
    destination: "",
    gate: "", 
    fromDate: "",
    toDate: "",
    purpose: "",
    hostEmail: "",
  })

  // State for sync dual calendars
  const [calendarMode, setCalendarMode] = useState<"gregorian" | "ethiopian">("gregorian")

  // Fetch gates on mount
  useEffect(() => {
    async function fetchGates() {
      if (!slug) return
      setGatesLoading(true)
      const gates = await getPublicTenantGates(slug)
      setAvailableGates(gates)
      setGatesLoading(false)
    }
    fetchGates()
  }, [slug])

  // Date constraints
  const today = new Date().toISOString().split("T")[0]
  const minToDate = requestData.fromDate || today

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Front-end date validation
    if (requestData.fromDate < today) {
      toast({ variant: "destructive", title: "Invalid Date", description: "From Date cannot be in the past." })
      return
    }
    if (requestData.toDate < requestData.fromDate) {
      toast({ variant: "destructive", title: "Invalid Date Range", description: "To Date cannot be earlier than From Date." })
      return
    }

    setLoading(true)
    const result = await submitSelfRegistration(slug, guestData, {
      ...requestData,
      hostEmail: requestData.hostEmail.trim() === "" ? undefined : requestData.hostEmail.trim()
    })

    if (result.success) {
      setStatusAssigned(result.statusAssigned || "")
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: result.error || "An unexpected error occurred. Please try again.",
      })
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-white animate-in fade-in zoom-in duration-500 p-8 text-center shadow-xl border-t-4 border-t-cyan-500">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50">
            <CheckCircle2 className="h-10 w-10 text-cyan-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Registration Submitted!</h2>
          <p className="text-lg text-gray-600 mb-6">
            Thank you, <strong>{guestData.name}</strong>. Your visit request has been sent for approval.
          </p>
          
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-8 text-sm">
            {statusAssigned === "host-pending" ? (
              <p>We've notified your host at <strong>{requestData.hostEmail}</strong>. Once they verify your visit, it will proceed to final security approval.</p>
            ) : (
              <p>Your request has been routed to our security team for approval. You will be notified via email once approved.</p>
            )}
          </div>

          <Button onClick={() => window.location.reload()} variant="outline" className="w-full sm:w-auto">
            Submit Another Request
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">Visitor Registration</h1>
          <p className="text-lg text-muted-foreground">Please fill out your details below to request a visit.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-8">
            
            {/* Guest Details Section */}
            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="bg-white border-b rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-xl text-cyan-700">
                  <User className="h-5 w-5" /> Your Details
                </CardTitle>
                <CardDescription>Personal and contact information.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid gap-6 sm:grid-cols-2 bg-white rounded-b-xl">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Full Name *</Label>
                  <Input 
                    id="guestName" 
                    placeholder="John Doe"
                    value={guestData.name}
                    onChange={e => setGuestData({...guestData, name: e.target.value})}
                    required 
                    className={focusStyles}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization / Company *</Label>
                  <Input 
                    id="organization" 
                    placeholder="Acme Corp"
                    value={guestData.organization}
                    onChange={e => setGuestData({...guestData, organization: e.target.value})}
                    required 
                    className={focusStyles}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="john@example.com"
                    value={guestData.email}
                    onChange={e => setGuestData({...guestData, email: e.target.value})}
                    required 
                    className={focusStyles}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={guestData.phone}
                    onChange={e => setGuestData({...guestData, phone: e.target.value})}
                    className={focusStyles}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Visit Details Section */}
            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="bg-white border-b rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-xl text-cyan-700">
                  <Building2 className="h-5 w-5" /> Visit Details
                </CardTitle>
                <CardDescription>When and why are you visiting?</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6 bg-white rounded-b-xl">
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hostEmail">Who are you visiting? (Optional)</Label>
                    <Input 
                      id="hostEmail" 
                      type="email"
                      placeholder="employee@company.com"
                      value={requestData.hostEmail}
                      onChange={e => setRequestData({...requestData, hostEmail: e.target.value})}
                      className={focusStyles}
                    />
                    <p className="text-[10px] text-muted-foreground">If you know the email of the person you are visiting, entering it will speed up approval.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Destination / Office *</Label>
                    <Input 
                      id="destination" 
                      placeholder="e.g. Finance Dept, Room 101"
                      value={requestData.destination}
                      onChange={e => setRequestData({...requestData, destination: e.target.value})}
                      required 
                      className={focusStyles}
                    />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fromDate">From Date *</Label>
                    <DualCalendarPicker
                      date={requestData.fromDate ? new Date(requestData.fromDate) : undefined}
                      mode={calendarMode}
                      onModeChange={setCalendarMode}
                      onChange={(d) => {
                        if (d) {
                          const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0]
                          setRequestData({ ...requestData, fromDate: isoStr })
                        } else {
                          setRequestData({ ...requestData, fromDate: "" })
                        }
                      }}
                      disabledDays={(d) => {
                        const today = new Date()
                        today.setHours(0,0,0,0)
                        return d < today
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toDate">To Date *</Label>
                    <DualCalendarPicker
                      date={requestData.toDate ? new Date(requestData.toDate) : undefined}
                      mode={calendarMode}
                      onModeChange={setCalendarMode}
                      onChange={(d) => {
                        if (d) {
                          const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0]
                          setRequestData({ ...requestData, toDate: isoStr })
                        } else {
                          setRequestData({ ...requestData, toDate: "" })
                        }
                      }}
                      disabledDays={(d) => {
                        const today = new Date()
                        today.setHours(0,0,0,0)
                        const fromDate = requestData.fromDate ? new Date(requestData.fromDate) : null
                        return d < today || (fromDate ? d < fromDate : false)
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose of Visit *</Label>
                  <Textarea 
                    id="purpose" 
                    placeholder="Please describe the detailed reason for your visit..."
                    rows={4}
                    value={requestData.purpose}
                    onChange={e => setRequestData({...requestData, purpose: e.target.value})}
                    required 
                    className={focusStyles}
                  />
                </div>

              </CardContent>
            </Card>

            {/* Devices Section */}
            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="bg-white border-b rounded-t-xl">
                <CardTitle className="text-lg text-cyan-700">Devices & Belongings</CardTitle>
                <CardDescription>Select any devices you plan to bring with you.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 bg-white rounded-b-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg border">
                    <Checkbox id="reqLaptop" checked={guestData.laptop} onCheckedChange={(c) => setGuestData({...guestData, laptop: !!c})} />
                    <Label htmlFor="reqLaptop" className="cursor-pointer">Laptop</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg border">
                    <Checkbox id="reqMobile" checked={guestData.mobile} onCheckedChange={(c) => setGuestData({...guestData, mobile: !!c})} />
                    <Label htmlFor="reqMobile" className="cursor-pointer">Mobile</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg border">
                    <Checkbox id="reqFlash" checked={guestData.flash} onCheckedChange={(c) => setGuestData({...guestData, flash: !!c})} />
                    <Label htmlFor="reqFlash" className="cursor-pointer">Flash Drive</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg border">
                    <Checkbox id="reqOther" checked={guestData.otherDevice} onCheckedChange={(c) => setGuestData({...guestData, otherDevice: !!c})} />
                    <Label htmlFor="reqOther" className="cursor-pointer">Other</Label>
                  </div>
                </div>
                {guestData.otherDevice && (
                  <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="otherDeviceDesc">Describe Other Devices</Label>
                    <Input 
                      id="otherDeviceDesc" 
                      value={guestData.otherDeviceDescription}
                      onChange={e => setGuestData({...guestData, otherDeviceDescription: e.target.value})}
                      placeholder="e.g. Camera, Drone"
                      className={focusStyles}
                      required
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 py-6 text-lg font-bold shadow-lg transition-all hover:shadow-cyan-200/50 hover:-translate-y-0.5"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading ? "Submitting Request..." : "Submit Visit Request"}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}
