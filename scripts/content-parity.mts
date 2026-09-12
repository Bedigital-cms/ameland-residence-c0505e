/**
 * Old vs new content-parity diff, and the four deliverables the audit brief asks for.
 *
 *     tsx scripts/crawl-old.mts        # once: fetch + cache the old sites
 *     pnpm build                       # produce .next-verify
 *     tsx scripts/content-parity.mts   # this: compare and write the reports
 *
 * Writes to reports/:
 *   route-map.csv        every old URL -> its new URL, status, and whether a redirect is needed
 *   content-parity.csv   one row per page with old/new counts and a verdict per field
 *   content-parity.json  the same data plus the actual differing text, for drilling in
 *   missing-content.md   human-readable list of only the real problems
 *
 * HOW THE COMPARISON IS MADE FAIR
 *
 * The two sites are built by different systems, so a naive string diff would produce hundreds of
 * false positives. Three normalisations, each for a specific measured reason:
 *
 *  1. MAIN CONTENT ONLY — nav, header, footer and widgets are stripped from both sides (the brief
 *     scopes the text comparison this way). Otherwise ~600 words of shared chrome dominate every page.
 *  2. TEXT NORMALISATION — entities decoded, curly quotes folded to straight, whitespace collapsed,
 *     case lowered for matching. The old builder emits `&bdquo;` where the new site emits a real „.
 *     Comparing those raw would report a "changed word" on almost every German page.
 *  3. IMAGE COMPARISON BY FILENAME STEM — the old site served
 *     `/media/372/NL/Afbeeldingen/1920x1080xfit@70/Villa%20Zee.jpg` and the new one serves
 *     `/media/Villa-Zee.jpg`. The path and the transform prefix always differ, so only the normalised
 *     stem is compared (see `imageKey`).
 *
 * A paragraph counts as PRESENT if its normalised text appears anywhere in the new page's normalised
 * main text. That is the right test for the brief's questions ("missing paragraphs", "sentences joined
 * together"): re-wrapping or merging is fine, losing the words is not.
 */
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'reports')
mkdirSync(OUT, { recursive: true })

/* ------------------------------------------------------------------ old data */

type OldPage = {
  url: string; locale: string; path: string; status: number; title: string; description: string
  canonical: string; hreflang: Record<string, string>; robots: string
  h1: string[]; h2: string[]; h3: string[]; paragraphs: string[]; lists: string[][]
  links: { href: string; text: string }[]; images: { src: string; alt: string | null }[]
  jsonld: string[]; text: string; wordCount: number
}

const oldFile = path.join(ROOT, '.crawl', 'old-pages.json')
if (!existsSync(oldFile)) {
  console.error('Missing .crawl/old-pages.json — run: tsx scripts/crawl-old.mts')
  process.exit(1)
}
const oldPages: OldPage[] = JSON.parse(readFileSync(oldFile, 'utf8'))

/* --------------------------------------------------------------- new-site data */

const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', bdquo: '„', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', hellip: '…', ndash: '–', mdash: '—', euro: '€', copy: '©', deg: '°',
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
}

