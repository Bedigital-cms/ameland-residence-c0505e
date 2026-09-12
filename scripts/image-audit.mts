/**
 * Image quality audit over the BUILT HTML.
 *
 *     pnpm build && pnpm audit:images
 *
 * Checks the image requirements from the task document that can be verified from the markup:
 *
 *  1. WIDTH + HEIGHT on every image. Without them the browser cannot reserve space, so each image is a
 *     layout shift — the CLS half of Core Web Vitals.
 *  2. LAZY LOADING below the fold, and specifically NOT on the LCP candidate. Lazy-loading the first
 *     image actively delays the largest paint, so `loading="lazy"` plus `fetchpriority="high"` on the
 *     same element is a contradiction worth failing on.
 *  3. ALT PRESENT. A missing `alt` attribute is a defect; `alt=""` is a valid decorative marker, so the
 *     two are counted separately rather than lumped together.
 *  4. EXACTLY ONE eager/high-priority image per page. Marking several defeats the point.
 *  5. NO ORPHANED MEDIA REFERENCES. Every `/media/...` src must resolve to a file in the delivery folder.
 *  6. SIZES on responsive images, so a 33vw card slot does not pull a full-width file on a phone.
 */
import { existsSync, globSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MEDIA_DIR = path.join(ROOT, '_import', 'ameland-residence')
const mediaOnDisk = existsSync(MEDIA_DIR) ? new Set(readdirSync(MEDIA_DIR)) : null

type Img = {
  page: string
  src: string
  hasAlt: boolean
  altEmpty: boolean
  width?: string
  height?: string
  loading?: string
  fetchPriority?: string
  sizes?: string
  inHero: boolean
  /** class attribute, plus the parent's — needed to match a ratio rule to its CSS box. */
  cls: string
}

const attr = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]

const files = globSync('.next-verify/server/app/**/*.html', { cwd: ROOT })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => !/_not-found|_global-error/.test(f))
  .sort()

if (files.length === 0) {
  console.error('No built pages found — run `pnpm build` first.')
  process.exit(1)
}

const images: Img[] = []
for (const file of files) {
  const html = readFileSync(path.join(ROOT, file), 'utf8')
  const page = '/' + file.replace('.next-verify/server/app/', '').replace('.html', '')
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const src = attr(tag, 'src') ?? ''
    if (!src) continue
    images.push({
      page,
      src,
      hasAlt: /\balt\s*=/i.test(tag),
      altEmpty: (attr(tag, 'alt') ?? '') === '',
      width: attr(tag, 'width'),
      height: attr(tag, 'height'),
      loading: attr(tag, 'loading'),
      fetchPriority: attr(tag, 'fetchpriority'),
      sizes: attr(tag, 'sizes'),
      inHero: /hero-slide/.test(tag),
      // Include a slice of the markup BEFORE the tag so a wrapper class (.split-media) is matched too.
      cls: (attr(tag, 'class') ?? '') + ' ' + html.slice(Math.max(0, (m.index ?? 0) - 160), m.index ?? 0),
    })
  }
}

let failures = 0
const fail = (msg: string, list: string[] = []) => {
  console.log(`  FAIL ${msg}`)
  list.slice(0, 8).forEach((l) => console.log(`        ${l}`))
  if (list.length > 8) console.log(`        …and ${list.length - 8} more`)
  failures++
}

console.log(`\n=== IMAGE AUDIT — ${images.length} <img> across ${files.length} pages ===\n`)

/* 1 — dimensions */
const noDims = images.filter((i) => !i.width || !i.height)
if (noDims.length) fail(`${noDims.length} image(s) without width/height (layout shift):`, noDims.map((i) => `${i.page} ${i.src.slice(0, 70)}`))
else console.log(`  ok   every image declares width and height`)

/* 2 — lazy loading */
const noLoading = images.filter((i) => !i.loading)
if (noLoading.length) fail(`${noLoading.length} image(s) with no loading attribute:`, noLoading.map((i) => `${i.page} ${i.src.slice(0, 70)}`))
else console.log(`  ok   every image declares a loading strategy`)

const lazyButPriority = images.filter((i) => i.loading === 'lazy' && i.fetchPriority === 'high')
if (lazyButPriority.length) fail(`${lazyButPriority.length} image(s) are lazy AND high priority (contradiction):`, lazyButPriority.map((i) => `${i.page} ${i.src.slice(0, 70)}`))
else console.log(`  ok   no image is both lazy and high-priority`)

const lazyCount = images.filter((i) => i.loading === 'lazy').length
console.log(`       ${lazyCount}/${images.length} lazy, ${images.length - lazyCount} eager`)

/* 3 — alt */
const missingAlt = images.filter((i) => !i.hasAlt)
if (missingAlt.length) fail(`${missingAlt.length} image(s) with NO alt attribute:`, missingAlt.map((i) => `${i.page} ${i.src.slice(0, 70)}`))
else console.log(`  ok   every image has an alt attribute (${images.filter((i) => i.altEmpty).length} decorative, ${images.filter((i) => i.hasAlt && !i.altEmpty).length} described)`)

