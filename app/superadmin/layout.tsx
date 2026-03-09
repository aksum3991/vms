import { requireSuperAdminSession } from "@/lib/tenant-context";
import { Navigation } from "@/components/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce superadmin role
  await requireSuperAdminSession();

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-700">Platform Administration</h1>
          <p className="text-muted-foreground">
            Managing tenants, global settings, and platform-level users.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
