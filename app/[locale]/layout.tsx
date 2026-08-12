import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { getSite } from '@/content/site'
import { activeLocales, defaultLocale, domainLocaleMap, domainLocaleMode, hideDefaultPrefix, isActiveLocale } from '@/lib/i18n'
import { localeDir } from '@/lib/locales'

/**
 * Twee fonts, precies die van de bestaande site:
 *  - Jost voor álles (ook de koppen — er zit geen serif in de huisstijl)
 *  - Architects Daughter voor de handschriftregels (subtitels, USP-labels), één gewicht
 */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Architects+Daughter&display=swap'

/** Pre-render one tree per active locale. */
export function generateStaticParams() {
  return activeLocales().map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isActiveLocale(locale)) return {}
  const site = getSite(locale)
  const locales = activeLocales()

  // hreflang alternates — only meaningful once more than one locale is active.
  //  · Per-domain mode (this client: .nl = nl, .de = de): each language lives on its OWN domain, so
  //    the alternates must be ABSOLUTE per-domain roots — a root-relative path can't cross domains.
  //  · Otherwise: root-relative alternates that work on any host without hardcoding a domain.
  const hideDefault = hideDefaultPrefix()
  const def = defaultLocale()
  let languages: Record<string, string> | undefined
  if (locales.length > 1) {
    if (domainLocaleMode()) {
      const localeToHost: Record<string, string> = {}
      for (const [host, loc] of Object.entries(domainLocaleMap())) if (!localeToHost[loc]) localeToHost[loc] = host
      const entries = locales.filter((l) => localeToHost[l]).map((l) => [l, `https://${localeToHost[l]}/`] as const)
      languages = entries.length > 0 ? Object.fromEntries(entries) : undefined
    } else {
      languages = Object.fromEntries(locales.map((l) => [l, hideDefault && l === def ? '/' : `/${l}`]))
    }
  }

  // Social images are stored as "/media/<file>" paths; metadataBase turns them into absolute URLs.
  // In per-domain mode the language already implies the domain, so derive it from the same map.
  const siteHost = Object.entries(domainLocaleMap()).find(([, loc]) => loc === locale)?.[0]
  const base = process.env.NEXT_PUBLIC_SITE_URL || (siteHost ? `https://${siteHost}` : '')

  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: { default: `${site.brandName} — ${site.tagline}`, template: `%s | ${site.brandName}` },
    description: site.footer.about,
    ...(languages ? { alternates: { languages } } : {}),
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Unknown / inactive locale in the URL → 404 (keeps /xx/... from silently rendering the default).
  if (!isActiveLocale(locale)) notFound()

  return (
    <html lang={locale} dir={localeDir(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  )
}
