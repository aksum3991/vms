import { NextResponse } from "next/server"
import { generateQRCode } from "@/lib/qr"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const data = url.searchParams.get("data")
  if (!data) return NextResponse.json({ error: "missing data" }, { status: 400 })

  const { pngBuffer } = await generateQRCode(data)
  return new NextResponse(pngBuffer, {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="qr-${encodeURIComponent(data)}.png"` },
  })
}