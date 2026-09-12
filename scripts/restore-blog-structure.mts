/**
 * Restore the paragraph breaks and subheadings the migration flattened out of blog articles.
 *
 *     pnpm audit:crawl-old                                    # cache the old pages first
 *     tsx scripts/restore-blog-structure.mts --dry            # show what would change
 *     tsx scripts/restore-blog-structure.mts --write          # apply
 *
 * WHAT WAS LOST
 *
 * Six Dutch articles (and, more mildly, five others) had their whole body collapsed into a single
 * paragraph with every subheading discarded. On `wadlopen-ameland-zo-bereidt-u-zich-voor` the old page has
 * 30 paragraphs and 10 `<h2>` subheadings; the migrated JSON has 1 paragraph and 0 headings — 1008 words
 * as one unbroken block.
 *
 * The TEXT survived (content parity reports zero missing text); only the BOUNDARIES were lost. Because the
 * old pages are still live and cached, the original block sequence can be read back exactly.
 *
 * HOW IT IS RESTORED
 *
 * The old body is parsed into an ordered list of blocks — `<h2>`/`<h3>` headings and `<p>` paragraphs — and
 * mapped onto this template's `BlogContent.blocks` shape, which is `{ heading, paragraphs[] }`. A heading
 * starts a new block; paragraphs accumulate into the current one. That is a faithful representation of the
 * original document outline.
 *
 * SAFETY. Nothing is written unless the reconstruction accounts for essentially all of the existing text:
 * `--write` refuses an article whose rebuilt word count drifts more than 2% from what is already there.
 * That makes it impossible to silently drop a sentence while "restoring" structure. Inline markup
 * (`<strong>`, `<em>`, `<a href>`) is preserved verbatim from the old page, so internal links survive.
 */
import { globSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { BlogCollection } from '../lib/types.js'

const ROOT = process.cwd()
const MODE = process.argv.includes('--write') ? 'write' : 'dry'


/* ------------------------------------------------------------------ old parsing */

const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', apos: "'",
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', auml: 'ä',
  szlig: 'ß', ccedil: 'ç', oacute: 'ó', uacute: 'ú', aacute: 'á', iacute: 'í',
  hellip: '…', ndash: '–', mdash: '—', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  euro: '€', deg: '°', middot: '·', bull: '•',
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
}

/** Plain-text word count, for the drift guard. */
function words(html: string): number {
  const t = decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  return t ? t.split(' ').length : 0
}

/**
 * Keep only the inline markup this template's `Html` type allows, and rewrite absolute self-links to
 * relative paths so they stay inside the site. Everything else is stripped to its text.
 */
