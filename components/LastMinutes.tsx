'use client'

import { useMemo, useState } from 'react'

import { AvailabilityPicker, type Period } from './AvailabilityPicker'
import { PartyPicker } from './PartyPicker'
import { ResultsList } from './ResultsToolbar'
import type { ResultVilla } from './VillaResultCard'
import type { Availability } from '@/lib/availability'
import { fitsParty } from '@/lib/availability'

/**
 * The `/last-minutes` overview: the period filter on the left, the matching villas on the right.
 *
 * Every villa here comes from villas.json; what Tommy contributes is only the availability, matched
 * per villa on `tommyId`. Picking a period therefore narrows the SAME cards the rest of the site
 * renders — no second, divergent villa list — and an unfiltered visit simply shows them all.
 */

const COPY = {
  nl: {
    heading: 'Zoek & boek',
    clear: 'filters wissen',
    results: (n: number) => `${n} ${n === 1 ? 'resultaat' : 'resultaten'}`,
    empty: 'Geen villa’s beschikbaar in de gekozen periode.',
  },
  de: {
    heading: 'Suchen & buchen',
    clear: 'Filter löschen',
    results: (n: number) => `${n} ${n === 1 ? 'Ergebnis' : 'Ergebnisse'}`,
    empty: 'Keine Ferienhäuser im gewählten Zeitraum verfügbar.',
  },
} as const

export type LastMinuteVilla = ResultVilla

/**
 * Can this villa take the whole period?
 *
 * Tommy answers arrival and departure separately, so a villa qualifies when it offers the chosen
 * arrival day AND the chosen departure day. With only one end picked, that single end is all there
 * is to match on — the guest is still mid-selection and should not see the list empty out.
 */
function matches(villa: LastMinuteVilla, period: Period, persons: number, availability: Availability): boolean {
  if (!period.arrival && !period.departure && !persons) return true
  const data = availability.villas.find((v) => v.tommyId === villa.tommyId)
  if (!data) return false
  if (!fitsParty(data, persons)) return false
  if (period.arrival && !data.arrivals.includes(period.arrival)) return false
  if (period.departure && !data.departures.includes(period.departure)) return false
  return true
}

export function LastMinutes({
  villas,
  availability,
  locale,
}: {
  villas: LastMinuteVilla[]
  availability: Availability
  locale: string
}) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const [period, setPeriod] = useState<Period>({ arrival: null, departure: null })
  const [persons, setPersons] = useState('')

  // The party ceiling comes from Tommy's own per-accommodation limits.
  const maxParty = availability.maxPersons || 8

  // With Tommy unreachable the availability set is empty; filtering on it would blank the page, so
  // the list stays complete and the picker simply offers nothing to narrow it by.
  const party = Number(persons) || 0
  const results = useMemo(
    () => (availability.degraded ? villas : villas.filter((v) => matches(v, period, party, availability))),
    [villas, period, party, availability],
  )

  const filtered = !!(period.arrival || period.departure || persons)

  return (
    <section className="section section-lastminutes">
      <div className="container lastminutes">
        <aside className="lm-filters">
          <h2 className="lm-filters-title">{copy.heading}</h2>

          <AvailabilityPicker
            availability={availability}
            locale={locale}
            value={period}
            onChange={setPeriod}
            layout="single"
          />

          <div className="lm-select">
            <PartyPicker locale={locale} value={party} onChange={setPersons} max={maxParty} />
          </div>

          {filtered && (
            <button
              type="button"
              className="lm-clear"
              onClick={() => {
                setPeriod({ arrival: null, departure: null })
                setPersons('')
              }}
            >
              {copy.clear}
            </button>
          )}
        </aside>

        <div className="lm-results">
          <ResultsList
            villas={results}
            locale={locale}
            header={<p className="lm-count">{copy.results(results.length)}</p>}
            empty={
              <>
                <p className="lm-count">{copy.results(0)}</p>
                <p className="lm-empty">{copy.empty}</p>
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}
