/**
 * Villa overview filters — the attribute set, and how a villa's values are resolved.
 *
 * Four filters are live: GUESTS, BEDROOMS, pets and location. All combine with AND.
 *
 * Every value resolves through ONE function, `villaAttributes()`, which reads `villa.guests ??
 * facts.guests` — the numeric field the content now carries, falling back to the prose parse in
 * `villa-facts.ts` for anything not filled in. The fallback is what keeps a half-populated collection
 * degrading villa by villa instead of failing as a whole.
 *
 * GUESTS AND BEDROOMS WERE SWITCHED OFF UNTIL THE NUMBERS EXISTED, and the reason is worth keeping:
 * parsed from prose, capacity resolved on only 4 of 10 pages, and bedrooms gave 4,4,4,4,3 in Dutch but
 * 4,3,-,1,3 in German for the SAME five houses (the German checklists lost their bedroom rows in
 * migration). Filtering on a number that is absent on six pages, or contradicts itself between
 * languages, is worse than not offering the filter. The client has since supplied the authoritative
 * figures (`scripts/set-villa-numbers.mts`), which resolve both problems in the Dutch content's favour.
 *
 * WHY sauna AND EV CHARGING ARE STILL NOT FILTERS
 *
 * Measured across all ten villa pages: both are true on 10/10. A filter that never excludes anything is
 * not a filter — it is a button that reloads the page. They stay visible as facts on the cards instead.
 *
 * THE URL IS THE STATE. Every filter reads and writes a query parameter, so each combination is a real,
 * bookmarkable, crawlable URL and the whole overview keeps working with JavaScript disabled — the brief
 * requires all villas and their links to stay in the HTML. Capacity is composed with a stepper rather
 * than a chip (`chip: false`), but it obeys the identical contract.
 */
import type { VillaContent } from './types'
import { villaFacts } from './villa-facts'

/** Everything the overview can filter or sort on, resolved for one villa. */
export type VillaAttributes = {
  guests?: number
  bedrooms?: number
  bathrooms?: number
  sauna: boolean
  petsAllowed?: boolean
  evCharging: boolean
  locality?: string
}

/**
 * Resolve one villa's filterable attributes.
 *
 * THE SINGLE SEAM for the CMS upgrade. Right now every value comes from the prose parse; once
 * `VillaContent` carries real fields, prefer those here and delete nothing else.
 */
export function villaAttributes(villa: VillaContent): VillaAttributes {
  const facts = villaFacts(villa)
  return {
    // The CMS field wins; the prose parse is the fallback. `??` (not `||`) so a genuine 0 would survive,
    // and so a half-filled collection degrades villa-by-villa instead of failing as a whole.
    guests: villa.guests ?? facts.guests,
    bedrooms: villa.bedrooms ?? facts.bedrooms,
    bathrooms: villa.bathrooms ?? facts.bathrooms,
    sauna: facts.sauna,
    petsAllowed: facts.petsAllowed,
    evCharging: facts.evCharging,
    locality: facts.locality,
  }
}

/**
 * A filter the overview can offer.
 *
 * `enabled: false` keeps a definition in the codebase, documented and ready, without rendering a control
 * that would mislead. Flipping it is the whole job once the data supports it.
 */
export type VillaFilter = {
  /** Stable id used in the URL (`?f=hond`). Must not change — filter states are linkable. */
  id: string
  /** Which UI-text key holds the label. */
  labelKey: 'filterPets' | 'filterLocation' | 'filterGuests' | 'filterBedrooms'
  /** Whether to render it. */
  enabled: boolean
  /**
   * Whether the chip row renders this filter. Defaults to true.
   *
   * `false` means the filter is live and combines like any other, but a different control drives it —
   * guest capacity is composed with a stepper, so a row of "2, 3, 4… persons" chips beside it would be
   * a second, contradictory way to set the same parameter.
   */
  chip?: boolean
  /** Does this villa match the given filter value? */
  matches: (attrs: VillaAttributes, value: string) => boolean
  /** The distinct values present across the collection, in display order. */
  values: (all: VillaAttributes[]) => string[]
  /** How to label one value (a locality is its own label; a boolean is a yes/no chip). */
  valueLabel?: (value: string) => string
}

