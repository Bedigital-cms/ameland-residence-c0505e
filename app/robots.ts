import type { MetadataRoute } from 'next'

import { activeLocales, canonicalOriginForLocale } from '@/lib/i18n'

/**
 * robots.txt — allow crawling, point at the production sitemap(s). Both production domains serve the
 * same sitemap route; we advertise the per-domain sitemap URL for each active language so a crawler on
 * either domain finds it. Falls back to no sitemap line on preview/dev (no production origin).
 */
export default function robots(): MetadataRoute.Robots {
  const sitemaps = activeLocales()
    .map((l) => canonicalOriginForLocale(l))
    .filter((o): o is string => !!o)
    .map((o) => `${o}/sitemap.xml`)

  return {
    rules: { userAgent: '*', allow: '/' },
    ...(sitemaps.length ? { sitemap: sitemaps } : {}),
  }
}
