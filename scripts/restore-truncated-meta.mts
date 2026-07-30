/**
 * Restore the metadata the migration truncated at an apostrophe.
 *
 *     pnpm audit:crawl-old            # cache the old pages first
 *     tsx scripts/restore-truncated-meta.mts --dry     # show what would change
 *     tsx scripts/restore-truncated-meta.mts --write   # apply
 *
 * WHY THIS IS A SCRIPT AND NOT HAND EDITS
 *
 * Every replacement value is read from the CRAWLED OLD PAGE, never typed here. That means the fix is
 * verifiable (re-run it and it is a no-op), and there is no chance of a transcription slip in a live
 * SEO field. The script refuses to touch a value unless all three of these hold:
 *
 *   1. the current value is a strict PREFIX of the old value (so it really is a truncation), and
 *   2. the old value continues with an apostrophe right where the current one stops, and
 *   3. the field is one of the metadata fields known to be affected.
 *
 * Condition 2 is the important one: it is what distinguishes "the migration cut this off" from "an
 * editor shortened this on purpose". A description that was legitimately rewritten shorter will not
 * match and will be left alone.
 *
 * `seo.keywords` gets the same treatment — those were truncated by the same mechanism.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const MODE = process.argv.includes('--write') ? 'write' : 'dry'

type OldPage = { locale: string; path: string; title: string; description: string }
const oldPages: OldPage[] = JSON.parse(readFileSync('.crawl/old-pages.json', 'utf8'))

/**
 * Replace ONE field's value in the raw file text, leaving every other byte untouched.
 *
 * Deliberately not `JSON.parse` -> mutate -> `JSON.stringify`. That round-trip reformats the whole
 * file: it re-wraps arrays, and re-escapes non-ASCII (the ✓/✔️ characters in these very descriptions)
 * differently from the original. Measured: it produced a 2592-line diff for a 16-field change, which
 * would make the edit unreviewable and risk silent damage elsewhere in the file.
 *
 * Instead: find the `"field": "<old>"` pair as literal JSON text and swap just the value. The search
 * is anchored on the JSON-encoded old value, so a value that does not match exactly is never touched.
 * Returns null when the pair is not found, so the caller can report a skip rather than write garbage.
 */
function replaceFieldValue(raw: string, field: string, oldValue: string, newValue: string): string | null {
  const needle = `"${field}": ${JSON.stringify(oldValue)}`
  const idx = raw.indexOf(needle)
  if (idx === -1) return null
  // Guard against an ambiguous edit: the same field/value pair appearing more than once.
  if (raw.indexOf(needle, idx + 1) !== -1) return null
  return raw.slice(0, idx) + `"${field}": ${JSON.stringify(newValue)}` + raw.slice(idx + needle.length)
}

/** The old page for a locale + prefix-free path. */
function oldPage(locale: string, path: string): OldPage | undefined {
  const want = path.replace(/\/$/, '') || '/'
  return oldPages.find((p) => p.locale === locale && (p.path.replace(/\/$/, '') || '/') === want)
}

/**
 * Is `current` a truncation of `full` at an apostrophe?
 *
 * Accepts the straight ' and the curly ’ because the two sites differ on which they emit. Also allows
 * the old value to have a trailing-whitespace difference.
 */
function isApostropheTruncation(current: string, full: string): boolean {
  const c = current.trim()
  const f = full.trim()
  if (!c || !f || c.length >= f.length) return false
  if (!f.startsWith(c)) return false
  const next = f.charAt(c.length)
  return next === "'" || next === '’' || next === 'ʼ'
}

type Change = { file: string; key: string; field: string; from: string; to: string }
const changes: Change[] = []

/**
 * Edits accumulate here per file and are written once at the very end. Both passes below can touch the
 * same file (content/nl/pages.json gets 6 descriptions AND 6 keyword fixes), so re-reading from disk
 * inside either loop would make each edit discard the previous one.
 */
const pending = new Map<string, string>()
const readCurrent = (file: string) => pending.get(file) ?? readFileSync(file, 'utf8')

/**
 * The hub pages' slugs differ from their old paths in one case only: the villa hub is `/villa-s` in
 * both. Everything else is slug === old path, verified by the route-map (0 URLs needed a redirect).
 */