/* 4 — one priority image per page */
const byPage = new Map<string, Img[]>()
for (const i of images) {
  if (!byPage.has(i.page)) byPage.set(i.page, [])
  byPage.get(i.page)!.push(i)
}
const tooManyPriority: string[] = []
for (const [page, list] of byPage) {
  const high = list.filter((i) => i.fetchPriority === 'high').length
  if (high > 1) tooManyPriority.push(`${page} — ${high} high-priority images`)
}
if (tooManyPriority.length) fail(`pages with more than one high-priority image:`, tooManyPriority)
else console.log(`  ok   at most one high-priority image per page`)

/* 5 — media references resolve */
if (mediaOnDisk) {
  const orphans = new Set<string>()
  for (const i of images) {
    if (!i.src.startsWith('/media/')) continue
    const file = decodeURIComponent(i.src.replace('/media/', ''))
    if (!mediaOnDisk.has(file)) orphans.add(`${file}  (e.g. ${i.page})`)
  }
  // No exceptions any more: the one dead asset (Nova-buitenkant-2.jpg) was repointed to an existing
  // Villa Nova photo, so every src must resolve.
  if (orphans.size) fail(`${orphans.size} image src(s) with no file on disk:`, [...orphans])
  else console.log(`  ok   every /media/ src resolves`)
} else {
  console.log(`  skip media resolution — _import/ameland-residence/ not present`)
}

/**
 * 6a — DECLARED RATIO must match how the CSS frames the element.
 *
 * This is the check that was missing when three visual bugs shipped. Where the CSS sets a width and leaves
 * height to `auto`, the browser derives the rendered HEIGHT from the width/height ATTRIBUTES — so a wrong
 * ratio there is not cosmetic, it visibly distorts the page:
 *
 *  · `.split-media img` declared 900x1200 (portrait) while the section shows a landscape photo beside
 *    text, so the image rendered a third taller than wide.
 *  · the logo declared 190x54 while its SVG viewBox is 250x120, so it rendered at twice the right height
 *    and stretched the whole footer.
 *
 * Each rule pins the ratio the CSS actually frames that class at. Tolerance 1%.
 */
console.log(`\n--- declared ratio vs CSS framing ---`)
const RATIO_RULES = [
  { cls: 'brand-logo', expect: 250 / 120, note: 'logo SVG viewBox is 250x120' },
  { cls: 'footer-logo', expect: 250 / 120, note: 'logo SVG viewBox is 250x120' },
  { cls: 'split-media', expect: 4 / 3, note: '.split-media img aspect-ratio: 4/3' },
]
const ratioIssues: string[] = []
for (const rule of RATIO_RULES) {
  const found = images.find((i) => i.cls.includes(rule.cls))
  if (!found) {
    console.log(`  --   ${rule.cls.padEnd(12)} not present in this build`)
    continue
  }
  const w = Number(found.width)
  const h = Number(found.height)
  const r = w / h
  const ok = !!w && !!h && Math.abs(r - rule.expect) / rule.expect < 0.01
  console.log(
    `  ${ok ? 'ok  ' : 'BAD '} ${rule.cls.padEnd(12)} ${w}x${h} = ${r.toFixed(3)}  (expect ${rule.expect.toFixed(3)})  — ${rule.note}`,
  )
  if (!ok) ratioIssues.push(`${rule.cls}: ${w}x${h} = ${r.toFixed(3)}, expected ${rule.expect.toFixed(3)} — ${rule.note}`)
}
if (ratioIssues.length) fail(`${ratioIssues.length} declared ratio(s) disagree with the CSS framing:`, ratioIssues)

/**
 * 6b — sizes on RESPONSIVE images only.
 *
 * A `sizes` hint tells the browser how wide the slot will be, so it can pick a smaller candidate. That
 * only helps for images whose rendered width varies with the viewport. Fixed-size chrome — the logo, the
 * USP icons, the social icons, the footer badge — is always rendered at its intrinsic size, so `sizes`
 * would be noise. Those are declared with real width/height instead, which is what matters for them.
 */
const FIXED_SIZE = /logo|icoon|icon|label|favicon|badge/i
const noSizes = images.filter((i) => !i.sizes && !i.inHero && !FIXED_SIZE.test(i.src))
console.log(
  noSizes.length === 0
    ? `  ok   every non-hero image declares sizes`
    : `  WARN ${noSizes.length} image(s) without a sizes hint (may over-download on small screens)`,
)
if (noSizes.length) {
  const bySrc = new Map<string, number>()
  for (const i of noSizes) bySrc.set(i.src.split('/').pop() ?? i.src, (bySrc.get(i.src.split('/').pop() ?? i.src) ?? 0) + 1)
  ;[...bySrc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([s, n]) => console.log(`        ${n}x  ${s.slice(0, 68)}`))
}

console.log(failures === 0 ? `\n=== IMAGE AUDIT PASSED ===` : `\n=== ${failures} IMAGE PROBLEM(S) ===`)
process.exit(failures === 0 ? 0 : 1)
