'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Minimal dataLayer route context for GTM, compatible with Next.js client-side navigation.
 *
 * The server bootstrap (`lib/analytics.ts`) seeds the FIRST page's context. This keeps `page_path`
 * (and a coarse `page_type`) fresh on every subsequent in-app navigation, so GTM tags that read the
 * dataLayer always see the current page. It pushes DATA ONLY — no `event` — so it never triggers an
 * extra pageview (GTM's own History Change trigger owns SPA pageviews). No PII is ever pushed.
 */
function pageType(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/'
  // Strip a leading /nl or /de prefix (preview hosts) before classifying.
  const bare = clean.replace(/^\/(nl|de)(?=\/|$)/, '') || '/'
  return bare === '/' ? 'home' : 'content'
}

export function DataLayer({ tenant, locale }: { tenant?: string; locale: string }) {
  const pathname = usePathname()
  const firstRun = useRef(true)

  useEffect(() => {
    // The server already seeded the initial context; only react to real navigations.
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({
      ...(tenant ? { tenant } : {}),
      locale,
      page_path: pathname,
      page_type: pageType(pathname || '/'),
    })
  }, [pathname, tenant, locale])

  return null
}
