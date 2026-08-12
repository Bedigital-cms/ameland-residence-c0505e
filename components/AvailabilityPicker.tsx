'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { Availability } from '@/lib/availability'

/**
 * The "Aankomst / Vertrek" period picker — our own calendar in front of Tommy's data.
 *
 * Tommy's widget has a calendar of its own, but it only exists inside the widget's own booking flow.
 * The search bar on the homepage and the filter on `/last-minutes` sit outside it, so this renders
 * the two-month modal the site is designed around: a day is clickable only when Tommy lists it as an
 * arrival (resp. departure) day, which is exactly the green highlight in the design.
 *
 * The picked period is lifted to the parent — the homepage hands it to Tommy's search widget, the
 * last-minutes page filters its villa cards with it.
 */

/** Locale-specific chrome. Only two languages exist on this site, so a table beats Intl here —
 *  it keeps the abbreviations identical to the ones the design uses. */
const COPY = {
  nl: {
    title: 'Inchecken en uitchecken',
    arrival: 'Aankomst',
    departure: 'Vertrek',
    period: 'Aankomst - Vertrek',
    clear: 'wissen',
    cancel: 'annuleren',
    close: 'sluiten',
    none: 'Geen beschikbare data',
    days: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
    months: ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'],
  },
  de: {
    title: 'An- und Abreise',
    arrival: 'Anreise',
    departure: 'Abreise',
    period: 'Anreise - Abreise',
    clear: 'löschen',
    cancel: 'abbrechen',
    close: 'schließen',
    none: 'Keine verfügbaren Daten',
    days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  },
} as const

/** The chrome for one language. Widened from the const table so either language satisfies it —
 *  `typeof COPY.nl` alone would pin the literals to the Dutch strings. */
type Copy = {
  title: string
  arrival: string
  departure: string
  period: string
  clear: string
  cancel: string
  close: string
  none: string
  days: readonly string[]
  months: readonly string[]
}

export type Period = { arrival: string | null; departure: string | null }

/** "YYYY-MM-DD" for a calendar cell. Built from parts, never from toISOString(), so the label can
 *  never slide a day in a timezone behind UTC. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The month grid: leading blanks so the 1st lands under its weekday, then the days. */
function monthCells(year: number, month: number): (number | null)[] {
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return [...Array(lead).fill(null), ...Array.from({ length }, (_, i) => i + 1)]
}

function formatDate(value: string, locale: string): string {
  const [y, m, d] = value.split('-')
  return locale === 'de' ? `${d}.${m}.${y}` : `${d}-${m}-${y}`
}

