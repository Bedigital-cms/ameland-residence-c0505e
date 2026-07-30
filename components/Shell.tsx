import type { ReactNode } from 'react'

import { getSite } from '@/content/site'
import { defaultLocale, hideDefaultPrefix } from '@/lib/i18n'
import { t } from '@/lib/ui-text'

import { Footer } from './Footer'
import { Header } from './Header'
import { LocaleProvider } from './LocaleLink'

/**
 * The page frame every route uses: sticky header + content + footer. The LocaleProvider makes the
 * locale and routing config available to every LocaleLink/RichText below, so nav, footer and
 * in-body links all get the right prefix (or none, for a language served on clean URLs).
 *
 * SKIP LINK. The first focusable element is a link straight to `<main>`. Without it a keyboard or
 * screen-reader user tabs through the full main navigation, the language switcher and the booking CTA on
 * EVERY page before reaching the content. It is visually hidden until focused (see `.skiplink`), so it
 * costs nothing visually and is the single highest-value keyboard affordance on a site like this.
 */
export function Shell({ locale, children }: { locale: string; children: ReactNode }) {
  const site = getSite(locale)
  return (
    <LocaleProvider locale={locale} defaultLocale={defaultLocale()} hideDefaultPrefix={hideDefaultPrefix()}>
      <a className="skiplink" href="#main">
        {t(locale, 'skipToContent')}
      </a>
      <Header site={site} locale={locale} />
      {/* `id` for the skip link; `tabIndex={-1}` so focus can actually land on it when jumped to. */}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer site={site} />
    </LocaleProvider>
  )
}
