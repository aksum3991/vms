import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getEmailProviderFromEnvOrSettings } from "@/lib/notifications/providers/email";

/**
 * GET /api/admin/notify-diag?tenantId=xxx
 *
 * Returns:
 *   - settings row (SMTP fields + notification flags, password masked)
 *   - last 20 NotificationDispatch records
 *   - emailProviderName: which provider would be used
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") ?? undefined;

    // 1. Settings row
    const settingsRow = tenantId
      ? await db.settings.findFirst({ where: { tenantId } })
      : await db.settings.findFirst({ where: {} });

    const settingsSummary = settingsRow
      ? {
          tenantId: settingsRow.tenantId,
          emailNotifications: (settingsRow as any).emailNotifications,
          smsNotifications: (settingsRow as any).smsNotifications,
          smtpHost: (settingsRow as any).smtpHost ?? null,
          smtpPort: (settingsRow as any).smtpPort ?? null,
          smtpUser: (settingsRow as any).smtpUser ?? null,
          smtpPassword: (settingsRow as any).smtpPassword ? "***SET***" : null,
          emailGatewayUrl: (settingsRow as any).emailGatewayUrl ?? null,
        }
      : null;

    // 2. Which email provider would actually be resolved?
    let emailProviderName: string | null = null;
    try {
      const provider = await getEmailProviderFromEnvOrSettings(
        settingsRow ?? undefined,
        tenantId,
      );
      emailProviderName = provider ? (provider as any).constructor?.name : null;
    } catch (e: any) {
      emailProviderName = `ERROR: ${e?.message}`;
    }

    // 3. Last 20 dispatch records (newest first)
    const dispatches = await db.notificationDispatch.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        channel: true,
        recipient: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        provider: true,
        createdAt: true,
        tenantId: true,
      },
    });

    return NextResponse.json({
      settings: settingsSummary,
      emailProviderName,
      dispatches,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * POST /api/admin/notify-diag
 * Body: { tenantId, to }
 * Sends a live test email using the resolved provider for that tenant.
 */
export async function POST(req: Request) {
  try {
    const { tenantId, to } = await req.json();
    if (!to) return NextResponse.json({ error: "Missing 'to' email" }, { status: 400 });

    const settingsRow = tenantId
      ? await db.settings.findFirst({ where: { tenantId } })
      : await db.settings.findFirst({ where: {} });

    const provider = await getEmailProviderFromEnvOrSettings(
      settingsRow ?? undefined,
      tenantId ?? undefined,
    );

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: "No email provider could be resolved. Check SMTP settings in Admin.",
      });
    }

    await provider.send({
      to,
      subject: "VMS3 Notification Diagnostic Test",
      text: `This is a live diagnostic test from the VMS3 notification system.\n\nTenant: ${tenantId ?? "(none)"}\nProvider: ${(provider as any).constructor?.name}\nTime: ${new Date().toISOString()}`,
    });

    return NextResponse.json({ success: true, provider: (provider as any).constructor?.name });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * PUT /api/admin/notify-diag
 * Body: { tenantId }
 * Force-enables emailNotifications for a tenant.
 */
export async function PUT(req: Request) {
  try {
    const { tenantId } = await req.json();
    const tid = tenantId || "default-tenant-id";

    await db.settings.updateMany({
      where: { tenantId: tid },
      data: { emailNotifications: true, smsNotifications: true },
    });

    const updated = await db.settings.findFirst({ where: { tenantId: tid } });

    return NextResponse.json({
      success: true,
      emailNotifications: (updated as any)?.emailNotifications,
      smsNotifications: (updated as any)?.smsNotifications,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
