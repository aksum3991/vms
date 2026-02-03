import nodemailer from "nodemailer"
import { generateQRCode } from "./qr"

export async function sendGuestInvitationEmail(guestEmail: string, subject: string, htmlBody: string, qrPayload?: string) {
  const transporter = nodemailer.createTransport(/* ...existing transport config... */)

  const attachments: any[] = []
  let embeddedImgHtml = ""
  if (qrPayload) {
    const { pngBuffer } = await generateQRCode(qrPayload)
    attachments.push({
      filename: "qr.png",
      content: pngBuffer,
      cid: "guest-qr@vms",
    })
    // inline image and download link (API route uses ?data=...)
    embeddedImgHtml = `<p><img src="cid:guest-qr@vms" alt="QR code" style="max-width:200px"/></p>
    <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/api/qr?data=${encodeURIComponent(qrPayload)}" target="_blank">Download QR Code</a></p>`
  }

  await transporter.sendMail({
    from: '"VMS" <no-reply@yourdomain.com>',
    to: guestEmail,
    subject,
    html: htmlBody + embeddedImgHtml,
    attachments,
  })
}