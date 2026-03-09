import { getTenants } from "@/lib/superadmin-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Building2, Users, FileText, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

export default async function SuperAdminDashboard() {
  const tenants = await getTenants();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold tracking-tight">Active Tenants</h2>
        <Button asChild>
          <Link href="/superadmin/tenants/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Tenant
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tenant.name}</CardTitle>
                    <CardDescription>/{tenant.slug}</CardDescription>
                  </div>
                </div>
                <Badge variant={tenant.active ? "default" : "secondary"}>
                  {tenant.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Users</span>
                  </div>
                  <span className="text-2xl font-bold">{tenant._count.users}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Requests</span>
                  </div>
                  <span className="text-2xl font-bold">{tenant._count.requests}</span>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/t/${tenant.slug}/admin`}>
                    <SettingsIcon className="mr-2 h-3 w-3" />
                    Configure
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/superadmin/tenants/${tenant.id}`}>
                    Manage
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tenants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-xl font-medium">No tenants found</h3>
          <p className="text-muted-foreground mt-1">Start by adding your first organization.</p>
          <Button variant="outline" className="mt-6" asChild>
            <Link href="/superadmin/tenants/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add First Tenant
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