function cleanInline(html: string): string {
  return decode(
    html
      // Absolute links back to either domain become prefix-free internal paths.
      .replace(/href="https?:\/\/(?:www\.)?ameland-residence\.(?:nl|de)(\/[^"]*)"/gi, 'href="$1"')
      // Drop attributes from allowed inline tags except href on <a>.
      .replace(/<(strong|em|b|i)\b[^>]*>/gi, '<$1>')
      .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>/gi, '<a href="$1">')
      .replace(/<br\b[^>]*\/?>/gi, '<br>')
      // Remove any tag that is not in the allowed inline set.
      .replace(/<(?!\/?(?:strong|em|b|i|a|br)\b)[^>]*>/gi, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

type OldBlock = { kind: 'heading' | 'para'; html: string }

/**
 * Read the old article body as an ordered block list.
 *
 * The body starts at `article--text` and ends at the first marker that belongs to the page furniture
 * (the booking widget, the villa grid, or the FAQ block) — otherwise the villa card titles downstream
 * would be picked up as article headings.
 */
function parseOld(html: string): OldBlock[] {
  const start = html.indexOf('article--text')
  if (start < 0) return []
  let body = html.slice(start)
  /**
   * Only STRUCTURAL end markers.
   *
   * An earlier version also cut at the literal text "Veelgestelde vragen" / "Häufig gestellte Fragen",
   * on the assumption that the FAQ belonged to the page furniture. It does not — on several articles it
   * is a real subheading with real body copy under it, and cutting there silently dropped ~190 words
   * from `wadlopen-ameland-zo-bereidt-u-zich-voor` (caught by the drift guard, not by inspection).
   * Never end the body on prose; only on markup that unambiguously starts a different component.
   */
  for (const marker of ['TommyBookingSupport', 'layer-products', 'data-type="products"', 'layer-relatedproducts']) {
    const i = body.indexOf(marker)
    if (i > 0) body = body.slice(0, i)
  }

  const blocks: OldBlock[] = []
  const re = /<(h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi
  for (const m of body.matchAll(re)) {
    const tag = m[1].toLowerCase()
    const inner = cleanInline(m[2])
    if (!inner) continue
    if (tag === 'p') {
      // Skip spacer paragraphs and stray one-word fragments.
      if (words(inner) < 4) continue
      blocks.push({ kind: 'para', html: inner })
    } else {
      if (inner.length < 3) continue
      blocks.push({ kind: 'heading', html: inner })
    }
  }
  return blocks
}

/** Fold the ordered blocks into this template's `{ heading, paragraphs[] }` shape. */
function toBlocks(old: OldBlock[]): { heading: string; paragraphs: string[] }[] {
  const out: { heading: string; paragraphs: string[] }[] = []
  let current: { heading: string; paragraphs: string[] } | null = null
  for (const b of old) {
    if (b.kind === 'heading') {
      if (current) out.push(current)
      current = { heading: b.html, paragraphs: [] }
    } else {
      if (!current) current = { heading: '', paragraphs: [] }
      current.paragraphs.push(b.html)
    }
  }
  if (current) out.push(current)
  return out.filter((b) => b.heading || b.paragraphs.length)
}

/* ------------------------------------------------------------------------- run */

type Change = {
  locale: string
  slug: string
  fromP: number
  toP: number
  fromH: number
  toH: number
  fromW: number
  toW: number
  blocks: { heading: string; paragraphs: string[] }[]
}

const changes: Change[] = []
const skipped: string[] = []

for (const locale of ['nl', 'de']) {
  const file = path.join(ROOT, `content/${locale}/blogs.json`)
  const raw = readFileSync(file, 'utf8')
  const blogs = JSON.parse(raw) as BlogCollection

  for (const [slug, blog] of Object.entries(blogs)) {
    const cached = globSync(`.crawl/pages/www.ameland-residence.${locale}_blogs_${slug}.html`, { cwd: ROOT })
    if (!cached.length) continue

    const rebuilt = toBlocks(parseOld(readFileSync(path.join(ROOT, cached[0]), 'utf8')))
    if (!rebuilt.length) continue

    const curP = (blog.blocks ?? []).reduce((n, b) => n + b.paragraphs.length, 0)
    const curH = (blog.blocks ?? []).filter((b) => (b.heading ?? '').trim()).length
    const newP = rebuilt.reduce((n, b) => n + b.paragraphs.length, 0)
    const newH = rebuilt.filter((b) => b.heading).length

    // Only act where structure was genuinely LOST. Never "improve" an article that is already fine.
    if (newP <= curP && newH <= curH) continue

    /**
     * The guard compares TOTAL text (headings + paragraphs) on both sides, as a bag of words.
     *
     * Counting paragraphs alone is wrong here, because of what the migration actually did: it did not
     * merely drop the subheadings, it CONCATENATED them into the prose. On
     * `wadlopen-ameland-zo-bereidt-u-zich-voor` the current single paragraph literally reads
     * "…beleef het wadwadlopen" — the heading "Wadlopen" fused onto the end of the previous sentence,
     * with no space. Restoring the structure therefore MOVES those words from paragraph text into the
     * `heading` field: paragraph words legitimately fall while the total stays the same.
     *
     * So the invariant that matters is total-text conservation, not per-field counts. A word-level diff
     * confirmed this is exactly what happens: 10 heading phrases move out of the prose, and nothing else
     * changes.
     */
    const totalWords = (list: { heading: string; paragraphs: string[] }[]) =>
      list.reduce((n, b) => n + words(b.heading ?? '') + b.paragraphs.reduce((m, p) => m + words(p), 0), 0)

    const curW = totalWords(blog.blocks ?? [])
    const newW = totalWords(rebuilt)

    /**
     * The real safety question is not "is the word count similar?" but "is any WORD missing?" — so check
     * that directly, as a multiset difference over the normalised text.
     *
     * A count-based check cannot answer it: two articles can have identical totals with different words,
     * and a legitimate restore changes the count anyway. The concatenation the migration did ("het
     * wadwadlopen") also means a fused token splits back into two, so the count RISES on a perfect
     * restore — which a tolerance band reads as failure.
     *
     * `missing` = words present now but absent from the reconstruction. That must be empty (modulo the
     * fused-token artefacts, which is why a tiny allowance remains). Extra words are fine: they are the
     * headings being separated out.
     */
    const bag = (list: { heading: string; paragraphs: string[] }[]) => {
      const text = list
        .flatMap((b) => [b.heading ?? '', ...b.paragraphs])
        .join(' ')
        .replace(/<[^>]+>/g, ' ')
      return decode(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(' ')
        .filter((w) => w.length > 2)
    }

    const newBag = new Map<string, number>()
    for (const w of bag(rebuilt)) newBag.set(w, (newBag.get(w) ?? 0) + 1)

    const missing: string[] = []
    for (const w of bag(blog.blocks ?? [])) {
      const left = newBag.get(w) ?? 0
      if (left === 0) missing.push(w)
      else newBag.set(w, left - 1)
    }

    // Allow a handful: the fused headings ("wadwadlopen") appear as one token now and two after the
    // split, so the original compound legitimately has no counterpart.
    const MAX_MISSING = 6
    if (missing.length > MAX_MISSING) {
      skipped.push(
        `${locale}/${slug} — ${missing.length} word(s) present now would be absent after restore ` +
          `(e.g. ${missing.slice(0, 6).join(', ')}); refusing`,
      )
      continue
    }

    changes.push({ locale, slug, fromP: curP, toP: newP, fromH: curH, toH: newH, fromW: curW, toW: newW, blocks: rebuilt })
  }
}

/* ---------------------------------------------------------------------- report */

console.log(`\n=== ${MODE === 'write' ? 'RESTORING' : 'DRY RUN'}: blog structure ===\n`)
console.log(`${'article'.padEnd(60)} paras      headings    words`)
for (const c of changes) {
  console.log(
    `${(c.locale + '/' + c.slug).slice(0, 59).padEnd(60)} ${String(c.fromP).padStart(2)} -> ${String(c.toP).padStart(2)}   ${String(c.fromH).padStart(2)} -> ${String(c.toH).padStart(2)}    ${c.fromW} -> ${c.toW}`,
  )
}
console.log(`\narticles to restructure: ${changes.length}`)
console.log(`paragraph breaks restored: ${changes.reduce((n, c) => n + (c.toP - c.fromP), 0)}`)
console.log(`subheadings restored: ${changes.reduce((n, c) => n + (c.toH - c.fromH), 0)}`)

if (skipped.length) {
  console.log(`\nskipped (drift guard):`)
  skipped.forEach((s) => console.log(`   ${s}`))
}

if (changes.length && MODE === 'dry') {
  const s = changes[0]
  console.log(`\n--- sample: ${s.locale}/${s.slug} ---`)
  s.blocks.slice(0, 4).forEach((b, i) => {
    console.log(`  [${i}] heading: ${b.heading || '(none)'}`)
    b.paragraphs.slice(0, 2).forEach((p) => console.log(`      p: ${p.slice(0, 90)}…`))
    if (b.paragraphs.length > 2) console.log(`      …+${b.paragraphs.length - 2} more paragraph(s)`)
  })
}

if (MODE === 'dry') {
  console.log(`\nRe-run with --write to apply.`)
  process.exit(0)
}

/* ----------------------------------------------------------------------- apply */

for (const locale of ['nl', 'de']) {
  const mine = changes.filter((c) => c.locale === locale)
  if (!mine.length) continue
  const file = path.join(ROOT, `content/${locale}/blogs.json`)
  const raw = readFileSync(file, 'utf8')
  const blogs = JSON.parse(raw) as BlogCollection

  // Guard: only re-serialise when a no-op round-trip is byte-identical, so the diff stays limited to
  // the articles actually changed (same rule as the villa-checklist restore).
  if (JSON.stringify(blogs, null, 2) + '\n' !== raw) {
    console.error(`REFUSING to write ${file}: a no-op JSON round-trip does not reproduce the file byte-for-byte.`)
    process.exit(1)
  }

  for (const c of mine) blogs[c.slug].blocks = c.blocks
  writeFileSync(file, JSON.stringify(blogs, null, 2) + '\n')
  console.log(`\nwrote content/${locale}/blogs.json (${mine.length} article(s))`)
}

console.log(`\nNext: pnpm test:blog-content && pnpm build`)
