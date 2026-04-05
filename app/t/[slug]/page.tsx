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
import { getSettings, saveRequest, checkBlacklist, getRequestById } from "@/lib/actions";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import ProtectedRoute from "@/components/protected-route";
import Image from "next/image";
import { Suspense } from "react";
import { DualCalendarPicker } from "@/components/ui/dual-calendar-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as XLSX from "xlsx";
import type { Guest } from "@/lib/types";

// Unified class string for the specific focus style you requested
const focusStyles =
  "focus-visible:ring-red-600 focus-visible:border-red-500 focus-visible:bg-[#fffdf4] transition-all duration-200";

function RequestSubmissionPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const duplicateFromId = searchParams?.get("duplicateFrom");
  const editRequestId = searchParams?.get("requestId");
  const slug = params?.slug as string;

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

  const [calendarMode, setCalendarMode] = useState<"gregorian" | "ethiopian">("gregorian");

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
        preferredLanguage: "en",
      },
    ],
  );
  const [blacklistStatus, setBlacklistStatus] = useState<
    ("unknown" | "clear" | "blacklisted")[]
  >(["unknown"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings(slug as string);
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
  }, [user, slug]);

  // Handle Duplication & Editing
  useEffect(() => {
    if (!duplicateFromId && !editRequestId) return;
    
    const loadRequestData = async () => {
      try {
        const targetId = (duplicateFromId || editRequestId) as string;
        const original = await getRequestById(targetId);
        if (original) {
          setFormData(prev => ({
            ...prev,
            destination: original.destination,
            gate: original.gate,
            purpose: original.purpose,
            fromDate: editRequestId ? original.fromDate.split("T")[0] : "", // Keep dates only if editing
            toDate: editRequestId ? original.toDate.split("T")[0] : "",
          }));
          
          // Map guests, removing IDs if duplicating to ensure they are created as new records
          const loadedGuests = original.guests.map(g => ({
            id: editRequestId ? g.id : undefined,
            name: g.name,
            organization: g.organization,
            email: g.email,
            phone: g.phone,
            laptop: g.laptop,
            mobile: g.mobile,
            flash: g.flash,
            otherDevice: g.otherDevice,
            otherDeviceDescription: g.otherDeviceDescription,
            idPhotoUrl: g.idPhotoUrl,
            preferredLanguage: g.preferredLanguage,
          }));
          setGuests(loadedGuests);
          setBlacklistStatus(new Array(loadedGuests.length).fill("clear")); 
          
          if (editRequestId) {
            toast({ title: "Draft Loaded", description: "You can now continue editing your drafted request." });
          } else {
            toast({ title: "Request Duplicated", description: "Original details pre-filled. Please select new dates." });
          }
        }
      } catch (err) {
        console.error("Data load failed:", err);
      }
    };
    loadRequestData();
  }, [duplicateFromId, editRequestId, toast]);

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
      } else {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: "No valid guest data found. Please use the provided template.",
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent, status: "draft" | "submitted" = "submitted") => {
    if (e) e.preventDefault();
    
    // Strict validation only if status is "submitted"
    if (status === "submitted") {
      if (!formData.destination || !formData.gate || !formData.fromDate || !formData.toDate || !formData.purpose) {
        toast({ variant: "destructive", title: "Form Incomplete", description: "All fields are required to submit a request." });
        return;
      }
      
      const fromDate = new Date(formData.fromDate);
      const toDate = new Date(formData.toDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (fromDate < today) {
        toast({ variant: "destructive", title: "Invalid Date", description: "The start date cannot be in the past." });
        return;
      }

      if (toDate < fromDate) {
        toast({ variant: "destructive", title: "Invalid Date", description: "The end date cannot be before the start date." });
        return;
      }

      const invalidGuest = guests.find(g => !g.name || !g.organization);
      if (invalidGuest) {
        toast({ variant: "destructive", title: "Guest Info Incomplete", description: "All guests must have a name and organization." });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await saveRequest({
        ...formData,
        status,
        id: editRequestId || undefined,
        guests: guests as any[],
      });
      
      toast({ 
        title: status === "draft" ? "Draft Saved" : "Request Submitted", 
        description: status === "draft" ? "Your progress has been saved." : "Your request has been sent for approval." 
      });
      
      window.location.href = `/t/${slug}/requester`;
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: error.message || "Failed to save request." 
      });
    } finally {
      setIsSubmitting(false);
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
                <div className="mt-1">
                  <DualCalendarPicker
                    date={formData.fromDate ? new Date(formData.fromDate) : undefined}
                    mode={calendarMode}
                    onModeChange={setCalendarMode}
                    onChange={(d) => {
                      if (d) {
                         const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0]
                         // If "To" date exists and is before the new "From" date, clear it
                         const isToDateInvalid = formData.toDate && new Date(formData.toDate) < d;
                         setFormData(prev => ({ 
                           ...prev, 
                           fromDate: isoStr,
                           ...(isToDateInvalid && { toDate: "" })
                         }))
                      } else {
                         setFormData({ ...formData, fromDate: "" })
                      }
                    }}
                    disabledDays={(d) => {
                      const today = new Date()
                      today.setHours(0,0,0,0)
                      return d < today
                    }}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="toDate">To Date *</Label>
                <div className="mt-1">
                  <DualCalendarPicker
                    date={formData.toDate ? new Date(formData.toDate) : undefined}
                    mode={calendarMode}
                    onModeChange={setCalendarMode}
                    onChange={(d) => {
                      if (d) {
                         const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0]
                         setFormData({ ...formData, toDate: isoStr })
                      } else {
                         setFormData({ ...formData, toDate: "" })
                      }
                    }}
                    disabledDays={(d) => {
                      if (!formData.fromDate) {
                         const today = new Date()
                         today.setHours(0,0,0,0)
                         return d < today
                      }
                      const minDate = new Date(formData.fromDate)
                      minDate.setHours(0,0,0,0)
                      return d < minDate
                    }}
                  />
                </div>
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download the template file, fill it, and upload it here.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                    <TableHead className="min-w-[80px]">Lang</TableHead>
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
                          placeholder="Email"
                          className={`h-9 ${focusStyles}`}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <select
                          value={guest.preferredLanguage || "en"}
                          onChange={(e) =>
                            updateGuest(index, "preferredLanguage", e.target.value)
                          }
                          className={`h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 ${focusStyles}`}
                        >
                          <option value="en">EN</option>
                          <option value="am">AM</option>
                        </select>
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

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => handleSubmit(e, "draft")}
              className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Save as Draft
            </Button>
            <Button
              type="submit"
              onClick={(e) => handleSubmit(e, "submitted")}
              className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700"
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
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <RequestSubmissionPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
