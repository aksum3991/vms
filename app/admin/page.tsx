
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Bell } from "lucide-react"
import { deleteUser, getSettings, getUsers, saveSettings, saveUser, getBlacklist, saveBlacklistEntry, deleteBlacklistEntry } from "@/lib/actions"
import type { User, Settings, UserRole, BlacklistEntry } from "@/lib/types"
import { ProtectedRoute } from "@/components/protected-route"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"

function AdminContent() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [settings, setSettings] = useState<Settings>({
    approvalSteps: 2,
    emailNotifications: true,
    smsNotifications: true,
    checkInOutNotifications: true,
    gates: ["228", "229", "230"],
    primaryColor: '#06b6d4',
    accentColor: '#0891b2'
  })
  const [initialSettings, setInitialSettings] = useState<Settings>({
    approvalSteps: 2,
    emailNotifications: true,
    smsNotifications: true,
    checkInOutNotifications: true,
    gates: ["228", "229", "230"],
    primaryColor: '#06b6d4',
    accentColor: '#0891b2'
  })

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "requester" as UserRole,
    assignedGates: [] as string[],
    active: true,
  })
  const [newGate, setNewGate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([])
  const [newEntry, setNewEntry] = useState({
    name: "",
    organization: "",
    email: "",
    phone: "",
    reason: "",
    active: true,
  })
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<BlacklistEntry | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [fetchedUsers, fetchedSettings, fetchedBlacklist] = await Promise.all([
        getUsers(), 
        getSettings(),
        getBlacklist()
    ]);
    setUsers(fetchedUsers);
    setSettings(fetchedSettings);
    setInitialSettings(fetchedSettings);
    setBlacklist(fetchedBlacklist);
  }

  const handleAddGate = () => {
    if (newGate && !settings.gates.includes(newGate)) {
      setSettings({
        ...settings,
        gates: [...settings.gates, newGate],
      })
      setNewGate("")
    }
  }

  const handleRemoveGate = (gate: string) => {
    setSettings({
      ...settings,
      gates: settings.gates.filter((g) => g !== gate),
    })
  }

  const handleSaveGates = async () => {
    await saveSettings(settings);
    setInitialSettings(settings);
    toast({ title: "Gate Settings Saved", description: "Your changes to the gates have been saved." });
  }

  const handleCancelGates = () => {
    setSettings(initialSettings);
  }

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields." })
      return
    }

    const existingUser = users.find(u => u.email === newUser.email);
    if (existingUser) {
      toast({ variant: "destructive", title: "User Exists", description: `A user with email "${newUser.email}" already exists.` })
      return
    }
    
    await saveUser({
        ...newUser,
        assignedGates: newUser.role === "reception" ? newUser.assignedGates : [],
    })

    await loadData()
    setNewUser({
      email: "",
      password: "",
      name: "",
      role: "requester",
      assignedGates: [],
      active: true,
    })
    toast({ title: "User Created", description: `User "${newUser.name}" created successfully!` })
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    await saveUser(editingUser)
    await loadData()
    const updatedName = editingUser.name
    setEditingUser(null)
    toast({ title: "User Updated", description: `User "${updatedName}" updated successfully!` })
  }

  const confirmDeleteUser = (user: User) => {
    setUserToDelete(user)
  }

  const handleDeleteUser = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id)
      await loadData()
      toast({ title: "User Deleted", description: `User "${userToDelete.name}" has been deleted.` })
      setUserToDelete(null)
    }
  }

  const handleToggleGateAssignment = (gate: string) => {
    const gates = newUser.assignedGates.includes(gate)
      ? newUser.assignedGates.filter((g) => g !== gate)
      : [...newUser.assignedGates, gate]
    setNewUser({ ...newUser, assignedGates: gates })
  }

  const handleToggleEditingGateAssignment = (gate: string) => {
    if (!editingUser) return
    const gates = editingUser.assignedGates?.includes(gate)
      ? editingUser.assignedGates.filter((g) => g !== gate)
      : [...(editingUser.assignedGates || []), gate]
    setEditingUser({ ...editingUser, assignedGates: gates })
  }

  const handleAddBlacklistEntry = async () => {
    if (!newEntry.name) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Name is required." })
      return
    }
    await saveBlacklistEntry(newEntry)
    await loadData()
    setNewEntry({ name: "", organization: "", email: "", phone: "", reason: "", active: true })
    toast({ title: "Entry Added", description: "Blacklist entry added." })
  }

  const handleUpdateBlacklistEntry = async () => {
    if (!editingEntry) return
    await saveBlacklistEntry(editingEntry)
    await loadData()
    const updatedName = editingEntry.name
    setEditingEntry(null)
    toast({ title: "Entry Updated", description: `Blacklist entry "${updatedName}" updated.` })
  }

  const confirmDeleteBlacklistEntry = (entry: BlacklistEntry) => {
    setEntryToDelete(entry)
  }

  const handleDeleteBlacklistEntry = async () => {
    if (entryToDelete) {
      await deleteBlacklistEntry(entryToDelete.id)
      await loadData()
      toast({ title: "Entry Deleted", description: `Blacklist entry "${entryToDelete.name}" deleted.` })
      setEntryToDelete(null)
    }
  }

  const handleNotificationToggle = (key: keyof Settings, value: boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSaveNotifications = async () => {
    await saveSettings(settings);
    setInitialSettings(settings);
    toast({ title: "Settings Updated", description: "Notification settings have been saved." });
  }

  const handleCancelNotifications = () => {
    setSettings(initialSettings);
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-700"
      case "approver1":
        return "bg-blue-100 text-blue-700"
      case "approver2":
        return "bg-green-100 text-green-700"
      case "reception":
        return "bg-purple-100 text-purple-700"
      case "requester":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const indexOfLastUser = currentPage * itemsPerPage
  const indexOfFirstUser = indexOfLastUser - itemsPerPage
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser)
  const totalPages = Math.ceil(users.length / itemsPerPage)

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-6 text-3xl font-bold text-cyan-600">Admin Settings</h1>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Gate Management */}
            <Card>
              <CardHeader>
                <CardTitle>Gate Management</CardTitle>
                <CardDescription>Add or remove gate numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newGate}
                    onChange={(e) => setNewGate(e.target.value)}
                    placeholder="Enter gate number (e.g., 1, 2, A, B)"
                    className="flex-grow"
                  />
                  <Button onClick={handleAddGate} className="shrink-0">
                    <Plus className="mr-2 size-4" />
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settings.gates.map((gate) => (
                    <Badge key={gate} variant="secondary" className="gap-2 px-3 py-1">
                      Gate {gate}
                      <button
                        onClick={() => handleRemoveGate(gate)}
                        className="text-red-600 hover:text-red-800"
                        aria-label={`Remove gate ${gate}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                 <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancelGates}>Cancel</Button>
                  <Button onClick={handleSaveGates}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="size-5" />
                        Notification Settings
                    </CardTitle>
                    <CardDescription>
                        Enable or disable system notifications.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="email-notifications" className="font-medium">Email Notifications</Label>
                        <Switch
                            id="email-notifications"
                            checked={settings.emailNotifications}
                            onCheckedChange={(checked) => handleNotificationToggle('emailNotifications', checked)}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sms-notifications" className="font-medium">SMS Notifications</Label>
                        <Switch
                            id="sms-notifications"
                            checked={settings.smsNotifications}
                            onCheckedChange={(checked) => handleNotificationToggle('smsNotifications', checked)}
                        />
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="checkinout-notifications" className="font-medium">Check-in/out Alerts</Label>
                        <Switch
                            id="checkinout-notifications"
                            checked={settings.checkInOutNotifications}
                            onCheckedChange={(checked) => handleNotificationToggle('checkInOutNotifications', checked)}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button variant="outline" onClick={handleCancelNotifications}>Cancel</Button>
                        <Button onClick={handleSaveNotifications}>Save Changes</Button>
                    </div>
                </CardContent>
            </Card>


            {/* Blacklist Management */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Blacklist Management</CardTitle>
                <CardDescription>Add or remove blacklisted individuals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bl-name">Name</Label>
                    <Input id="bl-name" value={newEntry.name} onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div>
                    <Label htmlFor="bl-org">Organization</Label>
                    <Input id="bl-org" value={newEntry.organization} onChange={(e) => setNewEntry({ ...newEntry, organization: e.target.value })} placeholder="Organization" />
                  </div>
                  <div>
                    <Label htmlFor="bl-email">Email</Label>
                    <Input id="bl-email" type="email" value={newEntry.email} onChange={(e) => setNewEntry({ ...newEntry, email: e.target.value })} placeholder="email@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="bl-phone">Phone</Label>
                    <Input id="bl-phone" value={newEntry.phone} onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })} placeholder="Phone number" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="bl-reason">Reason</Label>
                    <Input id="bl-reason" value={newEntry.reason} onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })} placeholder="Reason" />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="bl-active" checked={newEntry.active} onChange={(e) => setNewEntry({ ...newEntry, active: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                    <Label htmlFor="bl-active" className="cursor-pointer font-normal">Active</Label>
                  </div>
                </div>
                <Button onClick={handleAddBlacklistEntry}>
                  <Plus className="mr-2 size-4" />
                  Add Entry
                </Button>
                <div className="space-y-3">
                  {blacklist.map((entry) => (
                    <div key={entry.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3 gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{entry.name}</p>
                        <div className="text-sm text-gray-600">
                          {[entry.organization, entry.email, entry.phone].filter(Boolean).join(" • ")}
                        </div>
                        <div className="mt-1 flex items-center flex-wrap gap-2">
                          {entry.active ? <Badge className="bg-red-100 text-red-700">Active</Badge> : <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>}
                          {entry.reason && <span className="text-xs text-gray-500">Reason: {entry.reason}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 self-start sm:self-center">
                        <Button size="sm" variant="outline" onClick={() => setEditingEntry(entry)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => confirmDeleteBlacklistEntry(entry)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Creation */}
            <Card>
              <CardHeader>
                <CardTitle>Add New User</CardTitle>
                <CardDescription>Create a new user account with role assignment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="requester">Requester</option>
                    <option value="approver1">Approver 1</option>
                    <option value="approver2">Approver 2</option>
                    <option value="reception">Reception</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {newUser.role === "reception" && (
                  <div>
                    <Label>Assigned Gates</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {settings.gates.map((gate) => (
                        <Badge
                          key={gate}
                          variant={newUser.assignedGates.includes(gate) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => handleToggleGateAssignment(gate)}
                        >
                          Gate {gate}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="edit-active">Account Status</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-active"
                      checked={newUser.active}
                      onChange={(e) => setNewUser({ ...newUser, active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <Label htmlFor="edit-active" className="cursor-pointer font-normal">
                      Account is active
                    </Label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Inactive accounts cannot log in to the system</p>
                </div>

                <Button onClick={handleAddUser} className="w-full">
                  <Plus className="mr-2 size-4" />
                  Add User
                </Button>
              </CardContent>
            </Card>

            {/* User List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Existing Users</CardTitle>
                <CardDescription>Manage user accounts and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentUsers.map((user) => (
                    <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3 gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <div className="mt-1 flex items-center flex-wrap gap-2">
                          <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                          {user.active === false && <Badge className="bg-red-100 text-red-700">Inactive</Badge>}
                          {user.assignedGates && user.assignedGates.length > 0 && (
                            <span className="text-xs text-gray-500">Gates: {user.assignedGates.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 self-start sm:self-center">
                        <Button size="sm" variant="outline" onClick={() => setEditingUser(user)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => confirmDeleteUser(user)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t pt-4 gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, users.length)} of {users.length} users
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
                          const page = i + 1 + (currentPage > 2 ? currentPage -2 : 0);
                          if (page > totalPages) return null;
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
              </CardContent>
            </Card>

            {/* Edit User Modal */}
            {editingUser && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Edit User</CardTitle>
                  <CardDescription>Update user information and role</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-password">Password (leave blank to keep current)</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      placeholder="Enter new password"
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          password: e.target.value === '' ? editingUser.password : e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-role">Role</Label>
                    <select
                      id="edit-role"
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole, assignedGates: e.target.value === 'reception' ? editingUser.assignedGates || [] : [] })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="requester">Requester</option>
                      <option value="approver1">Approver 1</option>
                      <option value="approver2">Approver 2</option>
                      <option value="reception">Reception</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {editingUser.role === "reception" && (
                    <div>
                      <Label>Assigned Gates</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {settings.gates.map((gate) => (
                          <Badge
                            key={gate}
                            variant={editingUser.assignedGates?.includes(gate) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleToggleEditingGateAssignment(gate)}
                          >
                            Gate {gate}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="edit-active-checkbox">Account Status</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-active-checkbox"
                        checked={editingUser.active !== false}
                        onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <Label htmlFor="edit-active-checkbox" className="cursor-pointer font-normal">
                        Account is active
                      </Label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Inactive accounts cannot log in to the system</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleUpdateUser} className="flex-1">
                      Save Changes
                    </Button>
                    <Button onClick={() => setEditingUser(null)} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {editingEntry && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Edit Blacklist Entry</CardTitle>
                  <CardDescription>Update entry details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="edit-bl-name">Name</Label>
                    <Input id="edit-bl-name" value={editingEntry.name} onChange={(e) => setEditingEntry({ ...editingEntry, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit-bl-org">Organization</Label>
                    <Input id="edit-bl-org" value={editingEntry.organization || ""} onChange={(e) => setEditingEntry({ ...editingEntry, organization: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit-bl-email">Email</Label>
                    <Input id="edit-bl-email" type="email" value={editingEntry.email || ""} onChange={(e) => setEditingEntry({ ...editingEntry, email: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit-bl-phone">Phone</Label>
                    <Input id="edit-bl-phone" value={editingEntry.phone || ""} onChange={(e) => setEditingEntry({ ...editingEntry, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit-bl-reason">Reason</Label>
                    <Input id="edit-bl-reason" value={editingEntry.reason || ""} onChange={(e) => setEditingEntry({ ...editingEntry, reason: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit-bl-active" checked={editingEntry.active} onChange={(e) => setEditingEntry({ ...editingEntry, active: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                    <Label htmlFor="edit-bl-active" className="cursor-pointer font-normal">Active</Label>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleUpdateBlacklistEntry} className="flex-1">Save Changes</Button>
                    <Button onClick={() => setEditingEntry(null)} variant="outline" className="flex-1">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the user account
                for {userToDelete.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {entryToDelete && (
        <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the blacklist entry
                for {entryToDelete.name}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteBlacklistEntry} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminContent />
    </ProtectedRoute>
  )
}

    