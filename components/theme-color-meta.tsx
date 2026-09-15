'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const LIGHT = '#f9f9ff'
const DARK = '#161b26'

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const color = resolvedTheme === 'dark' ? DARK : LIGHT
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = color
  }, [resolvedTheme])

  return null
}
