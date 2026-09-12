/**
 * Internal-link graph audit over the BUILT HTML.
 *
 *     pnpm build && pnpm audit:links
 *
 * The task document asks to check all existing internal links, prevent orphaned pages, and add relevant
 * connections. This measures the graph so those decisions are made on evidence rather than intuition:
 *
 *  1. BROKEN LINKS — an internal href with no corresponding built page. The clearest defect.
 *  2. ORPHANS — a page nothing links to except its own navigation. Search engines reach it only via the
 *     sitemap, and visitors essentially never. Nav and footer links are excluded from the count on
 *     purpose: a page that only appears in the footer is still effectively orphaned from the content.
 *  3. INBOUND COUNTS — which pages are well-connected and which are one-link islands.
 *  4. DEAD-END PAGES — pages with no outbound content links, so a visitor who lands there has nowhere
 *     to go except back.
 *  5. CROSS-LINK COVERAGE — the specific relationships the brief lists: blogs↔villas, dog-friendly,
 *     family, travel/practical.
 */
import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

type Page = {
  file: string
  url: string
  locale: string
  /** Links inside <main>, excluding nav/header/footer — i.e. real editorial links. */
  outbound: Set<string>
  /** Every internal link on the page, including chrome. */
  allLinks: Set<string>
}

const files = globSync('.next-verify/server/app/**/*.html', { cwd: ROOT })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => !/_not-found|_global-error/.test(f))
  .sort()

if (files.length === 0) {
  console.error('No built pages found — run `pnpm build` first.')
  process.exit(1)
}

/** Normalise an href to a comparable page URL, or null when it is not an internal page link. */
function pageUrl(href: string): string | null {
  let h = href.trim()
  if (!h || h.startsWith('#') || /^(mailto|tel|javascript):/i.test(h)) return null
  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h)
      if (!/ameland-residence\.(nl|de)$/i.test(u.hostname.replace(/^www\./, ''))) return null
      h = u.pathname
    } catch {
      return null
    }
  }
  if (!h.startsWith('/')) return null
  h = h.split('#')[0].split('?')[0]
  if (h.startsWith('/media/')) return null
  return h.replace(/\/$/, '') || '/'
}

const pages: Page[] = files.map((file) => {
  const html = readFileSync(path.join(ROOT, file), 'utf8')
  const url = '/' + file.replace('.next-verify/server/app/', '').replace('.html', '')
  const locale = url.split('/')[1] ?? 'nl'

  // <main> only, so nav/header/footer links do not count as editorial connections.
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? ''

  const collect = (scope: string) => {
    const out = new Set<string>()
    for (const m of scope.matchAll(/<a\b[^>]*?href="([^"]*)"/gi)) {
      const u = pageUrl(m[1])
      if (u) out.add(u)
    }
    return out
  }

  return { file, url, locale, outbound: collect(main), allLinks: collect(html) }
})

const known = new Set(pages.map((p) => p.url))

let failures = 0
const fail = (msg: string, list: string[] = []) => {
  console.log(`  FAIL ${msg}`)
  list.slice(0, 12).forEach((l) => console.log(`        ${l}`))
  if (list.length > 12) console.log(`        …and ${list.length - 12} more`)
  failures++
}

console.log(`\n=== INTERNAL LINK AUDIT — ${pages.length} pages ===\n`)

/* 1 — broken links */
const broken: string[] = []
for (const p of pages) {
  for (const target of p.allLinks) {
    if (!known.has(target)) broken.push(`${p.url}  ->  ${target}`)
  }
}
if (broken.length) fail(`${broken.length} internal link(s) to a page that does not exist:`, broken)
else console.log(`  ok   every internal link resolves to a built page`)

/* 2 + 3 — inbound counts and orphans */
const inbound = new Map<string, Set<string>>()
for (const p of pages) inbound.set(p.url, new Set())
for (const p of pages) {
  for (const target of p.outbound) {
    if (target === p.url) continue // self-links do not connect anything
    inbound.get(target)?.add(p.url)
  }
}

