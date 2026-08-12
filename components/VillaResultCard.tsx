import { LocaleLink } from './LocaleLink'
import { Media } from './Media'

/**
 * One villa on a result list — the same card on Zoek & boek and on Last minutes, so the two pages
 * can never drift apart.
 *
 * The price is a weekly range kept in the CMS (`priceFrom`/`priceTo` in villas.json). Tommy's API
 * exposes availability and capacity but no tariffs, so there is nothing to read it from; a villa
 * without the fields filled in just renders without the line instead of showing a made-up figure.
 */

export type ResultVilla = {
  slug: string
  title: string
  text: string
  image: string
  url: string
  linkLabel: string
  tommyId: string
  priceFrom?: number
  priceTo?: number
  priceNote?: string
  /** Only set once the CMS has real positions; without them the villa is left off the map view. */
  latitude?: number
  longitude?: number
}

const COPY = {
  nl: { more: 'meer info', week: 'per week' },
  de: { more: 'mehr Infos', week: 'pro Woche' },
} as const

/** Whole euros, no separators — the rates are printed as "1495 - 3630", not "1.495 - 3.630". */
function amount(value: number): string {
  return String(Math.round(value))
}

function Price({ villa, locale }: { villa: ResultVilla; locale: string }) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const from = villa.priceFrom || 0
  const to = villa.priceTo || 0
  if (!from && !to) return null

  const range = from && to && to !== from ? `${amount(from)} - ${amount(to)}` : amount(from || to)
  return (
    <p className="vr-price">
      <span className="vr-price-amount">€ {range}</span> <span className="vr-price-unit">{copy.week}</span>
      {villa.priceNote && (
        <span className="vr-price-info" tabIndex={0} role="note" aria-label={villa.priceNote} title={villa.priceNote}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" strokeLinecap="round" />
            <path d="M12 7.6h.01" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </p>
  )
}

export function VillaResultCard({ villa, locale }: { villa: ResultVilla; locale: string }) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  return (
    <li className="lm-item">
      <LocaleLink href={villa.url} className="lm-item-media">
        <Media src={villa.image} alt={villa.title} shape="card" />
      </LocaleLink>
      <div className="lm-item-body">
        <h3 className="lm-item-title">
          <LocaleLink href={villa.url}>{villa.title}</LocaleLink>
        </h3>
        {villa.text && <p className="lm-item-text">{villa.text}</p>}
        {/* Price bottom-left, the link bottom-right, as on the existing result cards. */}
        <div className="lm-item-foot">
          <Price villa={villa} locale={locale} />
          <LocaleLink href={villa.url} className="lm-item-link">
            {villa.linkLabel || copy.more}
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" fill="none" />
            </svg>
          </LocaleLink>
        </div>
      </div>
    </li>
  )
}