function Month({
  year,
  month,
  copy,
  selectable,
  period,
  onPick,
}: {
  year: number
  month: number
  copy: Copy
  selectable: Set<string>
  period: Period
  onPick: (date: string) => void
}) {
  return (
    <div className="ap-month">
      <div className="ap-month-head">
        {copy.months[month]} <span>{year}</span>
      </div>
      <div className="ap-grid ap-dow">
        {copy.days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="ap-grid">
        {monthCells(year, month).map((day, i) => {
          if (day === null) return <span key={`x${i}`} className="ap-day ap-day--empty" />
          const date = iso(year, month, day)
          const open = selectable.has(date)
          const isArrival = period.arrival === date
          const isDeparture = period.departure === date
          const between =
            !!period.arrival && !!period.departure && date > period.arrival && date < period.departure
          // Arrival, the nights in between and departure read as ONE selected stay: a continuous
          // band with rounded ends, not three separate highlights. The middle days are shown as
          // part of it even though they are not themselves clickable — that is what makes the
          // selection legible as a period.
          const selected = isArrival || isDeparture || between
          const className = [
            'ap-day',
            open ? 'ap-day--open' : 'ap-day--closed',
            selected ? 'ap-day--sel' : '',
            // Only round the outer edges, so the run joins up visually.
            selected && (isArrival || !period.departure) ? 'ap-day--sel-start' : '',
            selected && isDeparture ? 'ap-day--sel-end' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={date}
              type="button"
              className={className}
              disabled={!open}
              aria-pressed={isArrival || isDeparture}
              onClick={() => onPick(date)}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AvailabilityPicker({
  availability,
  locale,
  value,
  onChange,
  /** "split" = two fields (homepage), "single" = one combined field (last-minutes sidebar). */
  layout = 'split',
}: {
  availability: Availability
  locale: string
  value: Period
  onChange: (period: Period) => void
  layout?: 'split' | 'single'
}) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const arrivals = useMemo(() => new Set(availability.arrivals), [availability.arrivals])
  const departures = useMemo(() => new Set(availability.departures), [availability.departures])

  // Once an arrival is set, the calendar switches to departure days — and only those AFTER it, so a
  // guest cannot build a backwards period that the booking step would reject.
  const picking: 'arrival' | 'departure' = value.arrival && !value.departure ? 'departure' : 'arrival'
  const selectable = useMemo(() => {
    if (picking === 'arrival') return arrivals
    return new Set([...departures].filter((d) => !value.arrival || d > value.arrival))
  }, [picking, arrivals, departures, value.arrival])

  // The window starts at the first month that actually has availability, so opening the picker
  // never lands the guest on two empty months they have to page past.
  const base = useMemo(() => {
    const first = availability.arrivals[0] || `${availability.fromMonth}-01`
    const [y, m] = first.split('-').map(Number)
    return { year: y, month: m - 1 }
  }, [availability.arrivals, availability.fromMonth])

  const months = useMemo(() => {
    const out: { year: number; month: number }[] = []
    for (let i = 0; i < 2; i++) {
      const d = new Date(Date.UTC(base.year, base.month + offset + i, 1))
      out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
    }
    return out
  }, [base, offset])

  // Paging stops where the data does — there is nothing to show past the last available day.
  const lastDate = availability.arrivals[availability.arrivals.length - 1] || ''
  const maxOffset = useMemo(() => {
    if (!lastDate) return 0
    const [ly, lm] = lastDate.split('-').map(Number)
    return Math.max(0, (ly - base.year) * 12 + (lm - 1 - base.month) - 1)
  }, [lastDate, base])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  function pick(date: string) {
    if (picking === 'arrival') {
      onChange({ arrival: date, departure: null })
      return
    }
    onChange({ ...value, departure: date })
    // Both ends chosen — the guest is done, so get the overlay out of the way.
    setOpen(false)
  }

  function clear() {
    onChange({ arrival: null, departure: null })
  }

  const arrivalLabel = value.arrival ? formatDate(value.arrival, locale) : copy.arrival
  const departureLabel = value.departure ? formatDate(value.departure, locale) : copy.departure
  const singleLabel =
    value.arrival || value.departure ? `${arrivalLabel} - ${departureLabel}` : copy.period

  return (
    <>
      {layout === 'split' ? (
        <>
          <button type="button" className="ap-field" onClick={() => setOpen(true)}>
            <span className={value.arrival ? '' : 'ap-field-ph'}>{arrivalLabel}</span>
            <Chevron />
          </button>
          <button type="button" className="ap-field" onClick={() => setOpen(true)}>
            <span className={value.departure ? '' : 'ap-field-ph'}>{departureLabel}</span>
            <Chevron />
          </button>
        </>
      ) : (
        <button type="button" className="ap-field" onClick={() => setOpen(true)}>
          <span className={value.arrival ? '' : 'ap-field-ph'}>{singleLabel}</span>
          <Chevron />
        </button>
      )}

      {open && (
        <div className="ap-overlay" role="presentation" onClick={() => setOpen(false)}>
          <button type="button" className="ap-overlay-close" aria-label={copy.close} onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </button>
          {/* The dialog is inside the overlay, so its own clicks must not reach the dismiss handler. */}
          <div
            className="ap-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            tabIndex={-1}
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ap-dialog-head">{copy.title}</div>

            {availability.arrivals.length === 0 ? (
              <p className="ap-empty">{copy.none}</p>
            ) : (
              <>
                <div className="ap-months">
                  <button
                    type="button"
                    className="ap-nav ap-nav--prev"
                    aria-label="<"
                    disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - 1))}
                  >
                    <Arrow dir="left" />
                  </button>
                  {months.map((m) => (
                    <Month
                      key={`${m.year}-${m.month}`}
                      year={m.year}
                      month={m.month}
                      copy={copy}
                      selectable={selectable}
                      period={value}
                      onPick={pick}
                    />
                  ))}
                  <button
                    type="button"
                    className="ap-nav ap-nav--next"
                    aria-label=">"
                    disabled={offset >= maxOffset}
                    onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
                  >
                    <Arrow dir="right" />
                  </button>
                </div>

                <div className="ap-dialog-foot">
                  <button type="button" className="ap-clear" onClick={clear}>
                    {copy.clear}
                  </button>
                  <button type="button" className="ap-cancel" onClick={() => setOpen(false)}>
                    {copy.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Chevron() {
  return (
    <svg className="ap-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  )
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  )
}
