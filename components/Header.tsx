import { switcherLocales } from '@/lib/i18n'
import type { SiteContent } from '@/lib/types'

import { LanguageSwitcher } from './LanguageSwitcher'
import { LocaleLink } from './LocaleLink'
import { MobileMenu } from './MobileMenu'

/**
 * Sticky site header: brand, one row of nav links, language switcher and the Zoek & boek button.
 * The nav tree comes from `content/<locale>/site.json`, passed in as `site`.
 *
 * OVERFLOW ("priority+"): a header only fits so many top-level items before it crowds the logo and
 * the CTA. We show at most MAX_TOP_NAV slots; with more items the last slot becomes a "Meer" menu
 * holding the rest, so the nav stays on one tidy row however many pages the client adds. The mobile
 * drawer always lists everything.
 */
const MAX_TOP_NAV = 7

/** Label for the overflow item, per language (the nav content has no entry for it). */
const MORE_LABEL: Record<string, string> = {
  nl: 'Meer', en: 'More', de: 'Mehr', fr: 'Plus', es: 'Más', it: 'Altro', pt: 'Mais', pl: 'Więcej',
  da: 'Mere', sv: 'Mer', no: 'Mer', fi: 'Lisää', cs: 'Více', hu: 'Több', ro: 'Mai mult', el: 'Περισσότερα',
  tr: 'Daha fazla', ru: 'Ещё', uk: 'Ще', ar: 'المزيد', he: 'עוד', hi: 'और', bn: 'আরও',
  'zh-CN': '更多', 'zh-TW': '更多', ja: 'もっと見る', ko: '더 보기',
}

export function Header({ site, locale = 'nl' }: { site: SiteContent; locale?: string }) {
  const nav = site.nav ?? []
  const overflowing = nav.length > MAX_TOP_NAV
  const visible = overflowing ? nav.slice(0, MAX_TOP_NAV - 1) : nav
  const overflow = overflowing ? nav.slice(MAX_TOP_NAV - 1) : []
  const moreLabel = MORE_LABEL[locale] || MORE_LABEL[locale.split('-')[0]] || 'More'

  return (
    <header className="header">
      <div className="container header-inner">
        <LocaleLink className="brand" href="/" aria-label={site.brandName}>
          {site.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="brand-logo" src={site.logo} alt={site.brandName} />
          ) : (
            <span className="brand-name">
              <span className="brand-name-main">Ameland</span>
              <span className="brand-name-sub">Residence</span>
            </span>
          )}
        </LocaleLink>

        <nav className="mainnav" aria-label="Hoofdmenu">
          {visible.map((item) => (
            <div className="navitem" key={item.label}>
              <LocaleLink href={item.url}>{item.label}</LocaleLink>
            </div>
          ))}

          {overflow.length > 0 && (
            <div className="navitem navitem-more">
              {/* Hover/focus trigger (not a link); the items stay in the DOM so they remain crawlable. */}
              <button type="button" className="nav-more" aria-haspopup="true">
                {moreLabel}
                <span className="caret" aria-hidden="true" />
              </button>
              <div className="mega mega-more">
                <div className="mega-col mega-col-plain">
                  {overflow.map((item) => (
                    <LocaleLink key={item.label} href={item.url}>{item.label}</LocaleLink>
                  ))}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Everything on the right in ONE grid cell, so the header is a clean three-column layout
            (brand | nav | actions) with equal side columns — that is what keeps the nav optically
            centred regardless of how wide the brand or the CTA happen to be. */}
        <div className="header-end">
          <div className="header-cta">
            {/* switcherLocales() is empty in per-domain mode → the switcher hides itself. */}
            <LanguageSwitcher locales={switcherLocales()} />
            <LocaleLink className="btn btn-primary" href={site.ctaUrl}>{site.ctaLabel}</LocaleLink>
          </div>

          <MobileMenu nav={site.nav} ctaLabel={site.ctaLabel} ctaUrl={site.ctaUrl} locales={switcherLocales()} />
        </div>
      </div>
    </header>
  )
}