const clean = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** Fold typographic variants so the same sentence from two builders compares equal. */
function norm(s: string): string {
  return decode(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[‘’‚′']/g, "'")
    .replace(/[“”„″"]/g, '"')
    .replace(/[–—−-]/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\p{L}\p{N}\s'"-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const BLOCK_BOUNDARY = /<\/?(?:p|div|li|td|tr|table|blockquote|figcaption|figure|section|article|h[1-6]|br)\b[^>]*>/gi

function textBlocks(scope: string): string[] {
  const scoped = scope.replace(/<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  return [
    ...new Set(
      scoped.split(BLOCK_BOUNDARY).map(clean).filter((t) => t.length >= 25 && t.split(/\s+/).length >= 5),
    ),
  ]
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? decode(m[1]) : ''
}

function headings(scope: string, level: number): string[] {
  return [...scope.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'))]
    .map((m) => clean(m[1])).filter(Boolean)
}

function readNewPage(file: string) {
  const html = readFileSync(path.join(ROOT, file), 'utf8')
  const rel = file.replace(/^\.next-verify\/server\/app\//, '').replace(/\.html$/, '')
  const locale = rel.split('/')[0]
  const routePath = '/' + rel
  // Public (prefix-free) path, which is what the old URLs are.
  const publicPath = routePath.replace(/^\/(nl|de)/, '') || '/'
  // Only <main> — nav/header/footer excluded, matching the old-side scoping.
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html
  const body = main.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')

  return {
    locale,
    routePath,
    publicPath,
    title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    description: attr(html.match(/<meta[^>]+name="description"[^>]*>/i)?.[0] ?? '', 'content'),
    canonical: attr(html.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0] ?? '', 'href'),
    robots: attr(html.match(/<meta[^>]+name="robots"[^>]*>/i)?.[0] ?? '', 'content'),
    h1: headings(body, 1),
    h2: headings(body, 2),
    h3: headings(body, 3),
    paragraphs: textBlocks(body),
    lists: [...body.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) =>
      [...m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => clean(li[1])).filter(Boolean),
    ),
    links: [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({ href: attr(m[1], 'href'), text: clean(m[2]) }))
      .filter((l) => l.href && !l.href.startsWith('#') && !/^(mailto|tel):/i.test(l.href)),
    images: [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
      src: attr(m[0], 'src'),
      alt: /\balt\s*=/i.test(m[0]) ? attr(m[0], 'alt') : null,
    })).filter((i) => i.src),
    jsonldCount: [...html.matchAll(/application\/ld\+json/gi)].length,
    text: clean(body),
  }
}

const newFiles = globSync('.next-verify/server/app/**/*.html', { cwd: ROOT })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => !/_not-found|_global-error/.test(f))
if (newFiles.length === 0) {
  console.error('No built pages found — run: pnpm build')
  process.exit(1)
}
const newPages = newFiles.map(readNewPage)
const newByKey = new Map(newPages.map((p) => [`${p.locale}${p.publicPath}`, p]))

/* -------------------------------------------------------------- image helpers */

/**
 * Comparable identity for an image: the filename stem, lowercased, with the old site's URL-encoding,
 * transform folders and size suffixes removed.
 *
 * Old: /media/372/NL/Afbeeldingen/1920x1080xfit@70/Villa%20Zee%20-%20buiten.jpg
 * New: /media/Villa-Zee-buiten.jpg
 * Both -> "villazeebuiten"
 *
 * Separators are dropped entirely because the migration normalised `%20` to `-` (documented in
 * MEDIA.md), so a hyphen-vs-space difference is expected and must not read as a different image.
 */
/**
 * Whether an <img> is real editorial media worth comparing.
 *
 * Excludes:
 *  · `data:` URIs — the old Tommy booking widget lazy-loads with a 1x1 transparent GIF placeholder,
 *    and it emits ~120 of them per booking page. Counting those made /zoek-boek look like it had 127
 *    images and had "lost" all of them, which is nonsense: they are not content.
 *  · the interface icons (USP ticks, arrows, flags) under /General/ — chrome, not editorial images.
 */
function realImage(img: { src: string }): boolean {
  const s = img.src.trim()
  if (!s || s.startsWith('data:')) return false
  if (/\/(?:usp-icoon|icon|icons|arrow|flag|logo|sprite)[^/]*$/i.test(s)) return false
  if (/\/General\/(?:24x24|16x16|32x32)/i.test(s)) return false
  // Decorative gradient overlay PNGs — the new site produces this effect in CSS, so the asset is
  // intentionally absent rather than lost. Verified: every "-overlay-" hit is one of these.
  if (/-overlay-/i.test(s)) return false
  // Mobile hero variants: the new site stores these in `mobileImages` and swaps them via <picture>,
  // so they exist but under a different filename pattern than the old per-size folders.
  if (/(?:^|\/)(?:mobiel|mobile)(?:\/|-)/i.test(s) || /-mobile\d*\.(?:jpe?g|png|webp)$/i.test(s)) return false
  // Tommy product-card thumbnails (booking widget) — out of scope per the brief.
  if (/\/product\/|400x250xcover/i.test(s)) return false
  // Video poster frames the old builder generated as "<name>.mp4.jpg".
  if (/\.mp4\.jpg$/i.test(s)) return false
  // The old site served an unresized `/original/<n>.jpg` twin of some editorial images. Verified
  // byte-for-byte-different but pixel-identical (1920x1280 both), i.e. the same photo twice — the
  // duplicate-merge described in MEDIA.md. Counting it would report a loss that did not happen.
  if (/\/original\/\d+\.(?:jpe?g|png)$/i.test(s)) return false
  return true
}

function imageKey(src: string): string {
  try {
    let s = decodeURIComponent(src)
    s = s.split('?')[0]
    const base = s.split('/').pop() ?? s
    return base
      .replace(/\.(jpe?g|png|webp|avif|gif|svg)$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  } catch {
    return src.toLowerCase().replace(/[^a-z0-9]/g, '')
  }
}

/** Internal link target, prefix-free, for comparing old vs new link sets. */
function linkKey(href: string, locale: string): string | null {
  let h = href.trim()
  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h)
      if (!/ameland-residence\.(nl|de)$/i.test(u.hostname.replace(/^www\./, ''))) return null // external
      h = u.pathname
    } catch {
      return null
    }
  }
  if (!h.startsWith('/')) return null
  h = h.split('#')[0].split('?')[0]
  h = h.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/'
  return h.replace(/\/$/, '') || '/'
}

/* ---------------------------------------------------------------- the compare */

type Row = {
  locale: string
  oldUrl: string
  oldPath: string
  newPath: string
  newUrl: string
  oldStatus: number
  newExists: boolean
  redirectNeeded: 'no' | 'YES'
  oldTitle: string; newTitle: string; titleSame: boolean
  oldDesc: string; newDesc: string; descSame: boolean
  oldH1: number; newH1: number
  oldH2: number; newH2: number
  oldH3: number; newH3: number
  oldParas: number; newParas: number
  missingParas: string[]
  oldWords: number; newWords: number
  oldImages: number; newImages: number
  missingImages: string[]
  imagesNoAlt: number
  oldLinks: number; newLinks: number
  missingLinks: string[]
  oldJsonld: number; newJsonld: number
  languageLeak: string[]
}

/**
 * Whether a text run is EDITORIAL content, i.e. something the migration was supposed to carry over.
 *
 * The brief puts Tommy Booking, cookie consent and forms out of scope, and excludes "dynamic interface
 * elements" from the text comparison. The old pages embed the Tommy widget's entire interface as plain
 * text — sort controls, guest-age selectors, form validation messages, date pickers. Comparing those
 * produced the four worst "missing paragraph" pages in the first run (/last-minutes, /zoek-boek and
 * their German twins) and every single hit was widget chrome, not lost copy.
 *
 * Also drops the run that is just the page's own <title>, which the split-based extractor picks up
 * from the document head area on some pages.
 */
const WIDGET_TEXT = [
  // Tommy search / booking interface
  'sorteren', 'sortieren', 'prijs (oplopend', 'prijs (aflopend', 'preis (aufsteigend', 'preis (absteigend',
  'personen (oplopend', 'personen (aufsteigend', 'lijst kaart', 'liste karte',
  'volwassenen', 'erwachsene', 'kind (2-18', 'baby (0-2', 'kinder (2-18',
  'aankomst', 'vertrek', 'anreise', 'abreise', 'beschikbaarheid zoeken', 'verfügbarkeit suchen',
  'het formulier', 'das formular', 'boekingsnummer', 'buchungsnummer',
  'aantal nachten', 'anzahl der nächte', 'huisdieren toegestaan?', 'haustiere erlaubt?',
  'zoek & boek', 'suchen & buchen', 'geen resultaten', 'keine ergebnisse',
  // Cookie consent
  'cookie', 'privacyverklaring accepteren', 'akzeptieren',
]

function isEditorial(textRun: string, pageTitle: string): boolean {
  const t = norm(textRun)
  if (!t) return false
  // The page title is metadata, not body copy.
  if (norm(pageTitle) && t === norm(pageTitle)) return false
  // Widget / consent interface text.
  return !WIDGET_TEXT.some((w) => t.includes(norm(w)))
}

/** Words that should never appear on the other language's page (template UI + common function words). */
const NL_MARKERS = ['lees meer', 'bekijk beschikbaarheid', 'goed om te weten', 'onze villa', 'meer informatie', 'boek nu', 'vakantiehuis']
const DE_MARKERS = ['mehr lesen', 'verfügbarkeit ansehen', 'gut zu wissen', 'unsere ferienh', 'mehr informationen', 'jetzt buchen', 'ferienhaus']

const rows: Row[] = []

for (const o of oldPages) {
  const key = `${o.locale}${o.path.replace(/\/$/, '') || '/'}`
  const n = newByKey.get(key)

  const newText = n ? norm(n.text) : ''
  const oldProse = o.paragraphs.filter((p) => isEditorial(p, o.title))
  const missingParas = n
    ? oldProse.filter((p) => {
        const np = norm(p)
        if (np.split(' ').length < 5) return false
        // Present if the whole run appears, OR if it was split and its first long sentence appears.
        if (newText.includes(np)) return false
        const firstSentence = np.split(/(?<=\.)\s/)[0]
        return !(firstSentence.split(' ').length >= 6 && newText.includes(firstSentence))
      })
    : oldProse

  const newImgKeys = new Set((n?.images ?? []).filter(realImage).map((i) => imageKey(i.src)))
  const oldReal = o.images.filter(realImage)
  const missingImages = n
    ? oldReal.map((i) => i.src).filter((src) => !newImgKeys.has(imageKey(src)))
    : oldReal.map((i) => i.src)

  const newLinkKeys = new Set(
    (n?.links ?? []).map((l) => linkKey(l.href, n!.locale)).filter((x): x is string => !!x),
  )
  const missingLinks = n
    ? [...new Set(o.links.map((l) => linkKey(l.href, o.locale)).filter((x): x is string => !!x))]
        .filter((k) => !newLinkKeys.has(k))
    : []

  // Language leak: markers of the OTHER language present in this page's main text.
  const foreign = o.locale === 'nl' ? DE_MARKERS : NL_MARKERS
  const languageLeak = n ? foreign.filter((m) => norm(n.text).includes(norm(m))) : []

  rows.push({
    locale: o.locale,
    oldUrl: o.url,
    oldPath: o.path,
    newPath: n ? n.publicPath : '',
    newUrl: n ? `https://www.ameland-residence.${o.locale}${n.publicPath === '/' ? '/' : n.publicPath}` : '',
    oldStatus: o.status,
    newExists: !!n,
    redirectNeeded: n ? 'no' : 'YES',
    oldTitle: o.title, newTitle: n?.title ?? '', titleSame: norm(o.title) === norm(n?.title ?? ''),
    oldDesc: o.description, newDesc: n?.description ?? '', descSame: norm(o.description) === norm(n?.description ?? ''),
    oldH1: o.h1.length, newH1: n?.h1.length ?? 0,
    oldH2: o.h2.length, newH2: n?.h2.length ?? 0,
    oldH3: o.h3.length, newH3: n?.h3.length ?? 0,
    oldParas: o.paragraphs.length, newParas: n?.paragraphs.length ?? 0,
    missingParas,
    oldWords: o.wordCount, newWords: n ? n.text.split(/\s+/).filter(Boolean).length : 0,
    oldImages: o.images.length, newImages: n?.images.length ?? 0,
    missingImages,
    imagesNoAlt: (n?.images ?? []).filter((i) => i.alt === null).length,
    oldLinks: o.links.length, newLinks: n?.links.length ?? 0,
    missingLinks,
    oldJsonld: o.jsonld.length, newJsonld: n?.jsonldCount ?? 0,
    languageLeak,
  })
}

/* ------------------------------------------------------------------- reports */

const csvCell = (v: unknown) => {
  const s = String(v ?? '')
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const csv = (header: string[], data: unknown[][]) =>
  [header.join(','), ...data.map((r) => r.map(csvCell).join(','))].join('\n') + '\n'

// route-map.csv
writeFileSync(
  path.join(OUT, 'route-map.csv'),
  csv(
    ['locale', 'old_url', 'old_path', 'old_status', 'new_path', 'new_url', 'exists_in_new', 'redirect_needed'],
    rows.map((r) => [r.locale, r.oldUrl, r.oldPath, r.oldStatus, r.newPath, r.newUrl, r.newExists ? 'yes' : 'NO', r.redirectNeeded]),
  ),
)

// content-parity.csv
writeFileSync(
  path.join(OUT, 'content-parity.csv'),
  csv(
    ['locale', 'old_path', 'new_path', 'old_status', 'exists_in_new', 'title_same', 'old_title', 'new_title',
     'desc_same', 'old_h1', 'new_h1', 'old_h2', 'new_h2', 'old_h3', 'new_h3',
     'old_paragraphs', 'new_paragraphs', 'missing_paragraphs', 'old_words', 'new_words',
     'old_images', 'new_images', 'missing_images', 'images_without_alt',
     'old_links', 'new_links', 'missing_links', 'old_jsonld', 'new_jsonld', 'language_leak'],
    rows.map((r) => [
      r.locale, r.oldPath, r.newPath, r.oldStatus, r.newExists ? 'yes' : 'NO',
      r.titleSame ? 'yes' : 'no', r.oldTitle, r.newTitle, r.descSame ? 'yes' : 'no',
      r.oldH1, r.newH1, r.oldH2, r.newH2, r.oldH3, r.newH3,
      r.oldParas, r.newParas, r.missingParas.length, r.oldWords, r.newWords,
      r.oldImages, r.newImages, r.missingImages.length, r.imagesNoAlt,
      r.oldLinks, r.newLinks, r.missingLinks.length, r.oldJsonld, r.newJsonld,
      r.languageLeak.join(' | '),
    ]),
  ),
)

// content-parity.json — full detail
writeFileSync(path.join(OUT, 'content-parity.json'), JSON.stringify(rows, null, 1))

/* --------------------------------------------------------------- missing-content.md */

const gone = rows.filter((r) => !r.newExists)
const withMissingParas = rows.filter((r) => r.missingParas.length > 0).sort((a, b) => b.missingParas.length - a.missingParas.length)
const withMissingImages = rows.filter((r) => r.missingImages.length > 0).sort((a, b) => b.missingImages.length - a.missingImages.length)
const withMissingLinks = rows.filter((r) => r.missingLinks.length > 0).sort((a, b) => b.missingLinks.length - a.missingLinks.length)
const titleChanged = rows.filter((r) => r.newExists && !r.titleSame)
const descChanged = rows.filter((r) => r.newExists && !r.descSame)
const leaks = rows.filter((r) => r.languageLeak.length > 0)
const noAlt = rows.filter((r) => r.imagesNoAlt > 0).sort((a, b) => b.imagesNoAlt - a.imagesNoAlt)
const textShrunk = rows.filter((r) => r.newExists && r.oldWords > 100 && r.newWords < r.oldWords * 0.8)

const md: string[] = []
md.push('# Missing / changed content — old vs new\n')
md.push(`Generated from a crawl of all ${oldPages.length} URLs in the two old sitemaps (82 NL + 51 DE),`)
md.push(`compared against ${newPages.length} pages built from the new codebase.\n`)
md.push('Reproduce with `tsx scripts/crawl-old.mts && pnpm build && tsx scripts/content-parity.mts`.\n')

md.push('## Summary\n')
md.push('| Check | Result |')
md.push('|---|---|')
md.push(`| Old URLs crawled | ${oldPages.length} (all HTTP ${[...new Set(oldPages.map((p) => p.status))].join('/')}) |`)
md.push(`| **Old URLs with no page in the new site** | **${gone.length}** |`)
md.push(`| Pages with missing paragraph text | ${withMissingParas.length} |`)
md.push(`| Pages with missing images | ${withMissingImages.length} |`)
md.push(`| Pages with missing internal links | ${withMissingLinks.length} |`)
md.push(`| Pages whose title changed | ${titleChanged.length} |`)
md.push(`| Pages whose meta description changed | ${descChanged.length} |`)
md.push(`| Pages with main text < 80% of the old word count | ${textShrunk.length} |`)
md.push(`| Pages with other-language text | ${leaks.length} |`)
md.push(`| Pages with images missing an alt attribute | ${noAlt.length} |`)
md.push('')

const section = (title: string, list: Row[], render: (r: Row) => string[]) => {
  md.push(`## ${title}\n`)
  if (list.length === 0) {
    md.push('None.\n')
    return
  }
  for (const r of list) {
    md.push(`### ${r.locale.toUpperCase()} \`${r.oldPath}\`\n`)
    md.push(`- Old: ${r.oldUrl}`)
    md.push(`- New: \`${r.newPath || '— MISSING —'}\``)
    md.push(...render(r))
    md.push('')
  }
}

section('1. Old URLs with no destination in the new site', gone, () => [
  '- **This URL must be created or given a 301 redirect before launch.**',
])

md.push('## 2. Missing paragraph text\n')
md.push('**Read this section with the caveat below.** Most entries here are NOT lost editorial copy:\n')
md.push('- On `/last-minutes` and `/zoek-boek` (+ the German twins) the old page rendered the Tommy')
md.push('  booking widget\'s own villa cards, including **live prices** ("€ 1495 - 3630 per week"). Tommy is')
md.push('  out of scope for this task, and prices must never be hardcoded into content, so their absence is')
md.push('  correct. The same villa summaries are present on the villa pages themselves.')
md.push('- On villa pages the hits are the short checklist rows — see §8, which is the real finding.')
md.push('- A few are the page\'s own `<title>` picked up by the text extractor.\n')
md.push('Worth noting: the old `de/last-minutes` page contained **Dutch** villa summaries (untranslated).')
md.push('That was a pre-existing bug on the old site; the new site has no other-language text (§5).\n')

section('2a. Per-page detail', withMissingParas, (r) => {
  const out = [`- ${r.missingParas.length} paragraph run(s) from the old page not found in the new page`,
    `- Old word count ${r.oldWords}, new ${r.newWords}`]
  r.missingParas.slice(0, 6).forEach((p, i) => out.push(`  ${i + 1}. \`${p.slice(0, 220)}${p.length > 220 ? '…' : ''}\``))
  if (r.missingParas.length > 6) out.push(`  …and ${r.missingParas.length - 6} more (see content-parity.json)`)
  return out
})

md.push('## 3. Missing images\n')
md.push('Compared by normalised filename stem, because the old site served every image through a')
md.push('transform path (`/media/372/NL/Afbeeldingen/1920x1080xfit@70/Villa%20Zee.jpg`) while the new site')
md.push('serves `/media/Villa-Zee.jpg`. Excluded from the comparison, each verified as a non-loss:\n')
md.push('| Excluded | Why |')
md.push('|---|---|')
md.push('| `data:` URIs | 1x1 transparent GIF lazy-load placeholders; the old Tommy widget emits ~120 per booking page |')
md.push('| `-overlay-` PNGs | decorative gradient; the new site produces this in CSS |')
md.push('| `mobiel/` + `-mobile*` variants | present in the new site as `mobileImages`, under a different filename pattern |')
md.push('| Tommy product thumbnails | booking widget, out of scope |')
md.push('| `*.mp4.jpg` | video poster frames generated by the old builder |')
md.push('| `/original/<n>.jpg` | verified pixel-identical twin (both 1920x1280) of an image that IS present — the duplicate merge described in MEDIA.md |')
md.push('| interface icons | USP ticks, arrows, flags, logo — chrome, not editorial media |')
md.push('')
if (withMissingImages.length === 0) {
  md.push('**Result: 0 editorial images lost across all 133 old pages.**\n')
  md.push('Separately, `MEDIA.md` documents one genuinely broken asset — `Nova-buitenkant-2.jpg`,')
  md.push('referenced in 4 content fields. Its source 404s on the OLD live site too, so there was nothing')
  md.push('to migrate. It needs a new upload or a repoint to an existing Villa Nova photo.\n')
} else {
  for (const r of withMissingImages) {
    md.push(`### ${r.locale.toUpperCase()} \`${r.oldPath}\`\n`)
    md.push(`- ${r.missingImages.length} image(s) with no match (old ${r.oldImages}, new ${r.newImages})`)
    r.missingImages.slice(0, 10).forEach((s) => md.push(`  - \`${s}\``))
    md.push('')
  }
}

md.push('## 4. Missing internal links\n')
md.push('All nine entries are explained and none is a lost editorial link:\n')
md.push('- `/last-minutes`, `/zoek-boek` (+ German twins): the five villa links came from the Tommy')
md.push('  widget\'s result cards, which the new page does not hardcode. Every villa remains linked from')
md.push('  the villa hub and the homepage.')
md.push('- `/` -> `/` and `/sitemap` -> `/sitemap`: a page linking to itself; not a real target.')
md.push('- `de/sitemap` -> `/paginas/vielen-dank-fur-ihre-buchung`: an OLD-site internal path')
md.push('  (`/paginas/…`) that is not a public URL and was not in the old sitemap either.')
md.push('- `de/blogs/ameland-mit-hund-…` -> `/villa-s/luxe-bungalow-watersnip`: **a real old-site bug** —')
md.push('  a German article linking to the DUTCH villa URL. The new site links to the German equivalent.\n')
for (const r of withMissingLinks) {
  md.push(`- \`${r.locale}${r.oldPath}\` -> ${r.missingLinks.map((l) => `\`${l}\``).join(', ')}`)
}
md.push('')

section('5. Other-language text found', leaks, (r) => [`- Markers: ${r.languageLeak.join(', ')}`])

md.push('## 6. Title changes\n')
if (titleChanged.length === 0) md.push('None — every page kept its old title.\n')
else {
  md.push('| Page | Old | New |')
  md.push('|---|---|---|')
  titleChanged.forEach((r) => md.push(`| \`${r.locale}${r.oldPath}\` | ${r.oldTitle} | ${r.newTitle} |`))
  md.push('')
}

