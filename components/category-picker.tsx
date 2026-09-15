'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CUSTOM_VALUE = '__custom__'

export function mergeCategories(defaults: string[], extra: string[] = []) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of [...defaults, ...extra]) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

interface CategoryPickerProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
}

export function CategoryPicker({
  value,
  onChange,
  options,
  placeholder = 'Elegí o escribí una categoría',
}: CategoryPickerProps) {
  const known = useMemo(() => mergeCategories(options, value ? [value] : []), [options, value])
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-2">
      <Select
        value={adding ? CUSTOM_VALUE : value || undefined}
        onValueChange={(next) => {
          if (next === CUSTOM_VALUE) {
            setAdding(true)
            onChange('')
            return
          }
          setAdding(false)
          onChange(next)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {known.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Otra (escribir)</SelectItem>
        </SelectContent>
      </Select>
      {adding && (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nombre de la categoría"
        />
      )}
    </div>
  )
}
