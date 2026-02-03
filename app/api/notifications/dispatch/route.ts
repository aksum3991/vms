import { NextResponse } from "next/server";
import { getNotificationConfig } from "@/lib/notifications/config";
import { processNotification } from "@/lib/notifications/dispatcher";

export async function POST(req: Request) {
  const cfg = getNotificationConfig();
  const auth = req.headers.get("authorization") ?? "";

  if (!cfg.notificationsDispatchSecret) {
    return NextResponse.json(
      { ok: false, error: "NOTIFICATIONS_DISPATCH_SECRET not configured" },
      { status: 500 },
    );
  }

  if (auth !== `Bearer ${cfg.notificationsDispatchSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as null | {
    notificationId?: string;
  };
  const notificationId = body?.notificationId;

  if (!notificationId) {
    return NextResponse.json(
      { ok: false, error: "Missing notificationId" },
      { status: 400 },
    );
  }

  await processNotification(notificationId);
  return NextResponse.json({ ok: true });
}
