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
  total,
  shown,
}: {
  locale: string
  /** Hub path, prefix-free ("/villa-s"); LocaleLink adds the language prefix. */
  base: string
  filters: FilterDef[]
  /** Attributes of every villa, used to derive each filter's available values. */
  all: VillaAttributes[]
  /** filter id -> chosen value. */
  selected: Record<string, string>
  total: number
  shown: number
}) {
  if (filters.length === 0) return null

  /** URL with one filter set or cleared; omits empties so the clean hub URL stays canonical. */
  const href = (patch: Record<string, string>) => {
    const next = { ...selected, ...patch }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  const isFiltered = Object.values(selected).some(Boolean)

  return (
    <div className="villafilter">
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
