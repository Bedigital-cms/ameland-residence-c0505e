/**
 * Crawl the OLD live sites and record what every page contains.
 *
 *     tsx scripts/crawl-old.mts
 *
 * Reads the old XML sitemaps (already saved to .crawl/sitemap-<locale>.xml), fetches every URL, and
 * extracts the fields the audit brief asks to compare: status, title, meta description, canonical,
 * hreflang, H1, H2/H3, paragraphs, lists, links, images + alt, structured data, and total main text.
 *
 * MAIN-CONTENT SCOPING. The brief says to exclude navigation, footer and dynamic interface elements
 * from the text comparison. The old site is a page-builder (Izzi/"layer-" classes) with no <main>
 * element, so `mainRegion()` strips <header>/<footer>/<nav>/<script>/<style> and the cookie and
 * booking widgets before anything is measured. Without that, every page would appear to share ~600
 * words of chrome and real differences would be buried.
 *
 * Politeness: sequential, one request at a time, with a short delay. ~133 pages, so this takes a
 * couple of minutes. Results are cached per URL under .crawl/pages/, so re-runs are free and the
 * diff step can be iterated on without re-fetching.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, '.crawl')
const CACHE = path.join(OUT, 'pages')
mkdirSync(CACHE, { recursive: true })

const UA = 'Mozilla/5.0 (compatible; AmelandResidence-migration-audit/1.0)'
const DELAY_MS = 350

export type PageData = {
  url: string
  locale: string
  path: string
  status: number
  title: string
  description: string
  canonical: string
  hreflang: Record<string, string>
  robots: string
  h1: string[]
  h2: string[]
  h3: string[]
  paragraphs: string[]
  lists: string[][]
  links: { href: string; text: string }[]
  images: { src: string; alt: string | null }[]
  jsonld: string[]
  text: string
  wordCount: number
}

/* ------------------------------------------------------------------ helpers */

const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', iuml: 'ï', icirc: 'î',
  ouml: 'ö', ocirc: 'ô', oacute: 'ó', uuml: 'ü', ucirc: 'û', uacute: 'ú',
  auml: 'ä', aacute: 'á', agrave: 'à', acirc: 'â', ccedil: 'ç', ntilde: 'ñ',
  szlig: 'ß', hellip: '…', ndash: '–', mdash: '—',
  // German/Dutch typographic quotes the old builder emits — without these the diff would see a
  // decoded new-site quote and an undecoded old-site entity as a "changed word".
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bdquo: '„', sbquo: '‚', laquo: '«', raquo: '»',
  copy: '©', reg: '®', trade: '™', deg: '°', euro: '€', middot: '·', bull: '•',
  frac12: '½', frac14: '¼', times: '×', shy: '', zwnj: '', ensp: ' ', emsp: ' ', thinsp: ' ',
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)
}

