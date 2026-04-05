import { format } from "date-fns"
import { EthDateTime } from "ethiopian-calendar-date-converter"

const ethiopianMonths = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas",
  "Tir", "Yakatit", "Maggabit", "Miyazya",
  "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
]

/**
 * Formats a date into a consistent "Gregorian (Ethiopian)" string.
 * Example: "April 1, 2026 (Maggabit 23, 2018)"
 */
export function formatDateForDisplay(isoString: string | Date | undefined, includeTime = false) {
  if (!isoString) return "N/A"
  
  const date = typeof isoString === "string" ? new Date(isoString) : isoString
  
  // Standard Gregorian Format
  const gregStr = format(date, includeTime ? "PPP p" : "PPP")
  
  try {
    // Normalize to mid-day for reliable Ethiopian conversion
    const normalized = new Date(date)
    normalized.setHours(12, 0, 0, 0)
    const eth = EthDateTime.fromEuropeanDate(normalized)
    const ethStr = `${ethiopianMonths[eth.month - 1]} ${eth.date}, ${eth.year}`
    
    return `${gregStr} (${ethStr})`
  } catch (e) {
    console.error("Ethiopian date conversion error:", e)
    return gregStr
  }
}
