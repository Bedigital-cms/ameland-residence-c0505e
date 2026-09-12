import { readFileSync } from 'node:fs'

import type { VillaContent } from '../lib/types.js'
import { villaFacts } from '../lib/villa-facts.js'
import { villaAttributes } from '../lib/villa-filter.js'
/**
 * Guest capacity stays strict — it is only ever read from a whole-property field (cardText, seo.title,
 * seo.description) where a number is followed by a persons word AND an accommodation noun. It is never
 * inferred from a room row, so "Schlafzimmer mit 2 Boxspringbetten" still yields nothing.
 *
 * The German villas resolve a capacity because their meta descriptions now state one ("für 8 Personen").
 * Those descriptions replaced a single generic text that all four shared; each number was checked against
 * that villa's own page before being written (de/villa-* say "8 Personen", Watersnip says "6 Personen").
 * The Dutch pages are unchanged: only nl/villa-zee phrases it as "8-persoons duinvilla", the rest state
 * capacity in prose the extractor deliberately does not trust.
 *
 * Bedrooms come from the restored checklist rows — each value checked against the content.
 *
 * NOTE these are expectations for the PROSE PARSE with today's content. Once a villa carries a real
 * `guests`/`bedrooms` field, its resolved value comes from that field instead and this table stops
 * describing it — see the second check below, which is the one that matters after the CMS work.
 */
const WANT: Record<string, { guests?: number; bed?: number }> = {
  'nl/villa-zee': { guests: 8, bed: 4 },   // "Slaapkamer met 2 boxsprings" (1) + "Drie 2-persoons slaapkamers" (3)
  'nl/villa-stern': { bed: 4 }, 'nl/villa-zilt': { bed: 4 }, 'nl/villa-nova': { bed: 4 },
  'nl/luxe-bungalow-watersnip': { bed: 3 },      // restored "Slaapkamer (3)"
  'de/villa-zee': { guests: 8, bed: 4 },         // 1 + restored "Doppelzimmer… (3)"
  'de/villa-stern': { bed: 3 },                  // restored "Doppelzimmer… (3)"; desc states no capacity
  'de/villa-zilt': { guests: 8 },                // old page lists no bedroom row either
  'de/villa-nova': { guests: 8, bed: 1 },        // only the downstairs Schlafzimmer is listed
  'de/luxesbungalow-watersnip': { guests: 6, bed: 3 },   // restored "Schlafzimmer (3)"
}

/**
 * Which Dutch slug and which German slug are the same physical house.
 *
 * Four match by name; the bungalow is spelled differently per language. This is the same hand-verified
 * pairing `content/equivalents.ts` uses for hreflang — repeated here rather than imported because that
 * module resolves URLs, and this script only needs the slug pair.
 */
const SAME_HOUSE: [string, string][] = [
  ['villa-zee', 'villa-zee'],
  ['villa-stern', 'villa-stern'],
  ['villa-zilt', 'villa-zilt'],
  ['villa-nova', 'villa-nova'],
  ['luxe-bungalow-watersnip', 'luxesbungalow-watersnip'],
]

/**
 * Contradictions that ALREADY EXIST in the migrated content, with the reason each one is not a bug in
 * this codebase. They are reported as `known` rather than `FAIL`, so the check can go into `pnpm verify`
 * today and still fail loudly on a NEW disagreement — a gate that is red on arrival gets ignored, and
 * then it catches nothing.
 *
 * Each entry disappears the moment the CMS numbers land: a real `bedrooms` field makes both languages
 * agree, the exception stops matching, and the script says so. Leaving a stale entry here is therefore
 * self-reporting, not silent.
 */
const KNOWN_DISAGREEMENT: Record<string, string> = {
  // EMPTY, and it should stay that way.
  //
  // It once held villa-stern (nl 4 vs de 3 bedrooms) and villa-nova (nl 4 vs de 1), both caused by
  // German checklists that lost rows in migration. The client's numbers settled both in the Dutch
  // content's favour, the exceptions stopped matching, and the stale-entry report below is what
  // prompted their removal. Add an entry only for a disagreement that is genuinely in the source data
  // and cannot be fixed — never to quiet a failure.
}

