/**
 * Villa overview filters — the attribute set, and how a villa's values are resolved.
 *
 * DESIGNED TO SURVIVE THE CMS UPGRADE.
 *
 * The task document asks to filter on guests, bedrooms, sauna, pets, location and EV charging. Today
 * `VillaContent` has no numeric or boolean fields, so values are parsed out of each villa's own prose by
 * `villaFacts`. That parsing is unreliable for two of the attributes (measured, see below), so those two
 * filters are switched OFF rather than shipped broken.
 *
 * Everything sits behind ONE function — `villaAttributes()`, which now reads `villa.guests ??
 * facts.guests`: the CMS field when it exists, the prose parse when it does not. The wiring is DONE.
 *
 * WHAT IS LEFT is data, not code. `guests` / `bedrooms` / `bathrooms` are declared on `VillaContent` and
 * the CMS renders inputs for them automatically, but no villa carries a value yet. The moment the numbers
 * are filled in for all ten villas in BOTH languages, flip `enabled: true` on the two definitions below
 * and the filters appear. The UI, the URL contract, the no-JavaScript behaviour and the crawlable links
 * need no change — that is the point of doing the wiring ahead of the data.
 *
 * Note the flags are NOT auto-derived from "is the field populated". A filter that materialises halfway
 * through data entry would ship a control that silently hides villas whose number is still missing.
 * Turning it on stays a deliberate act, taken once the data is known to be complete.
 *
 * WHY sauna AND EV CHARGING ARE NOT FILTERS
 *
 * Measured across all ten villa pages: both are true on 10/10. A filter that never excludes anything is
 * not a filter — it is a button that reloads the page. They stay visible as facts on the cards instead.
 *
 * WHY guests IS OFF
 *
 * Stated on 1 of 10 pages (`nl/villa-zee`, "Luxe 8-persoons duinvilla"). Filtering on it would hide nine
 * villas that simply do not mention a number.
 *
 * WHY bedrooms IS OFF
 *
 * The Dutch pages parse consistently (4,4,4,4,3) but the German ones give 4,3,-,1,3 for the SAME five
 * houses, because the German checklists lost their bedroom lines in migration. Filtering on a number that
 * is wrong per language is worse than not offering it.
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
    // OFF until every villa carries a `guests` number in both languages. The prose fallback resolves it
    // on only 4 of 10 pages, so enabling now would hide six villas that simply never state a capacity.
    id: 'personen',
    labelKey: 'filterGuests',
    enabled: false,
    matches: (a, v) => !!a.guests && a.guests >= Number(v),
    values: (all) => [...new Set(all.map((a) => a.guests).filter((n): n is number => !!n))].sort((x, y) => x - y).map(String),
  },
  {
    // OFF until every villa carries a `bedrooms` number in both languages. The prose fallback gives
    // 4,4,4,4,3 in Dutch but 4,3,-,1,3 in German for the SAME five houses — a per-language contradiction
    // the numeric field is meant to settle (see the cross-language check in villa-facts-test.mts).
    id: 'slaapkamers',
    labelKey: 'filterBedrooms',
    enabled: false,
    matches: (a, v) => !!a.bedrooms && a.bedrooms >= Number(v),
    values: (all) => [...new Set(all.map((a) => a.bedrooms).filter((n): n is number => !!n))].sort((x, y) => x - y).map(String),
  },
]

/** The filters that actually render, given what the current collection supports. */
export function activeVillaFilters(all: VillaAttributes[]): VillaFilter[] {
  return VILLA_FILTERS.filter((f) => f.enabled && f.values(all).length > 0)
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