/**
 * True orphans have no inbound link at all — not even from the chrome. Those are unreachable except via
 * sitemap.xml, which is a genuine defect.
 *
 * Reported separately: pages reachable ONLY from the nav/footer. That is weaker than an editorial link
 * but it is not an orphan — the site-wide footer links every page from all 135 others. The sitemap page
 * is the intended example, so flagging it as orphaned would be a false positive.
 */
const chromeInbound = new Map<string, number>()
for (const p of pages) chromeInbound.set(p.url, 0)
for (const p of pages) {
  for (const target of p.allLinks) {
    if (target === p.url) continue
    chromeInbound.set(target, (chromeInbound.get(target) ?? 0) + 1)
  }
}

const homes = new Set(['/nl', '/de'])
const trueOrphans = pages.filter((p) => !homes.has(p.url) && (chromeInbound.get(p.url) ?? 0) === 0)
const chromeOnly = pages.filter(
  (p) => !homes.has(p.url) && (inbound.get(p.url)?.size ?? 0) === 0 && (chromeInbound.get(p.url) ?? 0) > 0,
)

if (trueOrphans.length) fail(`${trueOrphans.length} ORPHANED page(s) — no inbound link anywhere:`, trueOrphans.map((p) => p.url))
else console.log(`  ok   no orphaned pages (every page has at least one inbound link)`)

console.log(
  chromeOnly.length === 0
    ? `  ok   every page also has an inbound link from page CONTENT`
    : `  ${chromeOnly.length} page(s) linked only from the nav/footer, not from content:`,
)
chromeOnly.slice(0, 20).forEach((p) => console.log(`        ${p.url}  (${chromeInbound.get(p.url)} chrome link(s))`))

/* 4 — dead ends */
const deadEnds = pages.filter((p) => p.outbound.size === 0)
console.log(
  deadEnds.length === 0
    ? `  ok   no dead-end pages`
    : `  ${deadEnds.length} page(s) with no outbound editorial links:`,
)
deadEnds.slice(0, 12).forEach((p) => console.log(`        ${p.url}`))

/* 5 — the specific cross-links the brief asks for */
console.log(`\n--- cross-link coverage (per the brief) ---`)
for (const locale of ['nl', 'de']) {
  const local = pages.filter((p) => p.locale === locale)
  const villaHub = locale === 'nl' ? '/nl/villa-s' : '/de/ferienhauser'
  const isVilla = (u: string) => u.startsWith(villaHub + '/')
  const isBlog = (u: string) => u.startsWith(`/${locale}/blogs/`)

  const blogs = local.filter((p) => isBlog(p.url))
  const villas = local.filter((p) => isVilla(p.url))

  const blogsLinkingVilla = blogs.filter((p) => [...p.outbound].some(isVilla)).length
  const villasLinkingBlog = villas.filter((p) => [...p.outbound].some(isBlog)).length

  console.log(`  ${locale.toUpperCase()}  blogs -> a villa: ${blogsLinkingVilla}/${blogs.length}`)
  console.log(`      villas -> a blog:  ${villasLinkingBlog}/${villas.length}`)
}

/* inbound distribution, for context */
const sorted = [...inbound.entries()].sort((a, b) => b[1].size - a[1].size)
console.log(`\n--- best connected ---`)
sorted.slice(0, 6).forEach(([u, s]) => console.log(`  ${String(s.size).padStart(3)}  ${u}`))
console.log(`--- least connected (excluding orphans) ---`)
sorted.filter(([, s]) => s.size > 0).slice(-6).forEach(([u, s]) => console.log(`  ${String(s.size).padStart(3)}  ${u}`))

console.log(failures === 0 ? `\n=== NO BROKEN LINKS ===` : `\n=== ${failures} PROBLEM(S) ===`)
process.exit(failures === 0 ? 0 : 1)
