/**
 * Restore the villa checklist rows the migration dropped.
 *
 *     pnpm audit:crawl-old                                  # cache the old pages first
 *     tsx scripts/restore-villa-checklist.mts --dry         # show what would change
 *     tsx scripts/restore-villa-checklist.mts --write       # apply
 *
 * WHAT WAS LOST AND WHY
 *
 * On the old site each checklist row is a label plus EITHER a tick OR a number:
 *
 *   <span><span>Doppelzimmer, eines davon mit TV</span><span>3</span></span>   <- quantity row
 *   <span><span>Dusche</span><span data-type="checkbox">…</span></span>        <- tick row
 *
 * Every row of the QUANTITY kind was dropped in migration — 34 rows across all 10 villa pages, in both
 * languages. That removed advertised facilities (travel cots, high chairs, sun loungers, armchairs) and
 * is also why no bedroom count can be read from the German villa pages: `de/villa-stern` lost
 * "Doppelzimmer, eines davon mit TV (3)".
 *
 * HOW THEY ARE RESTORED
 *
 * Labels and counts are read from the CRAWLED OLD PAGE, never typed here. The count is rendered inline
 * as "Label (N)" because `VillaContent.features[].items` is `string[]` — a plain list of lines — and
 * adding a `{label, qty}` shape would be a content-model change, which needs a CMS schema change too.
 * Inline keeps the information on the page today without touching the schema; the structured form can
 * follow with the CMS work.
 *
 * Rows are inserted at their ORIGINAL position within their original group, matched by group heading.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const MODE = process.argv.includes('--write') ? 'write' : 'dry'

/* ------------------------------------------------------- old-page checklist extraction */

const ENT_RE = /&([a-zA-Z]+);|&#x([0-9a-fA-F]+);|&#(\d+);/g
const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
  eacute: 'é', euml: 'ë', iuml: 'ï', ldquo: '"', rdquo: '"', bdquo: '"', rsquo: '’',
  lsquo: '‘', ndash: '-', mdash: '-', hellip: '…', ocirc: 'ô', egrave: 'è',
}
const dec = (s: string) =>
  s.replace(ENT_RE, (m, n, hex, dig) =>
    n ? (ENT[n] ?? m) : String.fromCodePoint(parseInt(hex || dig, hex ? 16 : 10)),
  )
