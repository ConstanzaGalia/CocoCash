'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toMonthKey, shiftMonthKey } from '@/lib/utils'

const MONTHS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

interface MonthPickerProps {
  value: string
  onChange: (monthKey: string) => void
  max?: string
  yearsBack?: number
}

export function MonthPicker({ value, onChange, max, yearsBack = 6 }: MonthPickerProps) {
  const currentKey = toMonthKey()
  const maxKey = max ?? currentKey
  const [yearStr, monthStr] = value.split('-')
  const currentYear = Number(currentKey.slice(0, 4))
  const maxYear = Number(maxKey.slice(0, 4))
  const minYear = Math.min(currentYear, maxYear) - yearsBack
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => String(minYear + index))

  const clamp = (next: string) => (next > maxKey ? maxKey : next)

  const setMonth = (month: string) => onChange(clamp(`${yearStr}-${month}`))
  const setYear = (year: string) => onChange(clamp(`${year}-${monthStr}`))

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/50 p-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => onChange(shiftMonthKey(value, -1))}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={monthStr} onValueChange={setMonth}>
        <SelectTrigger className="h-9 w-[8.5rem] border-0 bg-transparent shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((month) => (
            <SelectItem
              key={month.value}
              value={month.value}
              disabled={`${yearStr}-${month.value}` > maxKey}
            >
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={yearStr} onValueChange={setYear}>
        <SelectTrigger className="h-9 w-[5.5rem] border-0 bg-transparent shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={year} disabled={year > String(maxYear)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => onChange(clamp(shiftMonthKey(value, 1)))}
        disabled={value >= maxKey}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
