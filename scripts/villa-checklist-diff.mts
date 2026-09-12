/**
 * Which villa CHECKLIST lines existed on the old site but are absent from the migrated JSON.
 *
 * Separate from the paragraph diff because these are short list items: they never reach the 25-char /
 * 5-word prose threshold, so the main parity check cannot see them.
 *
 * OLD MARKUP (verified against the cached HTML — it is NOT a <ul>/<li> list):
 *
 *   <span><h3>Grundriss Obergeschoss</h3>
 *     <span><span>Doppelzimmer, eines davon mit TV</span><span>3&nbsp;</span></span>   <- QUANTITY row
 *     <span><span>Dusche</span><span data-type="checkbox"><span data-checked="1"/></span></span>  <- tick row
 *   </span>
 *
 * So each row is a <span> pair: a label plus EITHER a checkbox OR a number. The number is the count
 * ("3 double bedrooms"), and it lives in its own <span> — which is why the old page renders the line
 * and its count as two separate visual items. That detail matters: it is the reason the migration lost
 * the label, and the reason `villaFacts` cannot read a bedroom count from the German pages.
 */
import { globSync, readFileSync } from 'node:fs'

const ENT_RE = /&([a-zA-Z]+);|&#x([0-9a-fA-F]+);|&#(\d+);/g
const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
  eacute: 'é', euml: 'ë', iuml: 'ï', ldquo: '"', rdquo: '"', bdquo: '"', rsquo: "'", lsquo: "'",
  ndash: '-', mdash: '-', hellip: '…', ocirc: 'ô', egrave: 'è',
}
const dec = (s: string) =>
  s.replace(ENT_RE, (m, n, hex, dig) =>
    n ? (ENT[n] ?? m) : String.fromCodePoint(parseInt(hex || dig, hex ? 16 : 10)),
  )

const text = (s: string) => dec(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const norm = (s: string) => text(s).toLowerCase().replace(/[^a-z0-9äöüßé ]/g, '').replace(/\s+/g, ' ').trim()

type Row = { label: string; qty?: string }

/**
 * Extract the checklist rows, grouped by their <h3> heading.
 *
 * Strategy: cut the document at each checklist heading, then inside each slice pull every
 * `<span><span>LABEL</span>…</span>` row. A row whose second span holds digits is a quantity row.
 */
function oldChecklist(html: string): { heading: string; rows: Row[] }[] {
  const out: { heading: string; rows: Row[] }[] = []
  const headingRe = /<h3>\s*((?:Indeling|Grundriss|Layout)[^<]{0,40}?)\s*<\/h3>/gi
  const marks = [...html.matchAll(headingRe)]
  for (let i = 0; i < marks.length; i++) {
    const start = (marks[i].index ?? 0) + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index ?? html.length : Math.min(start + 6000, html.length)
    const slice = html.slice(start, end)
    const rows: Row[] = []
    // Row = a span containing a label span followed by a sibling span (checkbox or quantity).
    const rowRe = /<span>\s*<span>([\s\S]{1,200}?)<\/span>\s*<span([^>]*)>([\s\S]{0,120}?)<\/span>\s*<\/span>/gi
    for (const m of slice.matchAll(rowRe)) {
      const label = text(m[1])
      if (!label || label.length < 2) continue
      const isCheckbox = /data-type="checkbox"/i.test(m[2])
      const qtyText = text(m[3])
      const qty = !isCheckbox && /^\d+$/.test(qtyText) ? qtyText : undefined
      rows.push({ label, qty })
    }
    if (rows.length) out.push({ heading: text(marks[i][1]), rows })
  }
  return out
}

const VILLAS: Record<string, [string, string][]> = {
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

let totalMissing = 0
let totalQty = 0
for (const locale of ['nl', 'de'] as const) {
  const json = JSON.parse(readFileSync(`content/${locale}/villas.json`, 'utf8')) as Record<
    string,
    { features?: { heading: string; items: string[] }[] }
  >
  console.log(`\n########## ${locale.toUpperCase()} ##########`)
  for (const [slug, fileSlug] of VILLAS[locale]) {
    const files = globSync(`.crawl/pages/www.ameland-residence.${locale}_${fileSlug}.html`)
    if (!files.length) { console.log(`\n${slug}: NO CACHED PAGE`); continue }
    const html = readFileSync(files[0], 'utf8')
    const groups = oldChecklist(html)
    const oldRows = groups.flatMap((g) => g.rows)
    /**
     * Compare on the LABEL only.
     *
     * A restored quantity row is stored as "Campingbedjes (2)" — the count is rendered inline because
     * `features[].items` is a plain `string[]` (see scripts/restore-villa-checklist.mts). Comparing the
     * whole string would report every restored row as still missing, so the trailing "(N)" is stripped
     * from the new items before matching.
     */
    const newItems = new Set(
      (json[slug]?.features ?? []).flatMap((g) => g.items).map((it) => norm(it.replace(/\s*\(\d+\)\s*$/, ''))),
    )
    const missing = oldRows.filter((r) => !newItems.has(norm(r.label)))
    const withQty = oldRows.filter((r) => r.qty)
    const newCount = (json[slug]?.features ?? []).reduce((n, g) => n + g.items.length, 0)

    console.log(`\n${slug}: old ${oldRows.length} rows, new ${newCount} items, MISSING ${missing.length}`)
    if (withQty.length) {
      console.log(`   rows carrying a QUANTITY on the old page:`)
      withQty.forEach((r) => console.log(`      "${r.label}" x${r.qty}`))
      totalQty += withQty.length
    }
    if (missing.length) {
      console.log(`   NOT in the migrated JSON:`)
      missing.forEach((r) => console.log(`      - "${r.label}"${r.qty ? ` (qty ${r.qty})` : ''}`))
    }
    totalMissing += missing.length
  }
}
console.log(`\n==== old checklist rows absent from the new JSON: ${totalMissing} ====`)
console.log(`==== old rows that carried a numeric quantity: ${totalQty} ====`)