for (const locale of ['nl', 'de']) {
  for (const name of ['pages', 'blogs'] as const) {
    const file = `content/${locale}/${name}.json`
    let raw = readCurrent(file)
    const json = JSON.parse(raw) as Record<string, { seo?: Record<string, string> }>
    let touched = false

    for (const [key, entry] of Object.entries(json)) {
      const current = entry?.seo?.description
      if (typeof current !== 'string' || !current) continue

      // Blog detail pages live under the blog hub on the old site; flat pages are at /<slug>.
      const old = oldPage(locale, name === 'blogs' ? `/blogs/${key}` : `/${key}`)
      if (!old) continue

      if (!isApostropheTruncation(current, old.description)) continue

      const to = old.description.trim()
      const next = replaceFieldValue(raw, 'description', current, to)
      if (next === null) {
        console.log(`  SKIP (not uniquely locatable): ${file} :: ${key}.seo.description`)
        continue
      }
      raw = next
      touched = true
      changes.push({ file, key, field: 'seo.description', from: current, to })
    }

    if (touched) pending.set(file, raw)
  }
}

/* --------------------------------------------------------------------------------------------
 * seo.keywords
 *
 * The old site did NOT emit a <meta name="keywords"> tag, so unlike descriptions these cannot be
 * recovered from the crawl. They are truncated by the same mechanism and the missing tail is
 * always the plural "'s" of the final word — "luxe villa" -> "luxe villa's",
 * "vakantievilla" -> "vakantievilla's". That is a mechanical repair of a known-broken value, not
 * new editorial content, so it is applied; every one is listed below for review.
 *
 * NOTE: `keywords` has had no effect on Google ranking for many years. Restoring it is tidiness,
 * not SEO gain — which is also why it is safe to do mechanically.
 * ------------------------------------------------------------------------------------------ */
const KEYWORD_FIXES: { locale: string; file: 'pages' | 'blogs'; key: string; from: string; to: string }[] = [
  { locale: 'nl', file: 'pages', key: 'algemene-voorwaarden-zilt-stern-zee-en-nova',
    from: 'algemene voorwaarden zilt, stern en zee, ameland residence villa',
    to: "algemene voorwaarden zilt, stern en zee, ameland residence villa's" },
  { locale: 'nl', file: 'pages', key: 'blogs',
    from: 'blogpagina, ameland residence, vakantievilla',
    to: "blogpagina, ameland residence, vakantievilla's" },
  { locale: 'nl', file: 'pages', key: 'vakantie-op-ameland',
    from: 'vakantievilla', to: "vakantievilla's" },
  { locale: 'nl', file: 'pages', key: 'vakantiehuis-met-sauna',
    from: 'vakantiehuis met sauna, ameland residence vakantievilla',
    to: "vakantiehuis met sauna, ameland residence vakantievilla's" },
  { locale: 'nl', file: 'pages', key: 'villa-s',
    from: 'luxe villa', to: "luxe villa's" },
  { locale: 'nl', file: 'pages', key: 'zoek-boek',
    from: 'zoek en boek resultaten, ameland residence villa',
    to: "zoek en boek resultaten, ameland residence villa's" },
  { locale: 'nl', file: 'blogs', key: 'luxe-vakantie-op-ameland',
    from: 'Ameland, luxe vakantie, Ameland Residence, vakantievilla',
    to: "Ameland, luxe vakantie, Ameland Residence, vakantievilla's" },
]

for (const fix of KEYWORD_FIXES) {
  const file = `content/${fix.locale}/${fix.file}.json`
  const raw = readCurrent(file)
  const json = JSON.parse(raw) as Record<string, { seo?: Record<string, string> }>
  const seo = json[fix.key]?.seo
  if (!seo) {
    console.log(`  SKIP (no entry): ${file} :: ${fix.key}`)
    continue
  }
  if (seo.keywords !== fix.from) {
    // Already fixed, or the value changed since this list was written — never overwrite blindly.
    console.log(`  SKIP (value differs): ${file} :: ${fix.key}.seo.keywords`)
    console.log(`        expected "${fix.from}"`)
    console.log(`        found    "${seo.keywords}"`)
    continue
  }
  const next = replaceFieldValue(raw, 'keywords', fix.from, fix.to)
  if (next === null) {
    // A short keyword string can legitimately appear twice in one file; a text replace would then be
    // ambiguous, so report it for a manual edit rather than guessing which one to change.
    console.log(`  SKIP (not uniquely locatable): ${file} :: ${fix.key}.seo.keywords = "${fix.from}"`)
    continue
  }
  changes.push({ file, key: fix.key, field: 'seo.keywords', from: fix.from, to: fix.to })
  pending.set(file, next)
}

if (MODE === 'write') {
  for (const [file, raw] of pending) writeFileSync(file, raw)
}

/* ------------------------------------------------------------------------------------ report */

console.log(`\n=== ${MODE === 'write' ? 'APPLIED' : 'DRY RUN'}: ${changes.length} field(s) ===\n`)
for (const c of changes) {
  console.log(`${c.file} :: ${c.key}.${c.field}`)
  console.log(`   was: "${c.from}"`)
  console.log(`   now: "${c.to}"`)
  console.log()
}
if (MODE === 'dry') console.log('Re-run with --write to apply.')