/** Collapse whitespace and decode entities — the normal form for all extracted text. */
function clean(s: string): string {
  return decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Strip everything that is not main content: script/style/noscript, then the site chrome
 * (header, footer, nav) and the third-party widgets. Keeps the document's own content blocks.
 */
function mainRegion(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  // Site chrome by element…
  for (const tag of ['header', 'footer', 'nav']) {
    s = s.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ')
  }
  /**
   * …and the widget containers this builder emits as plain divs.
   *
   * These MUST be removed by balanced-tag matching, not by a lazy `[\s\S]*?<\/div>` regex. A lazy
   * match stops at the FIRST `</div>`, which for a nested container is an inner one — so the removal
   * either cuts too little or, worse, the surrounding markup collapses and real body text disappears.
   * That exact bug silently emptied /uber-ameland (168 words, 0 paragraphs) on the first run.
   */
  for (const kw of ['cookie', 'cc-window', 'tommy', 'mobile-menu', 'offcanvas']) {
    s = removeContainers(s, kw)
  }
  return s
}

/**
 * Remove every <div> whose class/id contains `keyword`, together with its full subtree, by counting
 * nested <div>/</div> pairs so the correct closing tag is found.
 */
function removeContainers(html: string, keyword: string): string {
  const open = new RegExp(`<div[^>]*(?:class|id)\\s*=\\s*"[^"]*${keyword}[^"]*"[^>]*>`, 'i')
  let s = html
  for (let guard = 0; guard < 50; guard++) {
    const m = s.match(open)
    if (!m || m.index === undefined) break
    const start = m.index
    let depth = 0
    const tag = /<div\b[^>]*>|<\/div>/gi
    tag.lastIndex = start
    let end = -1
    let t: RegExpExecArray | null
    while ((t = tag.exec(s))) {
      if (t[0].startsWith('</')) {
        depth--
        if (depth === 0) { end = t.index + t[0].length; break }
      } else depth++
    }
    if (end < 0) end = s.length // unbalanced markup — drop to the end rather than loop forever
    s = s.slice(0, start) + ' ' + s.slice(end)
  }
  return s
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) || tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'))
  return m ? decode(m[1]) : ''
}

