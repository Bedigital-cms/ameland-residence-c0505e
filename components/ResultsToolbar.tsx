'use client'

import { useMemo, useState } from 'react'

import { VillaMap } from './VillaMap'
import { VillaResultCard, type ResultVilla } from './VillaResultCard'

/**
 * A result list with its `sorteren / lijst / kaart` controls.
 *
 * Both result pages use it — Zoek & boek and Last minutes — so the two can never drift apart. The
 * controls are real: sorting reorders the list, and the toggle swaps the list for a map of the
 * villas. Everything happens client-side on an already-filtered set, so neither is a round trip.
 *
 * Which villas are shown is decided by the caller (dates, party size); this only decides how.
 */

const COPY = {
  nl: {
    sort: 'sorteren',
    list: 'lijst',
    map: 'kaart',
    priceAsc: 'Prijs (laag - hoog)',
    priceDesc: 'Prijs (hoog - laag)',
    nameAsc: 'Naam (A - Z)',
    noMap: 'Voor deze villa’s is nog geen locatie bekend.',
  },
  de: {
    sort: 'sortieren',
    list: 'Liste',
    map: 'Karte',
    priceAsc: 'Preis (niedrig - hoch)',
    priceDesc: 'Preis (hoch - niedrig)',
    nameAsc: 'Name (A - Z)',
    noMap: 'Für diese Ferienhäuser ist noch kein Standort bekannt.',
  },
} as const

type SortKey = '' | 'price-asc' | 'price-desc' | 'name-asc'

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
      <path d="M9 4v13M15 6.5v13" />
    </svg>
  )
}

/**
 * Order the list.
 *
 * Price sorts on the "from" rate first, since that is what the card leads with — but these villas
 * mostly share a season-low rate, so a tie is broken on the "to" rate and finally on the name.
 * Without that, "hoog - laag" would leave a list of identical opening prices untouched and read as
 * a broken control. Villas without any price sink to the bottom in both directions.
 */
function sortVillas(villas: ResultVilla[], key: SortKey, locale: string): ResultVilla[] {
  if (!key) return villas
  const lang = locale === 'de' ? 'de' : 'nl'
  const out = [...villas]
  if (key === 'name-asc') {
    return out.sort((a, b) => a.title.localeCompare(b.title, lang))
  }

  const dir = key === 'price-asc' ? 1 : -1
  const from = (v: ResultVilla) => v.priceFrom || v.priceTo || 0
  const to = (v: ResultVilla) => v.priceTo || v.priceFrom || 0
  return out.sort((a, b) => {
    const fa = from(a)
    const fb = from(b)
    if (!fa || !fb) return fa === fb ? 0 : fa ? -1 : 1
    if (fa !== fb) return (fa - fb) * dir
    if (to(a) !== to(b)) return (to(a) - to(b)) * dir
    return a.title.localeCompare(b.title, lang)
  })
}

export function ResultsList({
  villas,
  locale,
  /** Rendered above the controls — the count and the active filter chips. */
  header,
  /** Rendered when the (already filtered) set is empty. */
  empty,
  children,
}: {
  villas: ResultVilla[]
  locale: string
  header?: React.ReactNode
  empty?: React.ReactNode
  /** Anything that belongs under the list, e.g. the week-shift suggestions. */
  children?: React.ReactNode
}) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const [sort, setSort] = useState<SortKey>('')
  const [view, setView] = useState<'list' | 'map'>('list')

  const sorted = useMemo(() => sortVillas(villas, sort, locale), [villas, sort, locale])
  const mappable = useMemo(() => sorted.filter((v) => v.latitude && v.longitude), [sorted])

  return (
    <>
      <div className="sr-toolbar">
        <label className="sr-toolbar-select">
          <span className="sr-only">{copy.sort}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="">{copy.sort}</option>
            <option value="price-asc">{copy.priceAsc}</option>
            <option value="price-desc">{copy.priceDesc}</option>
            <option value="name-asc">{copy.nameAsc}</option>
          </select>
        </label>

        <button
          type="button"
          className={`sr-toolbar-btn${view === 'list' ? ' sr-toolbar-btn--on' : ''}`}
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          <ListIcon />
          {copy.list}
        </button>
        <button
          type="button"
          className={`sr-toolbar-btn${view === 'map' ? ' sr-toolbar-btn--on' : ''}`}
          aria-pressed={view === 'map'}
          onClick={() => setView('map')}
        >
          <MapIcon />
          {copy.map}
        </button>
      </div>

      {header}

      {sorted.length === 0 ? (
        empty
      ) : view === 'map' ? (
        // Villas without coordinates cannot be pinned, so they stay listed below the map instead of
        // vanishing when the guest switches view.
        <>
          {mappable.length > 0 ? <VillaMap villas={mappable} locale={locale} /> : <p className="sr-empty">{copy.noMap}</p>}
          {mappable.length < sorted.length && (
            <ul className="lm-list lm-list--rest">
              {sorted
                .filter((v) => !v.latitude || !v.longitude)
                .map((v) => (
                  <VillaResultCard key={v.slug} villa={v} locale={locale} />
                ))}
            </ul>
          )}
        </>
      ) : (
        <ul className="lm-list">
          {sorted.map((v) => (
            <VillaResultCard key={v.slug} villa={v} locale={locale} />
          ))}
        </ul>
      )}

      {children}
    </>
  )
}
