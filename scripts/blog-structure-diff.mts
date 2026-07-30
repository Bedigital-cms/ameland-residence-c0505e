/**
 * Compare each article's PARAGRAPH AND HEADING STRUCTURE against the old live page.
 *
 *     pnpm audit:crawl-old && tsx scripts/blog-structure-diff.mts
 *
 * `blog-content-check.mts` flags articles whose whole body sits in one enormous paragraph. That is a
 * heuristic — it cannot tell whether the old page was the same. This script answers that by counting the
 * real block structure on both sides:
 *
 *   old  /blogs/wadlopen-ameland-zo-bereidt-u-zich-voor : 4 <p>, 0 <h3>
 *   new  content/nl/blogs.json                          : 1 paragraph, 0 headings   <- 3 paragraphs merged
 *
 * The old builder wraps each article paragraph in its own `<p>` inside `div.article--text`, so counting
 * those is a faithful measure of how the author structured the piece. Where the new content has fewer,
 * the migration joined them — exactly the "sentences that have been joined together" the task document
 * asks about, and something no amount of styling can undo because the boundaries are gone from the data.
 */
import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { BlogCollection } from '../lib/types.js'

const ROOT = process.cwd()

/** Old article body: the `article--text` region, or the whole document if the class is absent. */
function oldBody(html: string): string {
  const i = html.indexOf('article--text')
  if (i < 0) return html
  // Take a generous slice — bodies run to a few thousand characters and end before the villa grid.
  return html.slice(i, i + 40000)
}

/** Count block-level structure in the old markup. */
function oldStructure(html: string): { paragraphs: number; headings: number } {
  const body = oldBody(html)
  // Only <p> that actually contain words; the builder emits a few empty spacers.
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].filter((m) => {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim()
    return text.split(/\s+/).filter(Boolean).length >= 8
  }).length
  const headings = [...body.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].filter(
    (m) => m[1].replace(/<[^>]+>/g, '').trim().length > 2,
  ).length
  return { paragraphs, headings }
}

type Row = {
  locale: string
  slug: string
  oldP: number
  newP: number
  oldH: number
  newH: number
  words: number
}

const rows: Row[] = []

for (const locale of ['nl', 'de']) {
  const blogs = JSON.parse(readFileSync(path.join(ROOT, `content/${locale}/blogs.json`), 'utf8')) as BlogCollection

  for (const [slug, blog] of Object.entries(blogs)) {
    const cached = globSync(`.crawl/pages/www.ameland-residence.${locale}_blogs_${slug}.html`, { cwd: ROOT })
    if (!cached.length) continue
    const html = readFileSync(path.join(ROOT, cached[0]), 'utf8')

    const { paragraphs: oldP, headings: oldH } = oldStructure(html)
    const newP = (blog.blocks ?? []).reduce((n, b) => n + b.paragraphs.filter((p) => p.replace(/<[^>]+>/g, '').trim().length > 20).length, 0)
    const newH = (blog.blocks ?? []).filter((b) => (b.heading ?? '').trim()).length
    const words = (blog.blocks ?? [])
      .flatMap((b) => b.paragraphs)
      .join(' ')
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length

    rows.push({ locale, slug, oldP, newP, oldH, newH, words })
  }
}

/* ------------------------------------------------------------------------ report */

const lostParas = rows.filter((r) => r.oldP > r.newP).sort((a, b) => b.oldP - b.newP - (a.oldP - a.newP))
const lostHeads = rows.filter((r) => r.oldH > r.newH).sort((a, b) => b.oldH - b.newH - (a.oldH - a.newH))
const same = rows.filter((r) => r.oldP <= r.newP && r.oldH <= r.newH)

console.log(`\n=== BLOG STRUCTURE: OLD vs NEW (${rows.length} articles compared) ===\n`)
console.log(`structure preserved or improved ....... ${same.length}`)
console.log(`FEWER paragraphs than the old page .... ${lostParas.length}`)
console.log(`FEWER headings than the old page ...... ${lostHeads.length}`)

if (lostParas.length) {
  console.log(`\n--- paragraphs merged during migration ---`)
  console.log(`${'article'.padEnd(62)} old  new  lost  words`)
  for (const r of lostParas) {
    console.log(
      `${(r.locale + '/' + r.slug).slice(0, 61).padEnd(62)} ${String(r.oldP).padStart(3)}  ${String(r.newP).padStart(3)}  ${String(r.oldP - r.newP).padStart(4)}  ${String(r.words).padStart(5)}`,
    )
  }
}

if (lostHeads.length) {
  console.log(`\n--- subheadings lost during migration ---`)
  for (const r of lostHeads) {
    console.log(`   ${r.locale}/${r.slug} — old ${r.oldH} heading(s), new ${r.newH}`)
  }
}

const mergedTotal = lostParas.reduce((n, r) => n + (r.oldP - r.newP), 0)
const headTotal = lostHeads.reduce((n, r) => n + (r.oldH - r.newH), 0)
console.log(`\ntotal paragraph breaks lost: ${mergedTotal}`)
console.log(`total headings lost: ${headTotal}`)
console.log(
  `\nNOTE: the paragraph text itself is present (content parity confirmed 0 missing text). What was lost\n` +
    `is the BOUNDARIES between paragraphs, so those articles render as one long block. Restoring them means\n` +
    `re-splitting the text, which is an editorial decision — reported here, not applied automatically.`,
)
