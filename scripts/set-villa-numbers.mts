/**
 * One-time: write the authoritative guest / bedroom / bathroom numbers into the villa content.
 *
 * These five houses had no numeric fields. Everything downstream — the filters, the key-facts strip, the
 * `VacationRental` JSON-LD — read them out of each page's prose, which produced gaps (no capacity on 6 of
 * 10 pages) and two outright contradictions between the languages (villa-stern 4 vs 3 bedrooms,
 * villa-nova 4 vs 1). The numbers below were supplied by the client and settle both, matching the Dutch
 * content in every case.
 *
 * WHY A SCRIPT RATHER THAN HAND-EDITING
 *
 * The same five values must land in two files (nl and de) whose villa keys differ for the bungalow.
 * Doing that by hand is where a transposed digit hides. The script also refuses to write unless a no-op
 * JSON round-trip reproduces each file byte for byte, so re-serialising cannot reformat unrelated lines
 * and bury the real change — the same guard `restore-villa-checklist.mts` uses.
 *
 * Re-running is a no-op. Kept in the repo as the record of where the numbers came from.
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** Client-supplied, authoritative. One entry per physical house. */
const NUMBERS: Record<string, { guests: number; bedrooms: number; bathrooms: number }> = {
  'villa-zee': { guests: 8, bedrooms: 4, bathrooms: 2 },
  'villa-stern': { guests: 8, bedrooms: 4, bathrooms: 1 },
  'villa-zilt': { guests: 8, bedrooms: 4, bathrooms: 2 },
  'villa-nova': { guests: 8, bedrooms: 4, bathrooms: 2 },
  'luxe-bungalow-watersnip': { guests: 6, bedrooms: 3, bathrooms: 1 },
}

/** The German file spells the bungalow differently; every other slug matches. */
const DE_SLUG: Record<string, string> = { 'luxe-bungalow-watersnip': 'luxesbungalow-watersnip' }

const write = process.argv.includes('--write')
let changes = 0

for (const locale of ['nl', 'de']) {
  const file = `content/${locale}/villas.json`
  const raw = readFileSync(file, 'utf8')
  const data = JSON.parse(raw) as Record<string, Record<string, unknown>>

  // Refuse to touch a file we cannot reproduce: otherwise the diff would be the whole file.
  const roundTrip = JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : '')
  if (roundTrip !== raw) {
    console.error(`FAIL ${file}: a no-op round-trip does not reproduce the file byte for byte.`)
    console.error('     Writing would reformat unrelated lines. Aborting without changes.')
    process.exit(1)
  }

  for (const [nlSlug, n] of Object.entries(NUMBERS)) {
    const slug = locale === 'de' ? (DE_SLUG[nlSlug] ?? nlSlug) : nlSlug
    const villa = data[slug]
    if (!villa) {
      console.error(`FAIL ${file}: no villa "${slug}"`)
      process.exit(1)
    }
    for (const [key, value] of Object.entries(n)) {
      if (villa[key] === value) continue
      console.log(`${locale}/${slug}`.padEnd(34), `${key}: ${villa[key] ?? '-'} -> ${value}`)
      villa[key] = value
      changes++
    }
  }

  if (write) {
    writeFileSync(file, JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : ''))
  }
}

console.log(changes === 0 ? '\nAlready up to date (no-op).' : `\n${changes} field(s) ${write ? 'written' : 'to write — re-run with --write'}`)
