import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { getSite } from '@/content/site'
import { crossDomainOrigins, linkConfigForHost } from '@/lib/i18n'

import { Footer } from './Footer'
import { Header } from './Header'
import { LocaleProvider } from './LocaleLink'

/**
 * The page frame every route uses: sticky header + content + footer. The LocaleProvider makes the
 * locale and routing config available to every LocaleLink/RichText below, so nav, footer and
 * in-body links all get the right prefix (or none, for a language served on clean URLs).
 *
 * HOST-AWARE: in per-domain mode a mapped host (e.g. www.ameland-residence.de) serves one language on
 * prefix-free URLs, so `linkConfigForHost` makes every link on that host prefix-free; on preview hosts
 * the normal /<locale> prefixing applies. `crossDomainOrigins` lets the language switcher jump to the
 * equivalent domain instead of an in-page prefix swap.
 */
export async function Shell({ locale, children }: { locale: string; children: ReactNode }) {
  const site = getSite(locale)
  const host = (await headers()).get('host')
  const linkCfg = linkConfigForHost(host, locale)
  const domainOrigins = crossDomainOrigins()
  return (
    <LocaleProvider
      locale={locale}
      defaultLocale={linkCfg.defaultLocale}
      hideDefaultPrefix={linkCfg.hideDefaultPrefix}
      domainOrigins={domainOrigins}
    >
      <Header site={site} locale={locale} />
      <main>{children}</main>
      <Footer site={site} />
    </LocaleProvider>
  )
}
