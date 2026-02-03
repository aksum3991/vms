"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  ShieldX,
  ShieldCheck,
  Image as ImageIcon,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { getSettings, saveRequest, checkBlacklist } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import ProtectedRoute from "@/components/protected-route";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";
import type { Guest } from "@/lib/types";

// Unified class string for the specific focus style you requested
const focusStyles =
  "focus-visible:ring-red-600 focus-visible:border-red-500 focus-visible:bg-[#fffdf4] transition-all duration-200";

function RequestSubmissionPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableGates, setAvailableGates] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    requestedBy: "",
    requestedByEmail: "",
    destination: "",
    gate: "",
    fromDate: "",
    toDate: "",
    purpose: "",
    requestedById: "",
  });

  const [guests, setGuests] = useState<(Omit<Guest, "id"> & { id?: string })[]>(
    [
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
      },
    ],
  );
  const [blacklistStatus, setBlacklistStatus] = useState<
    ("unknown" | "clear" | "blacklisted")[]
  >(["unknown"]);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      setAvailableGates(settings.gates || []);

      if (user) {
        setFormData((prev) => ({
          ...prev,
          requestedBy: user.name,
          requestedByEmail: user.email || "",
          requestedById: user.id,
        }));
      }
    };
    loadSettings();
  }, [user]);

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
      },
    ]);
    setBlacklistStatus([...blacklistStatus, "unknown"]);
  };

  const removeGuest = (index: number) => {
    if (guests.length > 1) {
      setGuests(guests.filter((_, i) => i !== index));
      setBlacklistStatus(blacklistStatus.filter((_, i) => i !== index));
    }
  };

  const updateGuest = (
    index: number,
    field: keyof Omit<Guest, "id">,
    value: any,
  ) => {
    const newGuests = guests.map((g, i) =>
      i === index ? { ...g, [field]: value } : g,
    );
    setGuests(newGuests);
    if (["name", "organization", "email"].includes(field)) {
      const g = newGuests[index];
      checkBlacklist({
        name: g.name,
        organization: g.organization,
        email: g.email,
        phone: g.phone,
      })
        .then((res) => {
          const next = [...blacklistStatus];
          next[index] = res.blacklisted ? "blacklisted" : "clear";
          setBlacklistStatus(next);
        })
        .catch(() => {
          const next = [...blacklistStatus];
          next[index] = "unknown";
          setBlacklistStatus(next);
        });
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () =>
        updateGuest(index, "idPhotoUrl", reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleExportTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Guest Name (Required)": "John Doe",
        "Organization (Required)": "Acme Corp",
        "Email (Optional)": "john@example.com",
        "Laptop (Yes/No)": "Yes",
        "Mobile (Yes/No)": "Yes",
        "Flash Drive (Yes/No)": "No",
        "Other Device (Yes/No)": "No",
        "Other Device Description": "",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "GuestListTemplate.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const data = XLSX.utils.sheet_to_json(
        wb.Sheets[wb.SheetNames[0]],
      ) as any[];
      const validGuests = data
        .map((row) => ({
          name: row["Guest Name (Required)"] || "",
          organization: row["Organization (Required)"] || "",
          email: row["Email (Optional)"] || "",
          phone: "",
          laptop: row["Laptop (Yes/No)"]?.toString().toLowerCase() === "yes",
          mobile: row["Mobile (Yes/No)"]?.toString().toLowerCase() === "yes",
          flash:
            row["Flash Drive (Yes/No)"]?.toString().toLowerCase() === "yes",
          otherDevice:
            row["Other Device (Yes/No)"]?.toString().toLowerCase() === "yes",
          otherDeviceDescription: row["Other Device Description"] || "",
          idPhotoUrl: "",
        }))
        .filter((g) => g.name || g.organization);

      if (validGuests.length > 0) {
        setGuests((prev) =>
          prev.length === 1 && !prev[0].name
            ? validGuests
            : [...prev, ...validGuests],
        );
        setBlacklistStatus((prev) => [
          ...prev,
          ...new Array(validGuests.length).fill("unknown"),
        ]);
        toast({
          title: "Import Successful",
          description: `Imported ${validGuests.length} guests.`,
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const request = { ...formData, guests, status: "submitted" as const };
    try {
      await saveRequest(request);
      toast({ variant: "success", title: "Request Submitted Successfully!" });
      router.refresh();
    } catch (error) {
      toast({ variant: "destructive", title: "Submission Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Card className="mx-auto max-w-7xl bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-6 text-2xl font-bold text-cyan-600">
          Request Approval
        </h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Request Details
            </h3>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="requestedBy">Requested By *</Label>
                <Input
                  id="requestedBy"
                  value={formData.requestedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, requestedBy: e.target.value })
                  }
                  readOnly={!!user}
                  className={`${user ? "bg-gray-50" : ""} ${focusStyles}`}
                  required
                />
              </div>

              <div>
                <Label htmlFor="requestedByEmail">Email</Label>
                <Input
                  id="requestedByEmail"
                  type="email"
                  value={formData.requestedByEmail}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requestedByEmail: e.target.value,
                    })
                  }
                  readOnly={!!user}
                  className={`${user ? "bg-gray-50" : ""} ${focusStyles}`}
                />
              </div>

              <div>
                <Label htmlFor="destination">Destination Office *</Label>
                <Input
                  id="destination"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destination: e.target.value })
                  }
                  placeholder="e.g., ICT Department"
                  className={focusStyles}
                  required
                />
              </div>

              <div>
                <Label htmlFor="gate">Gate Number *</Label>
                <select
                  id="gate"
                  value={formData.gate}
                  onChange={(e) =>
                    setFormData({ ...formData, gate: e.target.value })
                  }
                  required
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 transition-all ${focusStyles}`}
                >
                  <option value="">Select a gate</option>
                  {availableGates.map((gate) => (
                    <option key={gate} value={gate}>
                      Gate {gate}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="fromDate">From Date *</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={formData.fromDate}
                  onChange={(e) =>
                    setFormData({ ...formData, fromDate: e.target.value })
                  }
                  className={focusStyles}
                  required
                />
              </div>

              <div>
                <Label htmlFor="toDate">To Date *</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={formData.toDate}
                  onChange={(e) =>
                    setFormData({ ...formData, toDate: e.target.value })
                  }
                  className={focusStyles}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="purpose">Purpose / Detailed Reason *</Label>
              <Textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
                placeholder="Describe the purpose of the visit in detail..."
                rows={4}
                className={focusStyles}
                required
              />
            </div>
          </div>

          {/* Guest List Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Guest List
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  onClick={handleExportTemplate}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Download className="mr-2 size-4" /> Template
                </Button>
                <div className="relative flex-1 sm:flex-none">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportExcel}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <FileSpreadsheet className="mr-2 size-4" /> Import
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={addGuest}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Plus className="mr-2 size-4" /> Add Row
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] p-2 text-center">
                      #
                    </TableHead>
                    <TableHead className="min-w-[150px]">Name *</TableHead>
                    <TableHead className="min-w-[150px]">
                      Organization *
                    </TableHead>
                    <TableHead className="min-w-[150px]">Email</TableHead>
                    <TableHead className="w-[100px] text-center">
                      ID / Photo
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      Allowed Devices
                    </TableHead>
                    <TableHead className="w-[50px] text-center p-2">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guests.map((guest, index) => (
                    <TableRow
                      key={index}
                      className="align-middle hover:bg-gray-50"
                    >
                      <TableCell className="p-2 text-center text-sm text-gray-500 font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="p-2">
                        <div className="relative">
                          <Input
                            value={guest.name}
                            onChange={(e) =>
                              updateGuest(index, "name", e.target.value)
                            }
                            placeholder="Guest Name"
                            required
                            className={`h-9 ${focusStyles} ${blacklistStatus[index] === "blacklisted" ? "border-red-500 pr-8" : blacklistStatus[index] === "clear" ? "border-green-500 pr-8" : ""}`}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {blacklistStatus[index] === "blacklisted" && (
                              <ShieldX className="size-4 text-red-500" />
                            )}
                            {blacklistStatus[index] === "clear" && (
                              <ShieldCheck className="size-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          value={guest.organization}
                          onChange={(e) =>
                            updateGuest(index, "organization", e.target.value)
                          }
                          placeholder="Organization"
                          required
                          className={`h-9 ${focusStyles}`}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="email"
                          value={guest.email}
                          onChange={(e) =>
                            updateGuest(index, "email", e.target.value)
                          }
                          placeholder="Email (Optional)"
                          className={`h-9 ${focusStyles}`}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <div className="flex justify-center">
                          <label
                            htmlFor={`idPhoto-${index}`}
                            className="flex h-9 w-12 cursor-pointer items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 transition-colors"
                          >
                            {guest.idPhotoUrl ? (
                              <div className="relative size-full overflow-hidden rounded">
                                <Image
                                  src={guest.idPhotoUrl}
                                  alt="ID"
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <ImageIcon className="size-5 text-gray-500" />
                            )}
                          </label>
                          <input
                            id={`idPhoto-${index}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, index)}
                            className="hidden"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="p-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {["laptop", "mobile", "flash"].map((device) => (
                            <div
                              key={device}
                              className="flex items-center gap-1.5"
                            >
                              <Checkbox
                                id={`${device}-${index}`}
                                checked={(guest as any)[device]}
                                onCheckedChange={(checked) =>
                                  updateGuest(index, device as any, checked)
                                }
                              />
                              <Label
                                htmlFor={`${device}-${index}`}
                                className="text-xs cursor-pointer capitalize"
                              >
                                {device}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGuest(index)}
                          disabled={guests.length === 1}
                          className="h-8 w-8 text-red-500"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="submit"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function RequestSubmissionPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "requester"]}>
      <RequestSubmissionPageContent />
    </ProtectedRoute>
  );
}
