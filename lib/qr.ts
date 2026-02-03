import QRCode from "qrcode"

export async function generateQRCode(data: string) {
  // returns PNG buffer and Data URL
  const dataUrl = await QRCode.toDataURL(data, { margin: 1, scale: 6 })
  // strip header and convert to buffer
  const base64 = dataUrl.split(",")[1]
  const pngBuffer = Buffer.from(base64, "base64")
  return { pngBuffer, dataUrl }
}