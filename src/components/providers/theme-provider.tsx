'use client'

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: string
  enableSystem?: boolean
  attribute?: 'class' | 'data-theme'
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      storageKey="app-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
} 