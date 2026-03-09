import db from "@/lib/db";
import { notFound } from "next/navigation";
import { requireSuperAdminSession } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  ArrowLeft, 
  Calendar, 
  Users, 
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import TenantAdminForm from "./admin-form";

interface TenantPageProps {
  params: { id: string };
}

export default async function TenantDetailsPage({ params }: TenantPageProps) {
  await requireSuperAdminSession();

  const tenant = await (db.tenant as any).findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: {
          users: true,
          requests: true,
        }
      }
    }
  });

  if (!tenant) notFound();

  // Fetch current admins for this tenant
  const admins = await db.user.findMany({
    where: { 
      tenantId: tenant.id,
      role: "admin"
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="w-fit -ml-2 text-muted-foreground hover:text-primary">
          <Link href="/superadmin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
                <Badge variant={tenant.active ? "default" : "secondary"} className="h-6">
                  {tenant.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-muted-foreground font-mono text-sm mt-1">/{tenant.slug}</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/t/${tenant.slug}/admin`} className="group">
              Enter Organization Portal
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="p-6 rounded-xl bg-card border shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Users className="h-4 w-4" />
            <span>Personnel</span>
          </div>
          <p className="text-3xl font-bold">{tenant._count.users}</p>
          <p className="text-xs text-muted-foreground mt-2">Active users in organization</p>
        </div>
        <div className="p-6 rounded-xl bg-card border shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Calendar className="h-4 w-4" />
            <span>Activity</span>
          </div>
          <p className="text-3xl font-bold">{tenant._count.requests}</p>
          <p className="text-xs text-muted-foreground mt-2">Total visitor requests processed</p>
        </div>
        <div className="p-6 rounded-xl bg-card border shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <ShieldAlert className="h-4 w-4" />
            <span>Compliance</span>
          </div>
          <p className="text-3xl font-bold">Compliant</p>
          <p className="text-xs text-muted-foreground mt-2">Policies enforced across organization</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <TenantAdminForm tenantId={tenant.id} tenantName={tenant.name} />

        <div className="space-y-4">
          <h3 className="text-xl font-semibold px-1">Organization Administrators</h3>
          <div className="space-y-2">
            {admins.length === 0 ? (
              <div className="p-12 text-center rounded-xl border-2 border-dashed bg-muted/30">
                <p className="text-muted-foreground italic">No administrators assigned yet.</p>
              </div>
            ) : (
              admins.map((admin) => (
                <div key={admin.id} className="p-4 rounded-xl border bg-card flex justify-between items-center group hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {admin.name?.charAt(0) || admin.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{admin.name}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider opacity-60">
                    Administrator
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