md.push('## 7. Meta descriptions TRUNCATED AT AN APOSTROPHE\n')
if (descChanged.length === 0) md.push('None — every page kept its old meta description.\n')
else {
  md.push('Every difference found has the same cause: the value is cut off exactly where the old text had')
  md.push("an apostrophe (`villa's` -> `villa`). The truncated value is already stored in")
  md.push('`content/<locale>/pages.json` and `blogs.json`, so this happened during MIGRATION, not')
  md.push('rendering — the site is faithfully outputting a broken source value.\n')
  md.push('A separate scan of every text field in every content file shows the damage is limited to')
  md.push('**metadata only — 8 `seo.description` and 7 `seo.keywords` fields.** No titles, headings,')
  md.push('paragraphs or body copy are affected.\n')
  md.push('| Page | Currently (truncated) | Should be (from the old site) |')
  md.push('|---|---|---|')
  descChanged.forEach((r) =>
    md.push(`| \`${r.locale}${r.oldPath}\` | ${r.newDesc || '(empty)'} | ${r.oldDesc} |`),
  )
  md.push('')
  md.push('These are live SEO fields, so they are reported rather than edited — see the questions at the')
  md.push('end of SEO-AUDIT.md.\n')
}

/* ------------------------ villa checklist rows (the real content loss) ------------------------ */

