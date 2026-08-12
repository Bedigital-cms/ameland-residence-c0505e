import type { ReactNode } from 'react'

import './globals.css'

/**
 * Root layout is a thin pass-through. The real <html>/<body> (with the correct `lang`/`dir` for
 * the active locale) lives in app/[locale]/layout.tsx, because only that segment knows the locale.
 * Global CSS is imported here so it applies everywhere (including not-found).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
