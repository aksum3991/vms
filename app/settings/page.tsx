
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Users, Workflow, Settings, Plus, X, ChevronLeft, ChevronRight } from "lucide-react"
import { getSettings, getUsers, saveSettings, saveUser, testEmailGateway, testSmsGateway } from "@/lib/actions"
import type { Settings as SettingsType, User } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { ProtectedRoute } from "@/components/protected-route"

function SettingsContent() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SettingsType>({
    gates: [],
    approvalSteps: 2,
    emailNotifications: true,
    smsNotifications: true,
    checkInOutNotifications: true,
    primaryColor: "#06b6d4",
    accentColor: "#0891b2",
  })
  const [initialSettings, setInitialSettings] = useState<SettingsType>({
    gates: [],
    approvalSteps: 2,
    emailNotifications: true,
    smsNotifications: true,
    checkInOutNotifications: true,
    primaryColor: "#06b6d4",
    accentColor: "#0891b2",
  })
  const [users, setUsers] = useState<User[]>([])
  const [newGate, setNewGate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [testEmailTo, setTestEmailTo] = useState("")
  const [testSmsTo, setTestSmsTo] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [fetchedSettings, fetchedUsers] = await Promise.all([getSettings(), getUsers()])
    setSettings(fetchedSettings)
    setInitialSettings(fetchedSettings) // Store initial state
    setUsers(fetchedUsers)
  }

  const handleSettingChange = (key: keyof SettingsType, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = async () => {
    await saveSettings(settings)
    setInitialSettings(settings) // Update initial state to the new saved state
    toast({ variant: "success", title: "Settings Saved", description: "Your changes have been saved successfully." })
  }

  const handleCancelSettings = () => {
    setSettings(initialSettings)
  }

  const handleAddGate = () => {
    if (newGate && !settings.gates.includes(newGate)) {
      setSettings(prev => ({ ...prev, gates: [...prev.gates, newGate] }))
      setNewGate("")
    }
  }

  const handleRemoveGate = (gate: string) => {
    setSettings(prev => ({ ...prev, gates: prev.gates.filter((g) => g !== gate) }))
  }

  const handleUpdateUserRole = async (userId: string, newRole: User["role"]) => {
    const user = users.find((u) => u.id === userId)
    if (user) {
      const updatedUser = { ...user, role: newRole }
      await saveUser(updatedUser)
      await loadData()
      toast({ variant: "success", title: "User Role Updated", description: `${user.name}'s role has been changed to ${newRole}.` })
    }
  }

  const indexOfLastUser = currentPage * itemsPerPage
  const indexOfFirstUser = indexOfLastUser - itemsPerPage
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser)
  const totalPages = Math.ceil(users.length / itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 pb-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-cyan-600">System Settings</h1>
          <p className="mt-1 text-sm text-gray-600">Configure system preferences and user management</p>
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="notifications">
              <Bell className="mr-2 size-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 size-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="approval">
              <Workflow className="mr-2 size-4" />
              Approval
            </TabsTrigger>
            <TabsTrigger value="gates">
              <Settings className="mr-2 size-4" />
              Gates
            </TabsTrigger>
          </TabsList>

          {/* Notifications Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure how and when notifications are sent to users and guests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Email Notifications</h3>
                      <p className="text-sm text-gray-600">Enable system-wide emails</p>
                    </div>
                    <Switch
                      checked={settings.emailNotifications}
                      onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">SMS Notifications</h3>
                      <p className="text-sm text-gray-600">Enable system-wide SMS</p>
                    </div>
                    <Switch
                      checked={settings.smsNotifications}
                      onCheckedChange={(checked) => handleSettingChange('smsNotifications', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Check-in/out Alerts</h3>
                      <p className="text-sm text-gray-600">Notify on guest arrival/departure</p>
                    </div>
                    <Switch
                      checked={settings.checkInOutNotifications}
                      onCheckedChange={(checked) => handleSettingChange('checkInOutNotifications', checked)}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="p-6">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">SMTP Configuration</h3>
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="smtpHost">SMTP Host</Label>
                          <Input
                            id="smtpHost"
                            value={settings.smtpHost || ""}
                            onChange={(e) => handleSettingChange('smtpHost', e.target.value)}
                            placeholder="smtp.example.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="smtpPort">SMTP Port</Label>
                          <Input
                            id="smtpPort"
                            type="number"
                            value={settings.smtpPort?.toString() || ""}
                            onChange={(e) => handleSettingChange('smtpPort', Number(e.target.value) || undefined)}
                            placeholder="587"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="smtpUser">SMTP User</Label>
                        <Input
                          id="smtpUser"
                          value={settings.smtpUser || ""}
                          onChange={(e) => handleSettingChange('smtpUser', e.target.value)}
                          placeholder="user@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtpPassword">SMTP Password</Label>
                        <Input
                          id="smtpPassword"
                          type="password"
                          value={settings.smtpPassword || ""}
                          onChange={(e) => handleSettingChange('smtpPassword', e.target.value)}
                          placeholder="Enter SMTP password"
                          className="transition-all duration-200"
                        />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-6">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">SMS Gateway (HTTP)</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="smsGatewayUrl">Gateway URL</Label>
                        <Input
                          id="smsGatewayUrl"
                          value={settings.smsGatewayUrl || ""}
                          onChange={(e) => handleSettingChange('smsGatewayUrl', e.target.value)}
                          placeholder="https://sms-gateway.example/send"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smsApiKey">API Key</Label>
                        <Input
                          id="smsApiKey"
                          type="password"
                          value={settings.smsApiKey || ""}
                          onChange={(e) => handleSettingChange('smsApiKey', e.target.value)}
                          placeholder="Enter SMS gateway API key"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Label htmlFor="testSmsTo">Test recipient phone</Label>
                          <Input
                            id="testSmsTo"
                            value={testSmsTo}
                            onChange={(e) => setTestSmsTo(e.target.value)}
                            placeholder="+2519xxxxxxx"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (!testSmsTo.trim()) {
                                toast({ variant: "destructive", title: "Phone required", description: "Enter a phone number to test SMS." })
                                return
                              }
                              const res = await testSmsGateway(testSmsTo.trim(), settings)
                              if (res.ok) {
                                toast({ variant: "success", title: "SMS Test Sent", description: `Gateway connection verified successfully.` })
                              } else {
                                toast({ variant: "destructive", title: "SMS Test Failed", description: res.error || "Gateway error" })
                              }
                            }}
                          >
                            Test SMS
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">If provided, the system will POST to this endpoint for SMS.</p>
                    </div>
                  </Card>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="p-6">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">SMTP Email Test</h3>
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Label htmlFor="testEmailTo">Test recipient email</Label>
                          <Input
                            id="testEmailTo"
                            type="email"
                            value={testEmailTo}
                            onChange={(e) => setTestEmailTo(e.target.value)}
                            placeholder="user@example.com"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (!testEmailTo.trim()) {
                                toast({ variant: "destructive", title: "Email required", description: "Enter an email address to test." })
                                return
                              }
                              const res = await testEmailGateway(testEmailTo.trim(), settings)
                              if (res.ok) {
                                toast({ variant: "success", title: "Email Test Sent", description: "SMTP accepted the message." })
                              } else {
                                toast({ variant: "destructive", title: "Email Test Failed", description: res.error || "SMTP error" })
                              }
                            }}
                          >
                            Test Email
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">Uses the SMTP configuration above to send a test email.</p>
                    </div>
                  </Card>
                  <div />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t pt-6">
                <Button variant="outline" onClick={handleCancelSettings}>Cancel</Button>
                <Button onClick={handleSaveSettings}>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users">
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">User Management</h2>
              <p className="mb-6 text-sm text-gray-600">Manage user roles and permissions.</p>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-3 text-left text-sm font-medium text-gray-700">Name</th>
                      <th className="pb-3 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="pb-3 text-left text-sm font-medium text-gray-700">Current Role</th>
                      <th className="pb-3 text-left text-sm font-medium text-gray-700">Change Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="py-3 text-sm font-medium text-gray-900">{user.name}</td>
                        <td className="py-3 text-sm text-gray-600">{user.email}</td>
                        <td className="py-3">
                          <Badge
                            variant={
                              user.role === "admin"
                                ? "destructive"
                                : user.role === "approver1"
                                  ? "secondary"
                                  : user.role === "approver2"
                                    ? "secondary"
                                    : user.role === "reception"
                                      ? "outline"
                                      : "outline"
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value as User["role"])}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="requester">Requester</option>
                            <option value="approver1">Approver 1</option>
                            <option value="approver2">Approver 2</option>
                            <option value="reception">Reception</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, users.length)} of {users.length} users
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const page = i + 1
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
                      {totalPages > 5 && <span className="px-2">...</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Approval Settings */}
          <TabsContent value="approval">
            <Card>
                <CardHeader>
                    <CardTitle>Approval Workflow</CardTitle>
                    <CardDescription>Configure approval steps and workflow.</CardDescription>
                </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="approvalSteps" className="mb-2 block text-sm font-medium">
                    Number of Approval Steps
                  </Label>
                  <select
                    id="approvalSteps"
                    value={settings.approvalSteps}
                    onChange={(e) => handleSettingChange('approvalSteps', Number(e.target.value) as 1 | 2)}
                    className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value={1}>1 Step (Single Approver)</option>
                    <option value={2}>2 Steps (Two Approvers)</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    Choose how many approval levels are required before a request is fully approved.
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-3 font-medium text-gray-900">Current Workflow</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">
                        1
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">Requester submits request</p>
                        <p className="text-gray-600">Initial submission with guest details</p>
                      </div>
                    </div>

                    <div className="ml-4 border-l-2 border-gray-300 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">
                          2
                        </div>
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Approver 1 reviews</p>
                          <p className="text-gray-600">First level approval</p>
                        </div>
                      </div>
                    </div>

                    {settings.approvalSteps === 2 && (
                      <div className="ml-4 border-l-2 border-gray-300 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">
                            3
                          </div>
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">Approver 2 reviews</p>
                            <p className="text-gray-600">Second level approval (final)</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="ml-4 border-l-2 border-gray-300 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                          ✓
                        </div>
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Notifications sent</p>
                          <p className="text-gray-600">Email & SMS to requester and guests</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
               <CardFooter className="flex justify-end gap-2 border-t pt-6">
                <Button variant="outline" onClick={handleCancelSettings}>Cancel</Button>
                <Button onClick={handleSaveSettings}>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Gates Settings */}
          <TabsContent value="gates">
            <Card>
                <CardHeader>
                    <CardTitle>Gate Management</CardTitle>
                    <CardDescription>Configure available gates for visitor entry.</CardDescription>
                </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Label htmlFor="newGate" className="mb-2 block text-sm font-medium">
                    Add New Gate
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="newGate"
                      value={newGate}
                      onChange={(e) => setNewGate(e.target.value)}
                      placeholder="Enter gate number or name"
                      className="max-w-xs"
                    />
                    <Button onClick={handleAddGate} variant="outline">
                      <Plus className="mr-2 size-4" />
                      Add Gate
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block text-sm font-medium">Current Gates</Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {settings.gates.map((gate) => (
                      <div
                        key={gate}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <span className="font-medium text-gray-900">Gate {gate}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveGate(gate)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t pt-6">
                <Button variant="outline" onClick={handleCancelSettings}>Cancel</Button>
                <Button onClick={handleSaveSettings}>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function SettingsPage() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <SettingsContent />
        </ProtectedRoute>
    )
}