function metaContent(html: string, key: 'name' | 'property', value: string): string {
  const re = new RegExp(`<meta[^>]+${key}\\s*=\\s*["']${value}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  return tag ? attr(tag, 'content') : ''
}

function headings(scope: string, level: 1 | 2 | 3): string[] {
  return [...scope.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'))]
    .map((m) => clean(m[1]))
    .filter(Boolean)
}

/**
 * Prose blocks, whatever element wraps them.
 *
 * The old site is a page-builder and does NOT consistently use <p>: article bodies are frequently a
 * bare `<div>` holding one long run of text (verified on /blogs/einen-uxusurlaub-auf-ameland, which
 * has 894 words and zero <p> tags). Counting only <p> would report those pages as having no prose and
 * make the diff scream "missing paragraphs" on content that is actually present — a false alarm that
 * would waste the client's time.
 *
 * So: take every LEAF block element (one containing no further block children) and keep the ones that
 * read as prose. Leaf-only matters — otherwise an outer wrapper and its inner div both match and the
 * same sentence is counted twice.
 */
/**
 * Prose blocks, whatever element wraps them.
 *
 * Implemented by SPLITTING on block boundaries rather than matching `<tag>…</tag>` pairs. A pair-based
 * regex cannot do this job on nested markup: `matchAll` consumes the outer `<div>…</div>` first, so the
 * `<p>` elements inside it are never revisited and their text is lost. That is a silent failure — it
 * reported 107 of 133 pages as having zero prose while the text was plainly there.
 *
 * Splitting has no such blind spot: every block boundary becomes a break, and whatever text sits
 * between two boundaries is one prose run. Runs are then filtered to drop labels and UI fragments.
 */
const BLOCK_BOUNDARY = /<\/?(?:p|div|li|td|tr|table|blockquote|figcaption|figure|section|article|h[1-6]|br)\b[^>]*>/gi

function textBlocks(scope: string): string[] {
  // List items are captured separately in `lists`; counting them here too would double-report them.
  const scoped = scope.replace(/<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  const out = scoped
    .split(BLOCK_BOUNDARY)
    .map((chunk) => clean(chunk))
    // Prose, not a label or a button: needs real length and several words.
    .filter((t) => t.length >= 25 && t.split(/\s+/).length >= 5)
  // The same string can legitimately appear twice (repeated card text); dedupe exact repeats only.
  return [...new Set(out)]
}

/* --------------------------------------------------------------------- fetch */

async function fetchPage(url: string): Promise<{ status: number; html: string }> {
  const key = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9.-]+/g, '_') + '.html'
  const file = path.join(CACHE, key)
  const metaFile = file + '.status'
  if (existsSync(file) && existsSync(metaFile)) {
    return { status: Number(readFileSync(metaFile, 'utf8')), html: readFileSync(file, 'utf8') }
  }
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' })
  const html = await res.text()
  writeFileSync(file, html)
  writeFileSync(metaFile, String(res.status))
  await new Promise((r) => setTimeout(r, DELAY_MS))
  return { status: res.status, html }
}

/* ------------------------------------------------------------------- extract */

function extract(url: string, locale: string, status: number, html: string): PageData {
  const main = mainRegion(html)

  const hreflang: Record<string, string> = {}
  for (const m of html.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)) {
    const hl = attr(m[0], 'hreflang')
    if (hl) hreflang[hl] = attr(m[0], 'href')
  }

  const paragraphs = textBlocks(main)

  const lists = [...main.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) =>
    [...m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => clean(li[1])).filter(Boolean),
  )

  const links = [...main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: attr(m[1], 'href'), text: clean(m[2]) }))
    .filter((l) => l.href && !l.href.startsWith('#') && !/^(mailto|tel|javascript):/i.test(l.href))

  const images = [...main.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const src = attr(m[0], 'src') || attr(m[0], 'data-src')
    // alt="" is meaningful (decorative); a MISSING alt attribute is a defect. Distinguish them.
    const hasAlt = /\balt\s*=/i.test(m[0])
    return { src, alt: hasAlt ? attr(m[0], 'alt') : null }
  }).filter((i) => i.src)

  const jsonld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim())

  const text = clean(main)

  return {
    url,
    locale,
    path: new URL(url).pathname,
    status,
    title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    description: metaContent(html, 'name', 'description'),
    canonical: attr(html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] ?? '', 'href'),
    hreflang,
    robots: metaContent(html, 'name', 'robots'),
    h1: headings(main, 1),
    h2: headings(main, 2),
    h3: headings(main, 3),
    paragraphs,
    lists,
    links,
    images,
    jsonld,
    text,
    wordCount: text ? text.split(/\s+/).length : 0,
  }
}

/* ---------------------------------------------------------------------- main */

function sitemapUrls(locale: string): string[] {
  const xml = readFileSync(path.join(OUT, `sitemap-${locale}.xml`), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

const all: PageData[] = []
for (const locale of ['nl', 'de']) {
  const urls = sitemapUrls(locale)
  console.log(`\n=== ${locale.toUpperCase()}: ${urls.length} URLs ===`)
  let i = 0
  for (const url of urls) {
    i++
    try {
      const { status, html } = await fetchPage(url)
      const data = extract(url, locale, status, html)
      all.push(data)
      process.stdout.write(`  [${i}/${urls.length}] ${status} ${data.path} — ${data.wordCount}w, h1:${data.h1.length}, p:${data.paragraphs.length}, img:${data.images.length}\n`)
    } catch (e) {
      console.log(`  [${i}/${urls.length}] FETCH FAILED ${url}: ${(e as Error).message}`)
      all.push({
        url, locale, path: new URL(url).pathname, status: 0, title: '', description: '', canonical: '',
        hreflang: {}, robots: '', h1: [], h2: [], h3: [], paragraphs: [], lists: [], links: [],
        images: [], jsonld: [], text: '', wordCount: 0,
      })
    }
  }
}

writeFileSync(path.join(OUT, 'old-pages.json'), JSON.stringify(all, null, 1))
console.log(`\nWrote .crawl/old-pages.json — ${all.length} pages`)
console.log(`status codes: ${JSON.stringify(all.reduce((a, p) => ({ ...a, [p.status]: (a[p.status] || 0) + 1 }), {} as Record<number, number>))}`)
console.log(`pages with no h1: ${all.filter((p) => p.h1.length === 0).length}`)
console.log(`pages with >1 h1:  ${all.filter((p) => p.h1.length > 1).length}`)
console.log(`pages with JSON-LD: ${all.filter((p) => p.jsonld.length > 0).length}`)
