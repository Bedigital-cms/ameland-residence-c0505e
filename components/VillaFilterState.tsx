'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import {
  clampParty,
  isPartyFiltered,
  partyFromParams,
  partyToParams,
  requiredCapacity,
  type GuestParty,
} from '@/lib/guest-party'
import type { Card, VillaCollection } from '@/lib/types'
import { t } from '@/lib/ui-text'
import { activeVillaFilters, filterVillas, villaAttributes, VILLA_FILTERS } from '@/lib/villa-filter'

import { GuestPartyPicker } from './GuestPartyPicker'
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

  /** The guest composition, clamped — a hand-edited `?volwassenen=99` becomes the maximum, not nothing. */
  const party = useMemo(() => partyFromParams((k) => params.get(k)), [params])

  /**
   * Read only the filter ids this build offers; anything else in the query string is ignored.
   *
   * Capacity is DERIVED from the party rather than read from `?personen=` directly, so the stepper and
   * the capacity filter cannot disagree — the party is the single source of truth for how many people
   * there are, and `?personen=` is its output.
   */
  const selected = useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of VILLA_FILTERS) {
      if (!f.enabled || f.id === 'personen') continue
      const v = (params.get(f.id) ?? '').trim()
      if (v) out[f.id] = v
    }
    // Omit the default party of one adult: every villa sleeps at least six, so it would exclude nothing
    // while making the canonical hub URL look filtered.
    if (isPartyFiltered(party)) out.personen = String(requiredCapacity(party))
    return out
  }, [params, party])

  const shown = useMemo(() => filterVillas(entries, selected), [entries, selected])

  /** URL for a different party, preserving whichever chip filters are already active. */
  const hrefForParty = useMemo(() => {
    const others: Record<string, string> = {}
    for (const [k, v] of Object.entries(selected)) if (k !== 'personen' && v) others[k] = v
    return (next: GuestParty) => {
      const qs = new URLSearchParams({ ...others, ...partyToParams(clampParty(next)) }).toString()
      return qs ? `${base}?${qs}` : base
    }
  }, [selected, base])

  return (
    <>
      <GuestPartyPicker locale={locale} party={party} hrefForParty={hrefForParty} />
      <VillaFilter
        locale={locale}
        base={base}
        filters={filters}
        all={allAttrs}
        selected={selected}
        partyParams={partyToParams(party)}
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
