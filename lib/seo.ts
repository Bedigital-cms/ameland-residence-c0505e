import type { Metadata } from 'next'

import { getSite } from '@/content/site'

import type { PageAlternates } from './alternates'
import { activeLocales } from './i18n'
import type { Seo } from './types'

/** og:locale form for a site locale (nl → nl_NL, de → de_DE). */
function ogLocaleOf(locale: string): string {
  return locale === 'de' ? 'de_DE' : 'nl_NL'
}

/** Site-wide default social image when a page has none. A real, existing hero (1200×630-ish). */
export const DEFAULT_OG_IMAGE = '/media/ameland-residence-20260730-217e4c-header-home-ameland-residence-desktop03.jpg'

type SeoOptions = {
  /** Canonical + hreflang for this page (from lib/alternates). Canonical AND languages together. */
  alternates?: PageAlternates
  /** Absolute canonical URL (og:url). */
  canonicalUrl?: string
  /** `nl` | `de` — drives og:locale. */
  locale?: string
  /** Brand/site name for og:site_name (optional; omitted when not provided). */
  siteName?: string
}

/**
 * Turn a page's stored SEO block into Next metadata.
 *
 * Titles, descriptions, keywords and social images were migrated one-for-one from the previous site
 * so search rankings survive the move; the CMS can edit them per page, per language. Canonical +
 * hreflang + Open Graph + Twitter are added here so every indexable page is complete.
 */
export function metadataFrom(seo: Seo | undefined, fallbackTitle: string, opts: SeoOptions = {}): Metadata {
  const title = seo?.title || fallbackTitle
  const description = seo?.description || undefined
  const noindex = /noindex/i.test(seo?.robots || '')
  const image = seo?.ogImage || DEFAULT_OG_IMAGE
  const ogLocale = ogLocaleOf(opts.locale || 'nl')
  // The OTHER active locales, in og form — improves social/locale discovery alongside hreflang.
  const alternateLocale = activeLocales()
    .filter((l) => l !== opts.locale)
    .map(ogLocaleOf)
  // og:site_name — the brand, consistent across every page (explicit override wins).
  const siteName = opts.siteName || (opts.locale ? getSite(opts.locale).brandName : undefined)

  return {
    // `absolute` so a migrated title is used verbatim, without the layout's "| brand" template.
    title: { absolute: title },
    description,
    keywords: seo?.keywords || undefined,
    robots: noindex ? { index: false, follow: true } : undefined,
    ...(opts.alternates ? { alternates: opts.alternates } : {}),
    openGraph: {
      title,
      description,
      ...(siteName ? { siteName } : {}),
      ...(opts.canonicalUrl ? { url: opts.canonicalUrl } : {}),
      images: [image],
      locale: ogLocale,
      ...(alternateLocale.length ? { alternateLocale } : {}),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description,
      images: [image],
    },
  }
}
