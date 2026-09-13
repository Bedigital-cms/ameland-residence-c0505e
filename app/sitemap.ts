import type { MetadataRoute } from 'next'

import { getBlogs } from '@/content/blogs'
import { getPages, hubBase } from '@/content/pages'
import { getVillas } from '@/content/villas'
import { activeLocales, canonicalOriginForLocale } from '@/lib/i18n'

/**
 * XML sitemap using the FINAL production, per-domain, prefix-free URLs (nl → www.ameland-residence.nl,
 * de → www.ameland-residence.de). Enumerated from the same content JSON the site renders, so it stays
 * in sync with the pages that actually exist per language — including the non-aligned NL/DE slugs
 * (each locale contributes its own real slugs on its own domain, so no invalid cross-language URL is
 * ever produced). `noindex` pages are excluded.
 *
 * Only emits entries when per-domain production origins are configured (content/i18n.json domainLocales);
 * on a preview/dev host without that config it returns nothing rather than localhost URLs.
 */
const isIndexable = (seo?: { robots?: string } | null): boolean => !/noindex/i.test(seo?.robots || '')

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []
  const now = new Date()

  for (const locale of activeLocales()) {
    const origin = canonicalOriginForLocale(locale)
    if (!origin) continue // no production origin for this locale → skip (dev/preview)

    const add = (path: string) => entries.push({ url: `${origin}${path === '/' ? '' : path}`, lastModified: now, changeFrequency: 'weekly', priority: path === '/' ? 1 : 0.7 })

    add('/')
    const villaBase = hubBase(locale, 'villas-hub')
    const blogBase = hubBase(locale, 'blogs-hub')

    for (const [slug, page] of Object.entries(getPages(locale))) {
      if (isIndexable((page as { seo?: { robots?: string } }).seo)) add(`/${slug}`)
    }
    for (const [slug, villa] of Object.entries(getVillas(locale))) {
      if (isIndexable((villa as { seo?: { robots?: string } }).seo)) add(`${villaBase}/${slug}`)
    }
    for (const [slug, blog] of Object.entries(getBlogs(locale))) {
      if (isIndexable((blog as { seo?: { robots?: string } }).seo)) add(`${blogBase}/${slug}`)
    }
  }

  return entries
}
