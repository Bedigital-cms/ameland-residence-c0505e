import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { Analytics } from '@/components/Analytics'
import { CmsEditRuntime } from '@/components/CmsEditRuntime'
import { getSite } from '@/content/site'
import { activeLocales, canonicalOriginForLocale, isActiveLocale } from '@/lib/i18n'
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

  // Per-page canonical + hreflang are emitted by each page's generateMetadata (lib/alternates), so the
  // layout deliberately does NOT set a root-level `alternates` — a layout hreflang would otherwise make
  // every page point its language alternates at the homepage. metadataBase stays so relative social
  // images (`/media/<file>`) resolve to absolute per-domain URLs.
  const base = process.env.NEXT_PUBLIC_SITE_URL || canonicalOriginForLocale(locale) || ''

  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: { default: `${site.brandName} — ${site.tagline}`, template: `%s | ${site.brandName}` },
    description: site.footer.about,
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
        {/* All /media/* images 302-redirect to the CMS media origin — connect early so the LCP hero
            and every other image resolve without a cold DNS+TLS handshake. */}
        <link rel="preconnect" href="https://cms.bedigital.ai" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cms.bedigital.ai" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <Analytics locale={locale} />
        <CmsEditRuntime />
        {children}
      </body>
    </html>
  )
}
