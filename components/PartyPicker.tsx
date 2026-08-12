'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "Samenstelling / Belegung" party picker — a modal with a stepper per age group.
 *
 * The previous site put this behind a plain <select> of "1 persoon … 8 personen", which cannot
 * express a party the way guests actually think about one (two adults and a toddler is not the same
 * booking as three adults). Tommy counts people per category too, so the modal mirrors that: one
 * row per category, each with its own -/+ stepper.
 *
 * What leaves this component is still a single total, because that is what the search URL
 * (`?personen=`) and `fitsParty()` compare against a villa's min/max capacity. The per-category
 * split is presentation here; the booking widget asks for it again in its own flow, where the
 * category ids matter.
 */

const COPY = {
  nl: {
    title: 'Samenstelling',
    placeholder: 'Samenstelling',
    apply: 'toepassen',
    clear: 'wissen',
    close: 'sluiten',
    less: 'minder',
    more: 'meer',
    persons: (n: number) => `${n} ${n === 1 ? 'persoon' : 'personen'}`,
    groups: [
      { key: 'adults', label: 'Volwassenen', note: '18+ jr' },
      { key: 'children', label: 'Kind', note: '2-18 jr' },
      { key: 'babies', label: 'Baby', note: '0-2 jr' },
    ],
  },
  de: {
    title: 'Belegung',
    placeholder: 'Belegung',
    apply: 'übernehmen',
    clear: 'löschen',
    close: 'schließen',
    less: 'weniger',
    more: 'mehr',
    persons: (n: number) => `${n} ${n === 1 ? 'Person' : 'Personen'}`,
    groups: [
      { key: 'adults', label: 'Erwachsene', note: '18+ J.' },
      { key: 'children', label: 'Kind', note: '2-18 J.' },
      { key: 'babies', label: 'Baby', note: '0-2 J.' },
    ],
  },
} as const

type GroupKey = 'adults' | 'children' | 'babies'
type Party = Record<GroupKey, number>

const EMPTY: Party = { adults: 0, children: 0, babies: 0 }

export function PartyPicker({
  locale,
  /** Total party size currently searched on; 0 = no filter. */
  value,
  onChange,
  /** Largest party any villa takes — the ceiling for the steppers. */
  max,
}: {
  locale: string
  value: number
  onChange: (persons: string) => void
  max: number
}) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const [open, setOpen] = useState(false)
  // Counts are only committed on "toepassen", so an abandoned dialog leaves the search untouched.
  const [draft, setDraft] = useState<Party>(EMPTY)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // A total arriving from the URL has no category split to restore, so it seeds the adults row —
  // the same reading the booking widget applies when it prefills a party from a link.
  useEffect(() => {
    setDraft(value ? { ...EMPTY, adults: value } : EMPTY)
  }, [value, open])

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

  const total = draft.adults + draft.children + draft.babies
  const ceiling = max || 8

  function step(key: GroupKey, delta: number) {
    setDraft((d) => {
      const next = Math.max(0, d[key] + delta)
      // The ceiling applies to the party as a whole, not to one row, so a guest cannot build a
      // party larger than anything on the island and then get an empty result list.
      if (delta > 0 && d.adults + d.children + d.babies >= ceiling) return d
      return { ...d, [key]: next }
    })
  }

  function apply() {
    onChange(total ? String(total) : '')
    setOpen(false)
  }

  function clear() {
    setDraft(EMPTY)
    onChange('')
  }

  return (
    <>
      <button type="button" className="ap-field pp-trigger" onClick={() => setOpen(true)}>
        <span className={value ? '' : 'ap-field-ph'}>{value ? copy.persons(value) : copy.placeholder}</span>
        <svg className="ap-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="ap-overlay" role="presentation" onClick={() => setOpen(false)}>
          <button type="button" className="ap-overlay-close" aria-label={copy.close} onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </button>
          <div
            className="ap-dialog pp-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            tabIndex={-1}
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ap-dialog-head">{copy.title}</div>

            <div className="pp-rows">
              {copy.groups.map((g) => {
                const key = g.key as GroupKey
                const n = draft[key]
                return (
                  <div key={g.key} className="pp-row">
                    <span className="pp-label">
                      {g.label} <span className="pp-note">({g.note})</span>
                    </span>
                    <span className="pp-stepper">
                      <button
                        type="button"
                        className="pp-step"
                        aria-label={`${g.label} — ${copy.less}`}
                        disabled={n === 0}
                        onClick={() => step(key, -1)}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                          <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                      <output className="pp-count">{n}</output>
                      <button
                        type="button"
                        className="pp-step"
                        aria-label={`${g.label} — ${copy.more}`}
                        disabled={total >= ceiling}
                        onClick={() => step(key, 1)}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="ap-dialog-foot">
              <button type="button" className="ap-clear" onClick={clear}>
                {copy.clear}
              </button>
              <button type="button" className="pp-apply" onClick={apply}>
                {copy.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
