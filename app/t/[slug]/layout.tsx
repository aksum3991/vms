import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/tenant-context";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  // Ensure the user is logged in and belongs to this tenant
  // resolveTenantSession will verify the slug matches the session's tenantSlug
  const session = await requireTenantSession(params.slug);

  if (!session) {
    // This should technically be handled by requireTenantSession (it throws or redirects)
    // but we add a safety redirect here just in case.
    redirect("/login");
  }

  return (
    <div className="tenant-container">
      {children}
    </div>
  );
}
