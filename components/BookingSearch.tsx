'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AvailabilityPicker, type Period } from './AvailabilityPicker'
import { useLocaleConfig } from './LocaleLink'
import { PartyPicker } from './PartyPicker'
import type { Availability } from '@/lib/availability'
import { formatRange } from '@/lib/availability'
import { localeHref } from '@/lib/href'

/**
 * The Zoek & boek controls: party size and the arrival/departure calendar.
 *
 * Two layouts, one behaviour. On the homepage it is the wide bar with an explicit "resultaten"
 * button; in the results sidebar it is a stacked panel where changing a filter navigates straight
 * away, because there the guest is adjusting a search they can already see.
 *
 * Either way the search lives in the URL — `/zoek-boek?range=21-08-2026 - 28-08-2026&personen=3` —
 * which is the address the booking flow has always used, so a result stays linkable and reloadable.
 */

const COPY = {
  nl: {
    submit: 'resultaten',
    clear: 'filters wissen',
  },
  de: {
    submit: 'Ergebnisse',
    clear: 'Filter löschen',
  },
} as const

export function BookingSearch({
  availability,
  locale,
  /** Prefix-free path of the results page — "/zoek-boek" (nl), "/suchen-buchen" (de). */
  resultsPath,
  /** "bar" = the homepage search bar, "sidebar" = the filter panel on the results page. */
  layout = 'bar',
  /** Period the page was opened with, so the controls show the active search. */
  initial,
  initialPersons = 0,
}: {
  availability: Availability
  locale: string
  resultsPath: string
  layout?: 'bar' | 'sidebar'
  initial?: Period
  initialPersons?: number
}) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const router = useRouter()
  const { defaultLocale, hideDefaultPrefix } = useLocaleConfig()
  const [period, setPeriod] = useState<Period>(initial ?? { arrival: null, departure: null })
  const [persons, setPersons] = useState(initialPersons ? String(initialPersons) : '')

  const maxParty = availability.maxPersons || 8

  const sidebar = layout === 'sidebar'
  // Only a complete period identifies a stay; with one end missing there is nothing to search for.
  const ready = !!(period.arrival && period.departure)

  function go(next: { period?: Period; persons?: string }) {
    if (!resultsPath) return
    const p = next.period ?? period
    const n = next.persons ?? persons
    // URLSearchParams would encode the space in the range as "+", which only means a space in form
    // bodies; the booking URLs use %20, so the query is built directly.
    const parts: string[] = []
    if (p.arrival && p.departure) parts.push(`range=${encodeURIComponent(formatRange(p.arrival, p.departure))}`)
    if (n) parts.push(`personen=${encodeURIComponent(n)}`)
    const base = localeHref(locale, resultsPath, { defaultLocale, hideDefaultPrefix })
    router.push(parts.length ? `${base}?${parts.join('&')}` : base)
  }

  /** In the sidebar a filter applies as soon as it changes; on the homepage it waits for the button. */
  function onPeriod(next: Period) {
    setPeriod(next)
    if (sidebar && next.arrival && next.departure) go({ period: next })
  }

  function onPersons(next: string) {
    setPersons(next)
    if (sidebar) go({ persons: next })
  }

  const partySelect = (
    <div className={sidebar ? 'lm-select' : 'booksearch-select'}>
      <PartyPicker locale={locale} value={Number(persons) || 0} onChange={onPersons} max={maxParty} />
    </div>
  )

  if (sidebar) {
    const active = !!(period.arrival || period.departure || persons)
    return (
      <div className="booksearch booksearch--sidebar">
        <AvailabilityPicker
          availability={availability}
          locale={locale}
          value={period}
          onChange={onPeriod}
          layout="single"
        />
        {partySelect}
        {active && (
          <button
            type="button"
            className="lm-clear"
            onClick={() => {
              setPeriod({ arrival: null, departure: null })
              setPersons('')
              router.push(localeHref(locale, resultsPath, { defaultLocale, hideDefaultPrefix }))
            }}
          >
            {copy.clear}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="booksearch">
      <div className="booksearch-bar">
        {partySelect}
        <AvailabilityPicker
          availability={availability}
          locale={locale}
          value={period}
          onChange={onPeriod}
        />
        <button type="button" className="booksearch-submit" onClick={() => go({})} disabled={!ready}>
          {copy.submit}
        </button>
      </div>
    </div>
  )
}
