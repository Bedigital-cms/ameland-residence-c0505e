import type { ReactNode } from 'react'

import { getSite } from '@/content/site'
import { defaultLocale, hideDefaultPrefix } from '@/lib/i18n'

import { Footer } from './Footer'
import { Header } from './Header'
import { LocaleProvider } from './LocaleLink'

/**
 * The page frame every route uses: sticky header + content + footer. The LocaleProvider makes the
 * locale and routing config available to every LocaleLink/RichText below, so nav, footer and
 * in-body links all get the right prefix (or none, for a language served on clean URLs).
 */
export function Shell({ locale, children }: { locale: string; children: ReactNode }) {
  const site = getSite(locale)
  return (
    <LocaleProvider locale={locale} defaultLocale={defaultLocale()} hideDefaultPrefix={hideDefaultPrefix()}>
      <Header site={site} locale={locale} />
      <main>{children}</main>
      <Footer site={site} />
    </LocaleProvider>
  )
}