const txt = (s: string) => dec(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const key = (s: string) => txt(s).toLowerCase().replace(/[^a-z0-9äöüßé]/g, '')

type OldRow = { label: string; qty?: string }
type OldGroup = { heading: string; rows: OldRow[] }

function oldChecklist(html: string): OldGroup[] {
  const out: OldGroup[] = []
  const headingRe = /<h3>\s*((?:Indeling|Grundriss|Layout)[^<]{0,40}?)\s*<\/h3>/gi
  const marks = [...html.matchAll(headingRe)]
  for (let i = 0; i < marks.length; i++) {
    const start = (marks[i].index ?? 0) + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index ?? html.length : Math.min(start + 6000, html.length)
    const rows: OldRow[] = []
    const rowRe = /<span>\s*<span>([\s\S]{1,200}?)<\/span>\s*<span([^>]*)>([\s\S]{0,120}?)<\/span>\s*<\/span>/gi
    for (const m of html.slice(start, end).matchAll(rowRe)) {
      const label = txt(m[1])
      if (!label || label.length < 2) continue
      const isCheckbox = /data-type="checkbox"/i.test(m[2])
      const qtyText = txt(m[3])
      rows.push({ label, qty: !isCheckbox && /^\d+$/.test(qtyText) ? qtyText : undefined })
    }
    if (rows.length) out.push({ heading: txt(marks[i][1]), rows })
  }
  return out
}

/* ------------------------------------------------------------------------------ mapping */

const VILLAS: Record<'nl' | 'de', [slug: string, cachedFile: string][]> = {
  nl: [
    ['villa-zee', 'villa-s_villa-zee'], ['villa-stern', 'villa-s_villa-stern'],
    ['villa-zilt', 'villa-s_villa-zilt'], ['villa-nova', 'villa-s_villa-nova'],
    ['luxe-bungalow-watersnip', 'villa-s_luxe-bungalow-watersnip'],
  ],
  de: [
    ['villa-zee', 'ferienhauser_villa-zee'], ['villa-stern', 'ferienhauser_villa-stern'],
    ['villa-zilt', 'ferienhauser_villa-zilt'], ['villa-nova', 'ferienhauser_villa-nova'],
    ['luxesbungalow-watersnip', 'ferienhauser_luxesbungalow-watersnip'],
  ],
}

/**
 * Labels that belong to the Tommy booking widget, not the checklist. The old markup puts the widget's
 * "fast and easy" strapline in the same span pattern, so it is excluded explicitly — restoring it would
 * add booking-widget chrome to an editorial facilities list.
 */
const NOT_CHECKLIST = [/^snel en eenvoudig$/i, /^schnell und einfach$/i]

type Villa = { features?: { heading: string; items: string[] }[] }

let totalAdded = 0
const report: string[] = []

for (const locale of ['nl', 'de'] as const) {
  const file = `content/${locale}/villas.json`
  const raw = readFileSync(file, 'utf8')
  const json = JSON.parse(raw) as Record<string, Villa>
  let touched = false

  /**
   * Restoring rows means INSERTING into arrays, so the surgical text-replace used for the metadata fix
   * cannot be used — the file has to be re-serialised. Guard that: only proceed if a no-op round-trip
   * reproduces the file byte-for-byte. If it does not, re-serialising would reformat unrelated lines
   * and bury the real change, so refuse rather than produce an unreviewable diff.
   */
  const roundTrip = JSON.stringify(json, null, 2) + '\n'
  if (roundTrip !== raw) {
    console.error(
      `REFUSING to write ${file}: a no-op JSON round-trip does not reproduce the file byte-for-byte,\n` +
        `so re-serialising would reformat unrelated content. Restore these rows by hand instead.`,
    )
    process.exit(1)
  }

  for (const [slug, cachedFile] of VILLAS[locale]) {
    const cached = `.crawl/pages/www.ameland-residence.${locale}_${cachedFile}.html`
    let html: string
    try {
      html = readFileSync(cached, 'utf8')
    } catch {
      report.push(`  SKIP ${locale}/${slug}: no cached page (${cached})`)
      continue
    }

    const villa = json[slug]
    if (!villa?.features?.length) {
      report.push(`  SKIP ${locale}/${slug}: no features in JSON`)
      continue
    }

    const oldGroups = oldChecklist(html)
    const added: string[] = []

    for (const og of oldGroups) {
      // Match the JSON group to the old group by heading. The migration kept the headings verbatim.
      const target = villa.features.find((g) => key(g.heading) === key(og.heading))
      if (!target) continue

      /**
       * Rebuild the group in the OLD page's order.
       *
       * An earlier version inserted each missing row individually, anchored on the previous surviving
       * row. That looked right but silently reversed consecutive inserts: two rows both anchored to the
       * same predecessor each landed directly after it, so "Camping-Kinderbett, Hochstuhl" came out as
       * "Hochstuhl, Camping-Kinderbett".
       *
       * Walking the old row list once and appending in sequence cannot reorder anything. Items the old
       * page does not list (added later in the CMS) are kept, appended at the end of the group.
       */
      const rebuilt: string[] = []
      for (const row of og.rows) {
        if (NOT_CHECKLIST.some((re) => re.test(row.label))) continue
        const existing = target.items.find((it) => key(it) === key(row.label))
        if (existing) {
          rebuilt.push(existing) // keep the migrated wording verbatim
          continue
        }
        // Render "Label (N)" when the old row carried a count, else the bare label.
        const line = row.qty ? `${row.label} (${row.qty})` : row.label
        rebuilt.push(line)
        added.push(`${og.heading} :: ${line}`)
      }
      // Anything in the JSON the old page did not have — keep it, at the end.
      const fromOld = new Set(og.rows.map((r) => key(r.label)))
      for (const it of target.items) if (!fromOld.has(key(it))) rebuilt.push(it)

      target.items = rebuilt
    }

    if (added.length) {
      totalAdded += added.length
      touched = true
      report.push(`\n${locale}/${slug}  (+${added.length})`)
      added.forEach((a) => report.push(`    + ${a}`))
    }
  }

  // Safe per the round-trip guard above: the diff will contain only the inserted lines.
  if (touched && MODE === 'write') writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
}

console.log(`\n=== ${MODE === 'write' ? 'APPLIED' : 'DRY RUN'}: ${totalAdded} checklist row(s) restored ===`)
console.log(report.join('\n'))
if (MODE === 'dry') console.log('\nRe-run with --write to apply.')
