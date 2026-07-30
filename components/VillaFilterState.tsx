'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import type { Card, VillaCollection } from '@/lib/types'
import { t } from '@/lib/ui-text'
import { activeVillaFilters, filterVillas, villaAttributes, VILLA_FILTERS } from '@/lib/villa-filter'

import { CardGrid, type CardFact } from './sections'
import { VillaFilter } from './VillaFilter'

/**
 * Applies the villa overview's filter state (`?hond=ja&plaats=Nes`) on the client.
 *
 * Same arrangement as the blog hub, for the same reason: reading `searchParams` in the server component
 * would opt the whole `[slug]` route out of static generation, and the villa hub is one of the most-linked
 * pages on the site.
 *
 * The SERVER renders the complete, unfiltered grid as the Suspense fallback — so every villa card and link
 * is in the static HTML, which the brief requires ("all villas and links must remain present in the HTML
 * and accessible without JavaScript"). This component then re-renders the same grid narrowed. The chips
 * are ordinary links, so a JS-less visitor filters via a normal page load instead.
 */
export function VillaFilterState({
  locale,
  villas,
  base,
  cards,
  cardFacts,
  cardLevel,
}: {
  locale: string
  villas: VillaCollection
  /** Hub path, prefix-free ("/villa-s"). */
  base: string
  /** The cards the server already built, keyed by villa slug. */
  cards: Record<string, Card>
  cardFacts: Record<string, CardFact[]>
  cardLevel: 2 | 3
}) {
  const params = useSearchParams()

  const entries = useMemo(
    () => Object.entries(villas).map(([slug, villa]) => ({ slug, villa, item: cards[slug] })),
    [villas, cards],
  )

  const allAttrs = useMemo(() => entries.map((e) => villaAttributes(e.villa)), [entries])
  const filters = useMemo(() => activeVillaFilters(allAttrs), [allAttrs])

  /** Read only the filter ids this build offers; anything else in the query string is ignored. */
  const selected = useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of VILLA_FILTERS) {
      if (!f.enabled) continue
      const v = (params.get(f.id) ?? '').trim()
      if (v) out[f.id] = v
    }
    return out
  }, [params])

  const shown = useMemo(() => filterVillas(entries, selected), [entries, selected])

  return (
    <>
      <VillaFilter
        locale={locale}
        base={base}
        filters={filters}
        all={allAttrs}
        selected={selected}
        total={entries.length}
        shown={shown.length}
      />
      {shown.length > 0 ? (
        <CardGrid
          items={shown.map((e) => e.item).filter(Boolean)}
          columns={3}
          variant="overlay"
          level={cardLevel}
          facts={cardFacts}
        />
      ) : (
        /* A combination can legitimately match nothing (a dog-friendly villa in Nes). Say so, rather
           than showing an empty grid — the reset link sits in the filter row above. */
        <p className="blogempty">{t(locale, 'noVillas')}</p>
      )}
    </>
  )
}
