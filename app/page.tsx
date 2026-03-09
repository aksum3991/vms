import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";

export default async function IndexPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // If superadmin, they might go to /superadmin (we'll create this)
  if (session.role === "superadmin") {
    redirect("/superadmin");
  }

  // If they have a tenant, go to their tenant dashboard
  if (session.tenantSlug) {
    redirect(`/t/${session.tenantSlug}`);
  }

  // Fallback
  redirect("/login");
}