export const VILLA_FILTERS: VillaFilter[] = [
  {
    // Only genuinely discriminating boolean: 1 of 10 villas allows dogs.
    id: 'hond',
    labelKey: 'filterPets',
    enabled: true,
    matches: (a) => a.petsAllowed === true,
    values: (all) => (all.some((a) => a.petsAllowed === true) ? ['ja'] : []),
  },
  {
    // Nes (9) vs Ballum (1). Two real options, both stated on every page.
    id: 'plaats',
    labelKey: 'filterLocation',
    enabled: true,
    matches: (a, v) => (a.locality ?? '').toLowerCase() === v.toLowerCase(),
    values: (all) => [...new Set(all.map((a) => a.locality).filter((x): x is string => !!x))].sort(),
    valueLabel: (v) => v,
  },
  {
    /**
     * Guest capacity — "sleeps at least N".
     *
     * Rendered by the stepper (`GuestPartyPicker`), not as a chip, because the visitor composes a party
     * of adults + children + babies rather than picking a single number. The definition stays here so
     * the URL contract, the AND-combination and the no-JavaScript path are identical to every other
     * filter; `chip: false` only says the chip row must not also render it.
     */
    id: 'personen',
    labelKey: 'filterGuests',
    enabled: true,
    chip: false,
    matches: (a, v) => a.guests !== undefined && a.guests >= Number(v),
    values: (all) => [...new Set(all.map((a) => a.guests).filter((n): n is number => n !== undefined))].sort((x, y) => x - y).map(String),
  },
  {
    /**
     * Bedrooms — "at least N", per the brief. The label says so explicitly ("4+ slaapkamers"), because
     * "4 slaapkamers" on an at-least filter reads as exact and would make Watersnip's absence look
     * like a bug rather than the rule working.
     */
    id: 'slaapkamers',
    labelKey: 'filterBedrooms',
    enabled: true,
    matches: (a, v) => a.bedrooms !== undefined && a.bedrooms >= Number(v),
    values: (all) => [...new Set(all.map((a) => a.bedrooms).filter((n): n is number => n !== undefined))].sort((x, y) => x - y).map(String),
    valueLabel: (v) => `${v}+`,
  },
]

/**
 * The filters that actually render as CHIPS, given what the current collection supports.
 *
 * A filter with a single possible value is dropped: "Nes" alone excludes nothing, so it would be a
 * button that reloads the page. Guest capacity is excluded via `chip: false` — the stepper drives it.
 */
export function activeVillaFilters(all: VillaAttributes[]): VillaFilter[] {
  return VILLA_FILTERS.filter((f) => f.enabled && f.chip !== false && f.values(all).length > 0)
}

/**
 * Apply the selected filter values.
 *
 * `selected` maps a filter id to its chosen value. Filters combine with AND (a dog-friendly villa in
 * Ballum), which is what a visitor narrowing a list expects. An unknown id or value is ignored rather
 * than returning nothing, so a stale link degrades to the full list.
 */
export function filterVillas<T>(
  entries: { slug: string; villa: VillaContent; item: T }[],
  selected: Record<string, string>,
): { slug: string; villa: VillaContent; item: T }[] {
  const active = Object.entries(selected).filter(([, v]) => !!v)
  if (active.length === 0) return entries

  return entries.filter(({ villa }) => {
    const attrs = villaAttributes(villa)
    return active.every(([id, value]) => {
      const f = VILLA_FILTERS.find((x) => x.id === id && x.enabled)
      if (!f) return true // unknown filter: do not exclude anything
      return f.matches(attrs, value)
    })
  })
}