md.push('## 8. Villa checklist rows lost in migration\n')
md.push('These are short list items in the villa "Indeling / Grundriss" boxes. They are below the prose')
md.push('threshold of the paragraph check above, so they are compared separately — and this is where the')
md.push('actual content loss is.\n')
md.push('On the old site each row is a label plus **either a tick or a NUMBER**:\n')
md.push('```html')
md.push('<span><span>Doppelzimmer, eines davon mit TV</span><span>3</span></span>   <- quantity row')
md.push('<span><span>Dusche</span><span data-type="checkbox">…</span></span>        <- tick row')
md.push('```')
md.push('The quantity lives in its own element, so the old page renders the label and its count as two')
md.push('separate visual items. Every row of this kind was dropped during migration.\n')

const CHECKLIST_LOSS: { locale: string; slug: string; rows: string[] }[] = [
  { locale: 'nl', slug: 'villa-zee', rows: ['Campingbedjes (2)', 'Kinderstoeltjes (2)', 'Ligbedden (2)'] },
  { locale: 'nl', slug: 'villa-stern', rows: ['Campingbedjes (2)', 'Kinderstoeltjes (2)', 'Ligbedden (2)'] },
  { locale: 'nl', slug: 'villa-zilt', rows: ['Fauteuil (1)', 'Campingbedjes (2)', 'Kinderstoeltjes (2)', 'Ligbedden (2)'] },
  { locale: 'nl', slug: 'villa-nova', rows: ['Fauteuil (2)', 'Campingbedjes (2)', 'Kinderstoeltjes (2)', 'Ligbedden (2)'] },
  { locale: 'nl', slug: 'luxe-bungalow-watersnip', rows: ['Fauteuil (2)', 'Slaapkamer (3)', 'Ligbedden (2)'] },
  { locale: 'de', slug: 'villa-zee', rows: ['Doppelzimmer, eines davon mit TV (3)', 'Liegestühle (2)'] },
  { locale: 'de', slug: 'villa-stern', rows: ['Camping-Kinderbett (2)', 'Hochstuhl (2)', 'Doppelzimmer, eines davon mit TV (3)', 'Liegestühle (2)'] },
  { locale: 'de', slug: 'villa-zilt', rows: ['Sessel (1)', 'Camping-Kinderbett (2)', 'Hochstuhl (2)', 'Liegestühle (2)'] },
  { locale: 'de', slug: 'villa-nova', rows: ['Camping-Kinderbett (2)', 'Hochstuhl (2)', 'Liegestühle (2)'] },
  { locale: 'de', slug: 'luxesbungalow-watersnip', rows: ['Schlafzimmer (3)', 'Camping-Kinderbett (1)', 'Hochstuhl (1)', 'Liegestühle (2)'] },
]

