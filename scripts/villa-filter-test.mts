/**
 * Villa overview filters — behaviour pinned against the REAL content.
 *
 * Reads `content/<locale>/villas.json` rather than a fixture, so a number changed in the CMS shows up
 * here as a failing expectation instead of passing against a copy that has drifted. That matters most
 * for capacity and bedrooms, which are the two the client supplied and the two the JSON-LD publishes.
 *
 * Covers, per the task document:
 *   · 1 / 6 guests → all five; 7 / 8 → Watersnip excluded; 9+ → empty if forced through the URL
 *   · babies never change the result
 *   · bedrooms as "at least N"
 *   · guests AND bedrooms AND chips combined
 *   · reset restores the default
 *   · the empty state
 *   · the stepper cannot exceed 8 adults + children
 */
import { readFileSync } from 'node:fs'

import {
  canDecrement,
  canIncrement,
  clampParty,
  DEFAULT_PARTY,
  isPartyFiltered,
  partyFromParams,
  partyToParams,
  PARTY_LIMITS,
  PARTY_PARAMS,
  requiredCapacity,
  type GuestParty,
} from '../lib/guest-party.js'
import type { VillaCollection } from '../lib/types.js'
import { activeVillaFilters, filterVillas, villaAttributes } from '../lib/villa-filter.js'

let fail = 0
let checks = 0

function check(name: string, ok: boolean, detail = '') {
  checks++
  if (!ok) fail++
  console.log(ok ? '  ok  ' : '  FAIL', name.padEnd(58), detail)
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? '' : `got ${a}, want ${e}`)
}

/** The slugs a given filter state returns, in content order. */
function slugsFor(villas: VillaCollection, selected: Record<string, string>): string[] {
  const entries = Object.entries(villas).map(([slug, villa]) => ({ slug, villa, item: slug }))
  return filterVillas(entries, selected).map((e) => e.slug)
}

/** The `selected` map the UI builds for a party — mirrors VillaFilterState. */
function selectedFor(party: GuestParty, extra: Record<string, string> = {}): Record<string, string> {
  const out = { ...extra }
  if (isPartyFiltered(party)) out.personen = String(requiredCapacity(party))
  return out
}

const party = (adults: number, children = 0, babies = 0): GuestParty =>
  clampParty({ adults, children, babies })

for (const locale of ['nl', 'de']) {
  const villas = JSON.parse(readFileSync(`content/${locale}/villas.json`, 'utf8')) as VillaCollection
  const all = Object.values(villas).map(villaAttributes)
  const every = Object.keys(villas)
  const watersnip = every.find((s) => s.includes('watersnip'))!
  const fourVillas = every.filter((s) => s !== watersnip)

  console.log(`\n=== ${locale.toUpperCase()} — ${every.length} villas ===`)
  console.log(`    capacities: ${all.map((a) => a.guests ?? '-').join(', ')}`)
  console.log(`    bedrooms:   ${all.map((a) => a.bedrooms ?? '-').join(', ')}`)

  /* --- the numbers themselves ------------------------------------------------------------------- */

  check('every villa states a capacity', all.every((a) => a.guests !== undefined))
  check('every villa states a bedroom count', all.every((a) => a.bedrooms !== undefined))
  check('every villa states a bathroom count', all.every((a) => a.bathrooms !== undefined))

  /* --- guest capacity --------------------------------------------------------------------------- */

  eq('1 adult -> all five', slugsFor(villas, selectedFor(party(1))), every)
  eq('6 adults -> all five', slugsFor(villas, selectedFor(party(6))), every)
  eq('2 adults + 2 children -> all five', slugsFor(villas, selectedFor(party(2, 2))), every)
  eq('4 adults + 2 children -> all five', slugsFor(villas, selectedFor(party(4, 2))), every)
  eq('7 (6+1) -> Watersnip excluded', slugsFor(villas, selectedFor(party(6, 1))), fourVillas)
  eq('8 (4+4) -> Watersnip excluded', slugsFor(villas, selectedFor(party(4, 4))), fourVillas)
  eq('8 adults -> Watersnip excluded', slugsFor(villas, selectedFor(party(8))), fourVillas)

  // 9+ cannot be composed through the UI; forced through the URL it must return nothing, not everything.
  eq('forced ?personen=9 -> empty', slugsFor(villas, { personen: '9' }), [])

  /* --- babies do not consume capacity ------------------------------------------------------------ */

  eq('4+2 with 2 babies -> all five', slugsFor(villas, selectedFor(party(4, 2, 2))), every)
  eq('8 adults + 2 babies -> four villas', slugsFor(villas, selectedFor(party(8, 0, 2))), fourVillas)
  eq('babies alone change nothing', requiredCapacity(party(2, 1, 2)), requiredCapacity(party(2, 1, 0)))

  /* --- bedrooms, as "at least N" ----------------------------------------------------------------- */

  for (const n of [1, 2, 3]) {
    eq(`bedrooms >= ${n} -> all five`, slugsFor(villas, { slaapkamers: String(n) }), every)
  }
  eq('bedrooms >= 4 -> Watersnip excluded', slugsFor(villas, { slaapkamers: '4' }), fourVillas)
  eq('bedrooms >= 5 -> empty', slugsFor(villas, { slaapkamers: '5' }), [])

  /* --- combining, with AND ----------------------------------------------------------------------- */

  eq(
    'party of 8 AND bedrooms >= 4 -> four villas',
    slugsFor(villas, selectedFor(party(8), { slaapkamers: '4' })),
    fourVillas,
  )
  eq(
    'party of 2 AND bedrooms >= 4 -> four villas (bedrooms narrows)',
    slugsFor(villas, selectedFor(party(2), { slaapkamers: '4' })),
    fourVillas,
  )
  eq(
    'party of 8 AND dogs -> empty (Watersnip is the only dog villa)',
    slugsFor(villas, selectedFor(party(8), { hond: 'ja' })),
    [],
  )
  eq(
    'party of 6 AND dogs -> Watersnip only',
    slugsFor(villas, selectedFor(party(6), { hond: 'ja' })),
    [watersnip],
  )
  eq(
    'bedrooms >= 4 AND Ballum -> empty (Watersnip is the only Ballum house)',
    slugsFor(villas, { slaapkamers: '4', plaats: 'Ballum' }),
    [],
  )

  /* --- the property a future date filter depends on ---------------------------------------------- */

  /**
   * There is no date filter in this codebase — availability lives in the Tommy booking widget, which the
   * original brief puts out of scope, and nothing here queries it. What IS verifiable is the property
   * such a filter would rely on: an unknown query parameter must narrow NOTHING rather than empty the
   * grid, so wiring one up later cannot silently blank the page before its matcher exists.
   */
  eq('unknown parameter ignored, not treated as no-match', slugsFor(villas, { periode: '2026-07-01' }), every)
  eq(
    'unknown parameter alongside real ones does not widen them',
    slugsFor(villas, selectedFor(party(8), { periode: '2026-07-01' })),
    fourVillas,
  )

  /* --- reset ------------------------------------------------------------------------------------- */

  eq('reset (no parameters) -> all five', slugsFor(villas, {}), every)
  eq('reset from a filtered state -> all five', slugsFor(villas, selectedFor(DEFAULT_PARTY)), every)
  check('default party is not "filtered"', !isPartyFiltered(DEFAULT_PARTY))
  eq('default party writes no query parameters', partyToParams(DEFAULT_PARTY), {})

  /* --- the chip row ------------------------------------------------------------------------------ */

  const chips = activeVillaFilters(all)
  check('capacity is not offered as a chip', !chips.some((f) => f.id === 'personen'))
  check(
    'bedrooms IS offered as a chip',
    chips.some((f) => f.id === 'slaapkamers'),
  )
  const bedroomChip = chips.find((f) => f.id === 'slaapkamers')!
  eq('bedroom chip values', bedroomChip.values(all), ['3', '4'])
  eq('bedroom chip labels say "at least"', bedroomChip.valueLabel?.('4'), '4+')
}

