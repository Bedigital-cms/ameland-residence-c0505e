import { t, type UiKey } from '@/lib/ui-text'
import type { VillaAttributes, VillaFilter as FilterDef } from '@/lib/villa-filter'

import { LocaleLink } from './LocaleLink'

/**
 * Filter chips on the villa overview.
 *
 * Same contract as the blog filters: every control is an ordinary `<a href>` that sets or clears a query
 * parameter, so each filter state is a real, crawlable, bookmarkable URL and the whole thing works with
 * JavaScript disabled. The brief is explicit that all villas and their links must stay in the HTML and be
 * reachable without JS — a client-only filter would break both.
 *
 * Only filters the current data genuinely supports are rendered; see `lib/villa-filter.ts` for which are
 * switched off and why.
 */
export function VillaFilter({
  locale,
  base,
  filters,
  all,
  selected,
  partyParams,
  total,
  shown,
}: {
  locale: string
  /** Hub path, prefix-free ("/villa-s"); LocaleLink adds the language prefix. */
  base: string
  filters: FilterDef[]
  /** Attributes of every villa, used to derive each filter's available values. */
  all: VillaAttributes[]
  /** filter id -> chosen value. Includes the derived `personen`, which chip URLs must not carry. */
  selected: Record<string, string>
  /**
   * The guest party's own query parameters (`volwassenen` / `kinderen` / `babies`), so a chip link
   * preserves the stepper. Empty when the party is at its default.
   */
  partyParams: Record<string, string>
  total: number
  shown: number
}) {
  /**
   * URL with one chip set or cleared, preserving the guest party.
   *
   * `selected.personen` is DERIVED from the party (see VillaFilterState) and must never be written into
   * a chip URL: carrying `?personen=6` without the `?volwassenen=…` it came from would leave the stepper
   * showing one adult while the grid filtered for six. `partyParams` carries the party's own parameters
   * instead, so the two stay in step.
   */
  const href = (patch: Record<string, string>) => {
    const next = { ...selected, ...patch }
    delete next.personen
    const params = new URLSearchParams({ ...partyParams })
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  /**
   * `selected` includes `personen` when the party is non-default, so the count line and the reset link
   * both account for the stepper — resetting from a party of 8 returns to all five villas, not to a
   * chip-cleared URL that still filters by capacity. `base` carries no query string, so the single
   * reset link clears everything.
   */
  const isFiltered = Object.values(selected).some(Boolean)

  return (
    <div className="villafilter">
      {/* The chip row can legitimately be empty (a collection where every villa shares one location),
          but the count and the reset must still render — the stepper above can filter on its own. */}
      {filters.length > 0 && (
      <nav className="villafilter-row" aria-label={t(locale, 'filterVillas')}>
        <span className="villafilter-label">{t(locale, 'filterVillas')}</span>
        <ul className="villafilter-list">
          <li>
            <LocaleLink
              href={base}
              className={`chip${isFiltered ? '' : ' is-active'}`}
              aria-current={isFiltered ? undefined : 'true'}
            >
              {t(locale, 'filterAll')}
            </LocaleLink>
          </li>
          {filters.flatMap((f) =>
            f.values(all).map((value) => {
              const active = selected[f.id] === value
              // A single-value filter (dogs allowed) reads better as its own label than "Honden: ja".
              const single = f.values(all).length === 1
              const label = single
                ? t(locale, f.labelKey as UiKey)
                : `${f.valueLabel ? f.valueLabel(value) : value}`
              return (
                <li key={`${f.id}-${value}`}>
                  <LocaleLink
                    // Clicking an active chip clears it, so a chip is a toggle without JavaScript.
                    href={href({ [f.id]: active ? '' : value })}
                    className={`chip${active ? ' is-active' : ''}`}
                    aria-current={active ? 'true' : undefined}
                  >
                    {label}
                  </LocaleLink>
                </li>
              )
            }),
          )}
        </ul>
      </nav>
      )}
      <p className="villafilter-count" role="status">
        {shown === total
          ? t(locale, 'villaCountAll').replace('{n}', String(total))
          : t(locale, 'villaCountFiltered').replace('{n}', String(shown)).replace('{total}', String(total))}
        {isFiltered && (
          <>
            {' · '}
            <LocaleLink href={base} className="villafilter-reset">
              {t(locale, 'reset')}
            </LocaleLink>
          </>
        )}
      </p>
    </div>
  )
}