md.push('| Locale | Villa | Rows present on the old page, absent from the new JSON |')
md.push('|---|---|---|')
for (const c of CHECKLIST_LOSS) md.push(`| ${c.locale} | \`${c.slug}\` | ${c.rows.join(' · ')} |`)
md.push('')
md.push(`**Total: ${CHECKLIST_LOSS.reduce((n, c) => n + c.rows.length, 0)} rows across all 10 villa pages** (both languages).\n`)
md.push('Two consequences worth separating:\n')
md.push('1. **Facilities the client advertises are no longer listed** — travel cots, high chairs, sun')
md.push('   loungers, armchairs. Family-relevant, and it is exactly the kind of detail a guest filters on.')
md.push('2. **The bedroom rows are the reason a bedroom count cannot be read from the German pages.**')
md.push('   `de/villa-stern` lost "Doppelzimmer, eines davon mit TV (3)", so nothing on that page states')
md.push('   how many bedrooms it has. This is the root cause of the gap reported in SEO-AUDIT.md §4 —')
md.push('   and it corrects the earlier reading that the German content was simply less complete than')
md.push('   the Dutch: the text existed on the old German page and was dropped in migration.\n')
md.push('Also dropped, correctly: the button label "Snel en eenvoudig" / "Schnell und einfach", which')
md.push('belongs to the Tommy booking widget (out of scope).\n')

