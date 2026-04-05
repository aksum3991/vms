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
import { DualCalendarPicker } from "@/components/ui/dual-calendar-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Plus, Trash2, Download, FileSpreadsheet, Image as ImageIcon, Users } from "lucide-react"
import * as XLSX from "xlsx"
import Image from "next/image"

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

  const [guests, setGuests] = useState([
    {
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
      preferredLanguage: "en",
    },
  ])
  
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

  const addGuest = () => {
    setGuests([
      ...guests,
      {
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
        preferredLanguage: "en",
      },
    ])
  }

  const removeGuest = (index: number) => {
    if (guests.length > 1) {
      setGuests(guests.filter((_, i) => i !== index))
    }
  }

  const updateGuest = (index: number, field: string, value: any) => {
    const newGuests = guests.map((g, i) =>
      i === index ? { ...g, [field]: value } : g
    )
    setGuests(newGuests)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader()
      reader.onloadend = () => updateGuest(index, "idPhotoUrl", reader.result as string)
      reader.readAsDataURL(e.target.files[0])
    }
  }

  const handleExportTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Guest Name (Required)": "John Doe",
        "Organization (Required)": "Acme Corp",
        "Email (Optional)": "john@example.com",
        "Phone (Optional)": "+123456789",
        "Laptop (Yes/No)": "Yes",
        "Mobile (Yes/No)": "Yes",
        "Flash Drive (Yes/No)": "No",
        "Other Device (Yes/No)": "No",
        "Other Device Description": "",
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    XLSX.writeFile(wb, "GuestListTemplate.xlsx")
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
      const validGuests = data
        .map((row) => ({
          name: row["Guest Name (Required)"] || "",
          organization: row["Organization (Required)"] || "",
          email: row["Email (Optional)"] || "",
          phone: row["Phone (Optional)"] || "",
          laptop: row["Laptop (Yes/No)"]?.toString().toLowerCase() === "yes",
          mobile: row["Mobile (Yes/No)"]?.toString().toLowerCase() === "yes",
          flash: row["Flash Drive (Yes/No)"]?.toString().toLowerCase() === "yes",
          otherDevice: row["Other Device (Yes/No)"]?.toString().toLowerCase() === "yes",
          otherDeviceDescription: row["Other Device Description"] || "",
          idPhotoUrl: "",
          preferredLanguage: "en",
        }))
        .filter((g) => g.name || g.organization)

      if (validGuests.length > 0) {
        setGuests((prev) => (prev.length === 1 && !prev[0].name ? validGuests : [...prev, ...validGuests]))
        toast({ title: "Import Successful", description: `Imported ${validGuests.length} guests.` })
      } else {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: "We couldn't find any valid guest data in the file. Please download the template, fill it, and try again.",
        })
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ""
  }

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
    const result = await submitSelfRegistration(slug, guests, {
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
            Thank you, <strong>{guests[0]?.name}{guests.length > 1 ? ` and ${guests.length - 1} others` : ""}</strong>. Your visit request has been sent for approval.
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
            
            {/* Guest List Section */}
            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="bg-white border-b rounded-t-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-cyan-700">
                      <Users className="h-5 w-5" /> Guest List
                    </CardTitle>
                    <CardDescription>Personal and contact information for all visitors.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button type="button" onClick={handleExportTemplate} variant="outline" size="sm" className="flex-1 sm:flex-none">
                      <Download className="mr-2 h-4 w-4" /> Template
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative flex-1 sm:flex-none">
                            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                            <Button type="button" variant="outline" size="sm" className="w-full">
                              <FileSpreadsheet className="mr-2 h-4 w-4" /> Import
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download the template file, fill it, and upload it here.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button type="button" onClick={addGuest} variant="outline" size="sm" className="flex-1 sm:flex-none bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100">
                      <Plus className="mr-2 h-4 w-4" /> Add Row
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-white rounded-b-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="w-[50px] text-center">#</TableHead>
                        <TableHead className="min-w-[180px]">Name *</TableHead>
                        <TableHead className="min-w-[180px]">Organization *</TableHead>
                        <TableHead className="min-w-[180px]">Email & Phone</TableHead>
                        <TableHead className="w-[80px] text-center">ID Photo</TableHead>
                        <TableHead className="min-w-[150px]">Devices</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.map((guest, index) => (
                        <TableRow key={index} className="hover:bg-gray-50/30 transition-colors">
                          <TableCell className="text-center font-medium text-gray-500">{index + 1}</TableCell>
                          <TableCell>
                            <Input placeholder="Full Name" value={guest.name} onChange={(e) => updateGuest(index, "name", e.target.value)} required className={focusStyles} />
                          </TableCell>
                          <TableCell>
                            <Input placeholder="Company" value={guest.organization} onChange={(e) => updateGuest(index, "organization", e.target.value)} required className={focusStyles} />
                          </TableCell>
                          <TableCell className="space-y-1">
                            <Input type="email" placeholder="Email" value={guest.email} onChange={(e) => updateGuest(index, "email", e.target.value)} required className={`h-8 text-xs ${focusStyles}`} />
                            <Input placeholder="Phone" value={guest.phone} onChange={(e) => updateGuest(index, "phone", e.target.value)} className={`h-8 text-xs ${focusStyles}`} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <label htmlFor={`idPhoto-${index}`} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 hover:border-cyan-400 hover:bg-cyan-50 transition-all">
                                {guest.idPhotoUrl ? (
                                  <div className="relative h-full w-full overflow-hidden rounded">
                                    <Image src={guest.idPhotoUrl} alt="ID" fill className="object-cover" />
                                  </div>
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-gray-400" />
                                )}
                              </label>
                              <input id={`idPhoto-${index}`} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, index)} className="hidden" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border text-[10px]">
                                <Checkbox id={`laptop-${index}`} checked={guest.laptop} onCheckedChange={(c) => updateGuest(index, "laptop", !!c)} />
                                <Label htmlFor={`laptop-${index}`} className="cursor-pointer">Laptop</Label>
                              </div>
                              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border text-[10px]">
                                <Checkbox id={`mobile-${index}`} checked={guest.mobile} onCheckedChange={(c) => updateGuest(index, "mobile", !!c)} />
                                <Label htmlFor={`mobile-${index}`} className="cursor-pointer">Phone</Label>
                              </div>
                              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border text-[10px]">
                                <Checkbox id={`other-${index}`} checked={guest.otherDevice} onCheckedChange={(c) => updateGuest(index, "otherDevice", !!c)} />
                                <Label htmlFor={`other-${index}`} className="cursor-pointer">Other</Label>
                              </div>
                            </div>
                            {guest.otherDevice && (
                              <Input placeholder="Describe..." value={guest.otherDeviceDescription} onChange={(e) => updateGuest(index, "otherDeviceDescription", e.target.value)} className="mt-2 h-7 text-[10px]" required />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeGuest(index)} disabled={guests.length === 1} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
