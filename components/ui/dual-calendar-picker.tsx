"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { EthDateTime } from "ethiopian-calendar-date-converter"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const ethiopianMonths = [
  "Meskerem (መስከረም)", "Tikimt (ጥቅምት)", "Hidar (ኅዳር)", "Tahsas (ታኅሣሥ)",
  "Tir (ጥር)", "Yakatit (የካቲት)", "Maggabit (መጋቢት)", "Miyazya (ሚያዝያ)",
  "Ginbot (ግንቦት)", "Sene (ሰኔ)", "Hamle (ሐምሌ)", "Nehase (ነሐሴ)", "Pagume (ጳጉሜን)"
]

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

interface DualCalendarPickerProps {
  date?: Date
  onChange?: (date: Date | undefined) => void
  disabledDays?: (date: Date) => boolean
  mode?: "gregorian" | "ethiopian"
  onModeChange?: (mode: "gregorian" | "ethiopian") => void
}

export function DualCalendarPicker({
  date,
  onChange,
  disabledDays,
  mode: externalMode,
  onModeChange
}: DualCalendarPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [internalMode, setInternalMode] = React.useState<"gregorian" | "ethiopian">("gregorian")

  // Use external mode if provided, otherwise internal
  const mode = externalMode || internalMode

  // Sync internal mode if external mode changes
  React.useEffect(() => {
    if (externalMode) setInternalMode(externalMode)
  }, [externalMode])

  const handleModeChange = (newMode: "gregorian" | "ethiopian") => {
    if (onModeChange) {
      onModeChange(newMode)
    } else {
      setInternalMode(newMode)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            mode === "ethiopian" ? (
              (() => {
                try {
                  const eth = EthDateTime.fromEuropeanDate(date)
                  return `${ethiopianMonths[eth.month - 1]} ${eth.date}, ${eth.year}`
                } catch (e) {
                  return format(date, "PPP")
                }
              })()
            ) : (
              format(date, "PPP")
            )
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border shadow-lg outline-hidden" 
        style={{ backgroundColor: 'white', opacity: 1, zIndex: 999999 }}
        align="start"
      >
        <div className="flex items-center justify-between border-b p-3 bg-muted rounded-t-md">
          <Label htmlFor="calendar-mode" className="text-sm font-medium text-muted-foreground transition-colors">
            {mode === "ethiopian" ? "Ethiopian Calendar" : "Gregorian Calendar"}
          </Label>
          <Switch
            id="calendar-mode"
            checked={mode === "ethiopian"}
            onCheckedChange={(checked) => handleModeChange(checked ? "ethiopian" : "gregorian")}
          />
        </div>

        <div className="p-1 rounded-b-md bg-white">
          {mode === "gregorian" ? (
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                onChange?.(d)
                if (d) setIsOpen(false)
              }}
              disabled={disabledDays}
              initialFocus
            />
          ) : (
            <EthiopianCalendar 
              selectedDate={date} 
              onSelect={(d) => {
                onChange?.(d)
                setIsOpen(false)
              }}
              disabledDays={disabledDays} 
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function EthiopianCalendar({ 
  selectedDate, 
  onSelect, 
  disabledDays 
}: { 
  selectedDate?: Date
  onSelect: (date: Date) => void
  disabledDays?: (date: Date) => boolean
}) {
  // Initialize to the selected date or today
  const initialEurDate = selectedDate || new Date()
  const initialEthDate = EthDateTime.fromEuropeanDate(initialEurDate)
  
  const [currentYear, setCurrentYear] = React.useState<number>(initialEthDate.year)
  const [currentMonth, setCurrentMonth] = React.useState<number>(initialEthDate.month) // 1-13

  // Sync view when selectedDate changes from outside (e.g. for syncing From/To)
  React.useEffect(() => {
    if (selectedDate) {
      const normalized = new Date(selectedDate)
      normalized.setHours(12, 0, 0, 0)
      const eth = EthDateTime.fromEuropeanDate(normalized)
      setCurrentYear(eth.year)
      setCurrentMonth(eth.month)
    }
  }, [selectedDate])

  const getDaysInMonth = (year: number, month: number) => {
    if (month < 13) return 30
    return (year + 1) % 4 === 0 ? 6 : 5 // Leap year rule
  }

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(13)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 13) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleDaySelect = (day: number) => {
    const newDate = new EthDateTime(currentYear, currentMonth, day, 12, 0, 0)
    const eurDate = newDate.toEuropeanDate()
    // Normalizing time to midnight for consistency
    eurDate.setHours(0, 0, 0, 0)
    if (disabledDays && disabledDays(eurDate)) return;
    onSelect(eurDate)
  }

  // Calculate grid layout
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  
  // Find weekday of 1st day of month
  // Create an ethDateTime for the 1st of the month
  let startDayEur = new Date()
  try {
     startDayEur = new EthDateTime(currentYear, currentMonth, 1, 12, 0, 0).toEuropeanDate()
  } catch(e) { console.error("Converter error on start date", e) }
  const startWeekday = startDayEur.getDay() // 0-6 (Sun-Sat)

  // Empty cells before the 1st
  const blanks = Array(startWeekday).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Determine if a cell is selected or disabled
  const selectedEthDate = React.useMemo(() => {
    if (!selectedDate) return null
    const normalized = new Date(selectedDate)
    normalized.setHours(12, 0, 0, 0)
    return EthDateTime.fromEuropeanDate(normalized)
  }, [selectedDate])

  return (
    <div className="w-[280px] p-3 bg-white text-slate-900 rounded-b-md">
      <div className="flex items-center justify-between mb-4">
        <Button type="button" variant="outline" size="icon" onClick={handlePrevMonth} className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">
          {ethiopianMonths[currentMonth - 1]} {currentYear}
        </div>
        <Button type="button" variant="outline" size="icon" onClick={handleNextMonth} className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekdays.map(day => (
          <div key={day} className="text-[0.8rem] font-medium text-muted-foreground w-8">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="h-8 w-8" />
        ))}
        {days.map(day => {
          // Compute standard Date object for this cell to check disabled state
          let cellDateEur = new Date();
          try {
             cellDateEur = new EthDateTime(currentYear, currentMonth, day, 12, 0, 0).toEuropeanDate();
             cellDateEur.setHours(0, 0, 0, 0); // normalize
          } catch(e) { }

          const isSelected = !!(selectedEthDate && 
                             selectedEthDate.year === currentYear && 
                             selectedEthDate.month === currentMonth && 
                             selectedEthDate.date === day);
          
          const isDisabled = disabledDays ? disabledDays(cellDateEur) : false;

          return (
            <Button
              key={day}
              type="button"
              variant={isSelected ? "default" : "ghost"}
              className={cn(
                "h-8 w-8 p-0 font-normal hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !isDisabled && handleDaySelect(day)}
              disabled={isDisabled}
              aria-selected={isSelected}
            >
              <span className={cn(isSelected && "font-bold")}>{day}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
