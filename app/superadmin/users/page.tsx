import { getGlobalUsers } from "@/lib/superadmin-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Building2, ShieldCheck, Mail } from "lucide-react";

export default async function GlobalUsersPage() {
  const users = await getGlobalUsers();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold tracking-tight">System Users</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            A complete list of all users across all tenants on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm flex items-center gap-1">
                        {user.name}
                        {(user.role as string) === "superadmin" && <ShieldCheck className="h-3 w-3 text-red-500" />}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-2 w-2" />
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(user as any).tenant ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {(user as any).tenant.name}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Platform Level</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "default" : "secondary"} className="h-5 text-[10px]">
                      {user.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-10 text-muted-foreground italic">
              No users found in the platform directory.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
