"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { getAuditLogs } from "@/lib/actions"
import type { AuditLog } from "@/lib/types"
import { ProtectedRoute } from "@/components/protected-route"

function AuditLogContent() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    const fetchedLogs = await getAuditLogs()
    setLogs(fetchedLogs)
  }

  const exportToCSV = () => {
    let csv = "Timestamp,User,Action,Entity\n";
    logs.forEach(log => {
        csv += `"${log.timestamp}","${log.userName}","${log.action}","${log.entity}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  const indexOfLastLog = currentPage * itemsPerPage
  const indexOfFirstLog = indexOfLastLog - itemsPerPage
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog)
  const totalPages = Math.ceil(logs.length / itemsPerPage)

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create": return "bg-green-100 text-green-700"
      case "update": return "bg-blue-100 text-blue-700"
      case "delete": return "bg-red-100 text-red-700"
      case "login": return "bg-gray-100 text-gray-700"
      default: return "bg-purple-100 text-purple-700"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-cyan-600">Audit Log</h1>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Events</CardTitle>
            <CardDescription>A log of all actions performed within the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLogs.length > 0 ? (
                    currentLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm text-gray-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium text-gray-800">{log.userName}</TableCell>
                        <TableCell>
                          <Badge className={getActionBadgeColor(log.action)}>{log.action}</Badge>
                        </TableCell>
                        <TableCell>{log.entity}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-gray-500">
                        No audit logs found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t pt-4 gap-4">
                    <div className="text-sm text-gray-600">
                        Showing {indexOfFirstLog + 1} to {Math.min(indexOfLastLog, logs.length)} of {logs.length} logs
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="size-4" /> Previous
                        </Button>
                        <span className="text-sm">Page {currentPage} of {totalPages}</span>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AuditLogPage() {
    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <AuditLogContent />
        </ProtectedRoute>
    )
}

