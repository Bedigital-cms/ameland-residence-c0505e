import { BookingSearch } from './BookingSearch'
import { LocaleLink } from './LocaleLink'
import { ResultsList } from './ResultsToolbar'
import type { ResultVilla } from './VillaResultCard'
import type { Availability, DateRange } from '@/lib/availability'
import { fitsParty, formatRange, shiftDate, toDutchDate, villasForRange } from '@/lib/availability'

/**
 * The Zoek & boek results: the search controls on the left, the matching villas on the right.
 *
 * A server component — both filters live in the URL (`?range=` and `?personen=`), so the whole page
 * can be rendered up front and stays linkable, shareable and crawlable. Availability is matched per
 * villa on `tommyId`, party size against Tommy's own `minPersonen`/`maxPersonen`.
 *
 * When nothing fits, the page does not dead-end: it offers the same stay shifted a week in either
 * direction with the result count already filled in, plus a chip per active filter to drop it.
 */

const COPY = {
  nl: {
    heading: 'Zoek & boek',
    results: (n: number) => `${n} ${n === 1 ? 'resultaat' : 'resultaten'}`,
    empty: 'Geen villa’s beschikbaar met deze filters.',
    adults: (n: number) => `Volwassenen (18+ jr): ${n}`,
    shiftIntro: 'Bekijk de beschikbaarheid 1 week eerder of later:',
    earlier: (d: string, n: number) => `1 week eerder (${d}): ${n} ${n === 1 ? 'resultaat' : 'resultaten'}`,
    later: (d: string, n: number) => `1 week later (${d}): ${n} ${n === 1 ? 'resultaat' : 'resultaten'}`,
    clearIntro: 'Zoek opnieuw met minder filter opties:',
    remove: 'Filter verwijderen',
  },
  de: {
    heading: 'Suchen & buchen',
    results: (n: number) => `${n} ${n === 1 ? 'Ergebnis' : 'Ergebnisse'}`,
    empty: 'Keine Ferienhäuser mit diesen Filtern verfügbar.',
    adults: (n: number) => `Erwachsene (18+ J.): ${n}`,
    shiftIntro: 'Verfügbarkeit 1 Woche früher oder später ansehen:',
    earlier: (d: string, n: number) => `1 Woche früher (${d}): ${n} ${n === 1 ? 'Ergebnis' : 'Ergebnisse'}`,
    later: (d: string, n: number) => `1 Woche später (${d}): ${n} ${n === 1 ? 'Ergebnis' : 'Ergebnisse'}`,
    clearIntro: 'Erneut suchen mit weniger Filtern:',
    remove: 'Filter entfernen',
  },
} as const

export type SearchVilla = ResultVilla

/** A link to this page for a given filter set. The space in "21-08-2026 - 28-08-2026" must be
 *  percent-encoded — left raw, Next normalises it to "+", which `parseRange` cannot read back. */
function href(basePath: string, range: DateRange | null, persons: number): string {
  const parts: string[] = []
  if (range) parts.push(`range=${encodeURIComponent(formatRange(range.arrival, range.departure))}`)
  if (persons) parts.push(`personen=${persons}`)
  return parts.length ? `${basePath}?${parts.join('&')}` : basePath
}

/** An active filter, shown beside the count; following it drops that one filter and keeps the rest. */
function Chip({ label, to, title }: { label: string; to: string; title: string }) {
  return (
    <LocaleLink href={to} className="sr-chip" title={title}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <span>{label}</span>
    </LocaleLink>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" fill="none" />
    </svg>
  )
}

export function SearchResults({
  villas,
  availability,
  range,
  persons,
  locale,
  basePath,
}: {
  villas: SearchVilla[]
  availability: Availability
  /** null = opened without a period; then only the party filter (if any) applies. */
  range: DateRange | null
  /** 0 = no party filter. */
  persons: number
  locale: string
  /** Prefix-free path of this page, for the chips and the week-shift links. */
  basePath: string
}) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']

  // With Tommy unreachable nothing can be matched, so the page lists everything rather than
  // nothing — an empty result set would read as "fully booked" when it only means "no data".
  const byId = new Map(availability.villas.map((v) => [v.tommyId, v]))
  const results = availability.degraded
    ? villas
    : villas.filter((v) => {
        const data = byId.get(v.tommyId)
        if (!data) return false
        if (!fitsParty(data, persons)) return false
        if (!range) return true
        return data.arrivals.includes(range.arrival) && data.departures.includes(range.departure)
      })

  const rangeLabel = range ? `${toDutchDate(range.arrival)} - ${toDutchDate(range.departure)}` : ''

  /** The same stay a week earlier/later, with its count already resolved. */
  const shifted = (days: number) => {
    if (!range) return null
    const moved = { arrival: shiftDate(range.arrival, days), departure: shiftDate(range.departure, days) }
    const count = availability.degraded ? 0 : villasForRange(availability, moved, persons).length
    return { ...moved, count, to: href(basePath, moved, persons) }
  }
  const earlier = shifted(-7)
  const later = shifted(7)

  const chips = (
    <>
      {range && <Chip label={rangeLabel} to={href(basePath, null, persons)} title={copy.remove} />}
      {persons > 0 && <Chip label={copy.adults(persons)} to={href(basePath, range, 0)} title={copy.remove} />}
    </>
  )
  const hasFilters = !!range || persons > 0

  return (
    <div className="searchpage">
      <div className="searchpage-grid">
        <aside className="sr-filters">
          <h2 className="sr-filters-title">{copy.heading}</h2>
          <BookingSearch
            availability={availability}
            locale={locale}
            resultsPath={basePath}
            layout="sidebar"
            initial={range ? { arrival: range.arrival, departure: range.departure } : undefined}
            initialPersons={persons}
          />
        </aside>

        <div className="sr-results">
          <ResultsList
            villas={results}
            locale={locale}
            header={
              <div className="sr-head">
                <p className="sr-count">{copy.results(results.length)}</p>
                {hasFilters && <div className="sr-chips">{chips}</div>}
              </div>
            }
            empty={
              <>
                <div className="sr-head">
                  <p className="sr-count">{copy.results(0)}</p>
                  {hasFilters && <div className="sr-chips">{chips}</div>}
                </div>
                <p className="sr-empty">{copy.empty}</p>
              </>
            }
          >
            {/* The way out of a dead end: the neighbouring weeks, then the filters themselves. */}
            {range && earlier && later && (
              <div className="sr-shift">
                <p className="sr-shift-intro">{copy.shiftIntro}</p>
                <div className="sr-shift-links">
                  <LocaleLink href={earlier.to} className="sr-shift-link">
                    <span>{copy.earlier(toDutchDate(earlier.arrival), earlier.count)}</span>
                    <Arrow />
                  </LocaleLink>
                  <LocaleLink href={later.to} className="sr-shift-link">
                    <span>{copy.later(toDutchDate(later.arrival), later.count)}</span>
                    <Arrow />
                  </LocaleLink>
                </div>

                <p className="sr-shift-intro">{copy.clearIntro}</p>
                <div className="sr-chips">{chips}</div>
              </div>
            )}
          </ResultsList>
        </div>
      </div>
    </div>
  )
}