const content: Record<string, Record<string, VillaContent>> = {}
for (const loc of ['nl', 'de']) {
  content[loc] = JSON.parse(readFileSync(`content/${loc}/villas.json`, 'utf8'))
}

let fail = 0

/* --- 1. the prose parse still reads exactly what the content states ------------------------------ */

console.log('\n=== parse expectations ===')
for (const loc of ['nl', 'de']) {
  for (const [slug, x] of Object.entries(content[loc])) {
    const f = villaFacts(x); const k = `${loc}/${slug}`; const w = WANT[k] ?? {}
    const ok = f.guests === w.guests && f.bedrooms === w.bed
    if (!ok) fail++
    console.log(ok ? 'ok  ' : 'FAIL', k.padEnd(30), `guests=${f.guests ?? '-'} (want ${w.guests ?? '-'})`, `bed=${f.bedrooms ?? '-'} (want ${w.bed ?? '-'})`)
  }
}

/* --- 2. a house does not change size between languages ------------------------------------------- */

/**
 * THE CHECK THAT GUARDS THE CMS WORK.
 *
 * `guests` / `bedrooms` / `bathrooms` are stored once per language, in two separate files, but they
 * describe one building. Nothing in the content model stops content/nl saying a villa sleeps eight while
 * content/de says six, and nothing on either page would look wrong — the contradiction only shows up in
 * the JSON-LD and the filter results, where it is a false claim about the property.
 *
 * So the pair is compared on the RESOLVED value (`villaAttributes`, i.e. CMS field first, prose parse
 * second), which is what the site actually publishes.
 *
 * A disagreement is only a failure when BOTH sides state a number. One side being silent is today's
 * normal case — the German checklists lost rows the Dutch ones kept — and reporting that as an error
 * would make the check fail from the moment it was written, which teaches everyone to ignore it. Those
 * are surfaced as `gap:` lines instead: not wrong, just not filled in yet.
 */
console.log('\n=== nl/de agreement (same house, same numbers) ===')
let gaps = 0
const knownSeen = new Set<string>()
for (const [nlSlug, deSlug] of SAME_HOUSE) {
  const nl = content.nl[nlSlug]
  const de = content.de[deSlug]
  if (!nl || !de) {
    console.log('FAIL', `${nlSlug} / ${deSlug}`.padEnd(46), 'one side is missing from villas.json')
    fail++
    continue
  }
  const a = villaAttributes(nl)
  const b = villaAttributes(de)
  const label = nlSlug === deSlug ? nlSlug : `${nlSlug} / ${deSlug}`

  for (const key of ['guests', 'bedrooms', 'bathrooms'] as const) {
    const x = a[key]
    const y = b[key]
    if (x === undefined && y === undefined) continue
    if (x !== undefined && y !== undefined && x !== y) {
      const known = KNOWN_DISAGREEMENT[`${nlSlug}:${key}`]
      if (known) {
        knownSeen.add(`${nlSlug}:${key}`)
        console.log('known', label.padEnd(45), `${key}: nl=${x} de=${y} — ${known}`)
      } else {
        console.log('FAIL', label.padEnd(46), `${key}: nl=${x} de=${y} — same house, different number`)
        fail++
      }
    } else if (x === undefined || y === undefined) {
      gaps++
      console.log('gap ', label.padEnd(46), `${key}: nl=${x ?? '-'} de=${y ?? '-'} — stated in one language only`)
    }
  }
}
if (gaps > 0) {
  console.log(`\n  ${gaps} attribute(s) stated in one language only. Not a failure: filling these in is the`)
  console.log('  CMS task that unlocks the guests/bedrooms filters (lib/villa-filter.ts).')
}

// An exception that no longer fires means the content was fixed. Say so, so the list does not rot.
const stale = Object.keys(KNOWN_DISAGREEMENT).filter((k) => !knownSeen.has(k))
if (stale.length > 0) {
  console.log(`\n  ${stale.length} KNOWN_DISAGREEMENT entr(ies) no longer apply — the content now agrees.`)
  console.log('  Delete them from scripts/villa-facts-test.mts so a real regression cannot hide behind one:')
  for (const k of stale) console.log(`      ${k}`)
}

console.log(fail === 0 ? '\nALL EXPECTATIONS MET' : `\n${fail} MISMATCH(ES)`)
process.exit(fail === 0 ? 0 : 1)