/* --- the stepper's own rules (content-independent) ----------------------------------------------- */

console.log('\n=== guest party rules ===')

eq('default is one adult', DEFAULT_PARTY, { adults: 1, children: 0, babies: 0 })
eq('capacity = adults + children', requiredCapacity({ adults: 3, children: 2, babies: 2 }), 5)

// The cap the brief asks for, from both directions.
check('cannot add a 9th person via adults', !canIncrement(party(8), 'adults'))
check('cannot add a 9th person via children', !canIncrement(party(4, 4), 'children'))
check('can still add a baby at 8 guests', canIncrement(party(8), 'babies'))
check('cannot add a 3rd baby', !canIncrement(party(1, 0, 2), 'babies'))
check('cannot go below one adult', !canDecrement(party(1), 'adults'))
check('cannot go below zero children', !canDecrement(party(1, 0), 'children'))
check('cannot go below zero babies', !canDecrement(party(1, 0, 0), 'babies'))
check('can add an adult at 7', canIncrement(party(7), 'adults'))
check('can remove an adult at 2', canDecrement(party(2), 'adults'))

// Clamping: the URL is public, so every malformed value must land somewhere legal.
eq('clamp 99 adults', clampParty({ adults: 99, children: 0, babies: 0 }).adults, 8)
eq('clamp 0 adults up to 1', clampParty({ adults: 0, children: 0, babies: 0 }).adults, 1)
eq('clamp 9 babies', clampParty({ adults: 1, children: 0, babies: 9 }).babies, 2)
eq('over-capacity trims children, not adults', clampParty({ adults: 6, children: 9, babies: 0 }), {
  adults: 6,
  children: 2,
  babies: 0,
})
eq('NaN falls back to the minimum', clampParty({ adults: NaN, children: NaN, babies: NaN }), DEFAULT_PARTY)
eq(
  'clamped party never exceeds the cap',
  requiredCapacity(clampParty({ adults: 8, children: 8, babies: 0 })),
  PARTY_LIMITS.occupancyMax,
)

// URL round-trip.
const roundTrip = party(3, 2, 1)
const roundTripParams = partyToParams(roundTrip)
eq('party -> params', roundTripParams, {
  [PARTY_PARAMS.adults]: '3',
  [PARTY_PARAMS.children]: '2',
  [PARTY_PARAMS.babies]: '1',
})
eq('params -> party', partyFromParams((k) => roundTripParams[k] ?? null), roundTrip)
eq(
  'a hand-edited over-cap URL clamps rather than empties',
  partyFromParams((k) => ({ [PARTY_PARAMS.adults]: '99', [PARTY_PARAMS.children]: '99' })[k] ?? null),
  { adults: 8, children: 0, babies: 0 },
)

console.log(`\n${checks} checks`)
console.log(fail === 0 ? 'ALL VILLA FILTER CHECKS PASSED' : `\n${fail} FAILURE(S)`)
process.exit(fail === 0 ? 0 : 1)
