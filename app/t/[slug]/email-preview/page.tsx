"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, MessageSquare } from "lucide-react"
import { emailTemplates, smsTemplates } from "@/lib/notification-templates"
import type { Request, Guest } from "@/lib/types"
import { ProtectedRoute } from "@/components/protected-route"

function EmailPreviewContent() {
  const sampleRequest: Request = {
    id: "sample-123",
    requestedBy: "John Doe",
    requestedById: "user-123",
    requestedByEmail: "john@example.com",
    destination: "ICT Department",
    gate: "228",
    fromDate: "2025-01-15",
    toDate: "2025-01-17",
    purpose: "Technical consultation and system integration meeting",
    guests: [
      {
        id: "1",
        name: "Jane Smith",
        organization: "Tech Solutions Inc",
        email: "jane@techsolutions.com",
        phone: "+1234567890",
        laptop: true,
        mobile: true,
        flash: false,
        otherDevice: false,
      },
      {
        id: "2",
        name: "Bob Johnson",
        organization: "Digital Consultants",
        email: "bob@digitalconsultants.com",
        phone: "+1234567891",
        laptop: false,
        mobile: true,
        flash: true,
        otherDevice: false,
      },
    ],
    status: "approver2-approved",
    createdAt: "2025-01-10T10:00:00Z",
    updatedAt: "2025-01-11T14:30:00Z",
    approver1Comment: "Approved for technical consultation",
    approver1Date: "2025-01-10T15:00:00Z",
    approver1By: "Approver 1",
    approver2Comment: "Final approval granted",
    approver2Date: "2025-01-11T14:30:00Z",
    approver2By: "Approver 2",
  }

  const sampleGuest: Guest = sampleRequest.guests[0]

  const [selectedTemplate, setSelectedTemplate] = useState<string>("requestSubmitted")

  const getEmailContent = () => {
    switch (selectedTemplate) {
      case "requestSubmitted":
        return emailTemplates.requestSubmitted(sampleRequest)
      case "requestApprovedApprover1":
        return emailTemplates.requestApprovedApprover1(sampleRequest)
      case "requestApprovedFinal":
        return emailTemplates.requestApprovedFinal(sampleRequest)
      case "requestRejected":
        return emailTemplates.requestRejected(sampleRequest, "Insufficient documentation provided")
      case "guestInvitation":
        return emailTemplates.guestInvitation(sampleRequest, sampleGuest)
      case "guestCheckIn":
        return emailTemplates.guestCheckIn(sampleRequest, sampleGuest)
      case "guestCheckOut":
        return emailTemplates.guestCheckOut(sampleRequest, sampleGuest)
      default:
        return { subject: "", body: "" }
    }
  }

  const getSMSContent = () => {
    switch (selectedTemplate) {
      case "requestApproved":
        return smsTemplates.requestApproved(sampleRequest)
      case "requestRejected":
        return smsTemplates.requestRejected(sampleRequest)
      case "guestInvitation":
        return smsTemplates.guestInvitation(sampleRequest, sampleGuest)
      case "guestCheckIn":
        return smsTemplates.guestCheckIn(sampleRequest, sampleGuest)
      case "reminderBeforeVisit":
        return smsTemplates.reminderBeforeVisit(sampleRequest, sampleGuest)
      default:
        return { message: "" }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Notification Templates Preview</h1>

        <Tabs defaultValue="email" className="space-y-6">
          <TabsList>
            <TabsTrigger value="email">
              <Mail className="mr-2 size-4" />
              Email Templates
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="mr-2 size-4" />
              SMS Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Select Template</CardTitle>
                  <CardDescription>Choose an email template to preview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button
                      variant={selectedTemplate === "requestSubmitted" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("requestSubmitted")}
                    >
                      Request Submitted
                    </Button>
                    <Button
                      variant={selectedTemplate === "requestApprovedApprover1" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("requestApprovedApprover1")}
                    >
                      Approved by Approver 1
                    </Button>
                    <Button
                      variant={selectedTemplate === "requestApprovedFinal" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("requestApprovedFinal")}
                    >
                      Final Approval
                    </Button>
                    <Button
                      variant={selectedTemplate === "requestRejected" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("requestRejected")}
                    >
                      Request Rejected
                    </Button>
                    <Button
                      variant={selectedTemplate === "guestInvitation" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("guestInvitation")}
                    >
                      Guest Invitation
                    </Button>
                    <Button
                      variant={selectedTemplate === "guestCheckIn" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("guestCheckIn")}
                    >
                      Guest Check-in
                    </Button>
                    <Button
                      variant={selectedTemplate === "guestCheckOut" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("guestCheckOut")}
                    >
                      Guest Check-out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Email Preview</CardTitle>
                  <CardDescription>Preview of the selected email template</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-white p-6">
                    <div className="mb-4 border-b pb-4">
                      <p className="text-sm text-gray-600">Subject:</p>
                      <p className="font-semibold text-gray-900">{getEmailContent().subject}</p>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {getEmailContent().body}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sms">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Select Template</CardTitle>
                  <CardDescription>Choose an SMS template to preview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button
                      variant={selectedTemplate === "requestApproved" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("requestApproved")}
                    >
                      Request Approved
                    </Button>
                    <Button
                      variant={selectedTemplate === "requestRejected" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("requestRejected")}
                    >
                      Request Rejected
                    </Button>
                    <Button
                      variant={selectedTemplate === "guestInvitation" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("guestInvitation")}
                    >
                      Guest Invitation
                    </Button>
                    <Button
                      variant={selectedTemplate === "guestCheckIn" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("guestCheckIn")}
                    >
                      Guest Check-in
                    </Button>
                    <Button
                      variant={selectedTemplate === "reminderBeforeVisit" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedTemplate("reminderBeforeVisit")}
                    >
                      Visit Reminder
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>SMS Preview</CardTitle>
                  <CardDescription>Preview of the selected SMS template</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-6">
                    <div className="mx-auto max-w-sm rounded-2xl bg-white p-4 shadow-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                          <MessageSquare className="size-5" />
                        </div>
                        <div className="flex-1">
                          <p className="mb-1 text-xs font-medium text-gray-900">Document Management System</p>
                          <p className="text-sm leading-relaxed text-gray-700">{getSMSContent().message}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function EmailPreviewPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <EmailPreviewContent />
    </ProtectedRoute>
  )
}