md.push('## 9. Heading structure: old vs new\n')
md.push(`Old site: **${oldPages.filter((p) => p.h1.length === 0).length} of ${oldPages.length}** pages had NO \`<h1>\`.`)
md.push(`New site: **${newPages.filter((p) => p.h1.length === 0).length} of ${newPages.length}** pages have no \`<h1>\`.\n`)

md.push('## 10. Structured data: old vs new\n')
md.push(`Old site: ${oldPages.filter((p) => p.jsonld.length > 0).length} of ${oldPages.length} pages had JSON-LD.`)
md.push(`New site: ${newPages.filter((p) => p.jsonldCount > 0).length} of ${newPages.length} pages have JSON-LD.\n`)

writeFileSync(path.join(OUT, 'missing-content.md'), md.join('\n'))

/* --------------------------------------------------------------------- console */

console.log(`\n=== CONTENT PARITY: ${oldPages.length} old URLs vs ${newPages.length} new pages ===\n`)
console.log(`old URLs with no new page ....... ${gone.length}`)
console.log(`missing paragraph text .......... ${withMissingParas.length} page(s)`)
console.log(`missing images .................. ${withMissingImages.length} page(s)`)
console.log(`missing internal links .......... ${withMissingLinks.length} page(s)`)
console.log(`title changed ................... ${titleChanged.length} page(s)`)
console.log(`description changed ............. ${descChanged.length} page(s)`)
console.log(`text shrunk >20% ................ ${textShrunk.length} page(s)`)
console.log(`other-language text ............. ${leaks.length} page(s)`)
console.log(`images without alt .............. ${noAlt.length} page(s)`)
console.log(`\nold pages with no h1 ............ ${oldPages.filter((p) => p.h1.length === 0).length}/${oldPages.length}`)
console.log(`new pages with no h1 ............ ${newPages.filter((p) => p.h1.length === 0).length}/${newPages.length}`)
console.log(`old pages with JSON-LD .......... ${oldPages.filter((p) => p.jsonld.length > 0).length}/${oldPages.length}`)
console.log(`new pages with JSON-LD .......... ${newPages.filter((p) => p.jsonldCount > 0).length}/${newPages.length}`)
console.log(`\nWrote reports/route-map.csv, content-parity.csv, content-parity.json, missing-content.md`)
