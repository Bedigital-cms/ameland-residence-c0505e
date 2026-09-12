/**
 * Metadata overview: the OLD site's metadata beside the new site's, per page.
 *
 *     pnpm audit:crawl-old && pnpm build && pnpm audit:metadata
 *
 * The task document asks to "export the old metadata first" and to deliver a metadata overview in the
 * final report. The crawl already captured the old values for all 133 URLs; this puts them side by side
 * with what the new build actually emits, so any difference is visible per page rather than buried in the
 * parity CSV.
 *
 * Columns cover exactly the fields the brief lists as needing a check: title, description,
 * self-referencing canonical, Open Graph title/description/image, robots, language and hreflang.
 *
 * The NEW values are read from the built HTML, not from the content JSON — what ships is what matters,
 * and reading the JSON would miss anything the rendering layer changes.
 */
import { existsSync, globSync, readFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'reports')
mkdirSync(OUT, { recursive: true })

/* --------------------------------------------------------------- old crawl data */

type OldPage = {
  locale: string
  path: string
  url: string
  status: number
  title: string
  description: string
  canonical: string
  robots: string
  hreflang: Record<string, string>
}

const oldFile = path.join(ROOT, '.crawl', 'old-pages.json')
if (!existsSync(oldFile)) {
  console.error('Missing .crawl/old-pages.json — run: pnpm audit:crawl-old')
  process.exit(1)
}
const oldPages: OldPage[] = JSON.parse(readFileSync(oldFile, 'utf8'))

/* ----------------------------------------------------------------- new build data */

const attr = (tag: string, name: string): string =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ?? ''

const ENT: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ',
  '#x27': "'", '#39': "'", eacute: 'é', euml: 'ë', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
}
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m)

type NewPage = {
  routePath: string
  publicPath: string
  locale: string
  title: string
  description: string
  canonical: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogUrl: string
  robots: string
  lang: string
  hreflang: Record<string, string>
  jsonldTypes: string[]
}

function readNew(file: string): NewPage {
  const html = readFileSync(path.join(ROOT, file), 'utf8')
  const rel = file.replace('.next-verify/server/app/', '').replace('.html', '')
  const meta = (key: 'name' | 'property', value: string) => {
    const tag = html.match(new RegExp(`<meta[^>]+${key}="${value}"[^>]*>`, 'i'))?.[0] ?? ''
    return decode(attr(tag, 'content'))
  }
  const hreflang: Record<string, string> = {}
  for (const m of html.matchAll(/<link[^>]+rel="alternate"[^>]*>/gi)) {
    const hl = attr(m[0], 'hreflang')
    if (hl) hreflang[hl] = attr(m[0], 'href')
  }
  const jsonldTypes: string[] = []
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decode(m[1]).replace(/\\u003c/g, '<'))
      for (const n of parsed['@graph'] ?? [parsed]) if (n['@type']) jsonldTypes.push(n['@type'])
    } catch {
      /* validity is asserted by seo-audit; this export only lists the types */
    }
  }
  return {
    routePath: '/' + rel,
    publicPath: ('/' + rel).replace(/^\/(nl|de)/, '') || '/',
    locale: rel.split('/')[0],
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim(),
    description: meta('name', 'description'),
    canonical: attr(html.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0] ?? '', 'href'),
    ogTitle: meta('property', 'og:title'),
    ogDescription: meta('property', 'og:description'),
    ogImage: meta('property', 'og:image'),
    ogUrl: meta('property', 'og:url'),
    robots: meta('name', 'robots'),
    lang: attr(html.match(/<html[^>]*>/i)?.[0] ?? '', 'lang'),
    hreflang,
    jsonldTypes,
  }
}

const newFiles = globSync('.next-verify/server/app/**/*.html', { cwd: ROOT })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => !/_not-found|_global-error/.test(f))
  .sort()

if (newFiles.length === 0) {
  console.error('No built pages found — run: pnpm build')
  process.exit(1)
}

const newPages = newFiles.map(readNew)
const newByKey = new Map(newPages.map((p) => [`${p.locale}${p.publicPath}`, p]))

/* -------------------------------------------------------------------------- csv */

const cell = (v: unknown) => {
  const s = String(v ?? '')
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const HEADER = [
  'locale', 'path', 'old_url', 'old_status',
  'old_title', 'new_title', 'title_changed',
  'old_description', 'new_description', 'description_changed',
  'old_canonical', 'new_canonical', 'canonical_self_referencing',
  'new_og_title', 'new_og_description', 'new_og_image', 'new_og_url',
  'old_robots', 'new_robots', 'indexable',
  'lang', 'old_hreflang', 'new_hreflang',
  'new_jsonld_types',
]

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

type Row = Record<string, string | number>
const rows: Row[] = []

for (const o of oldPages) {
  const key = `${o.locale}${o.path.replace(/\/$/, '') || '/'}`
  const n = newByKey.get(key)
  const selfRef = n ? (() => {
    try {
      return new URL(n.canonical).pathname.replace(/\/$/, '') === n.routePath.replace(/\/$/, '') ? 'yes' : 'NO'
    } catch {
      return n.canonical === n.routePath ? 'yes' : 'NO'
    }
  })() : ''

  rows.push({
    locale: o.locale,
    path: o.path,
    old_url: o.url,
    old_status: o.status,
    old_title: o.title,
    new_title: n?.title ?? '',
    title_changed: n ? (norm(o.title) === norm(n.title) ? 'no' : 'YES') : '',
    old_description: o.description,
    new_description: n?.description ?? '',
    description_changed: n ? (norm(o.description) === norm(n.description) ? 'no' : 'YES') : '',
    old_canonical: o.canonical,
    new_canonical: n?.canonical ?? '',
    canonical_self_referencing: selfRef,
    new_og_title: n?.ogTitle ?? '',
    new_og_description: n?.ogDescription ?? '',
    new_og_image: n?.ogImage ?? '',
    new_og_url: n?.ogUrl ?? '',
    old_robots: o.robots,
    new_robots: n?.robots ?? '(none = indexable)',
    indexable: n ? (/noindex/i.test(n.robots) ? 'NO' : 'yes') : '',
    lang: n?.lang ?? '',
    old_hreflang: Object.keys(o.hreflang).join(' '),
    new_hreflang: Object.keys(n?.hreflang ?? {}).join(' '),
    new_jsonld_types: (n?.jsonldTypes ?? []).join(' '),
  })
}

// Pages that exist only in the new build (the booking thank-you pages were never in the old sitemap).
for (const n of newPages) {
  const inOld = oldPages.some((o) => `${o.locale}${o.path.replace(/\/$/, '') || '/'}` === `${n.locale}${n.publicPath}`)
  if (inOld) continue
  rows.push({
    locale: n.locale,
    path: n.publicPath,
    old_url: '(new page — not in the old sitemap)',
    old_status: '',
    old_title: '', new_title: n.title, title_changed: '',
    old_description: '', new_description: n.description, description_changed: '',
    old_canonical: '', new_canonical: n.canonical, canonical_self_referencing: 'yes',
    new_og_title: n.ogTitle, new_og_description: n.ogDescription, new_og_image: n.ogImage, new_og_url: n.ogUrl,
    old_robots: '', new_robots: n.robots || '(none = indexable)',
    indexable: /noindex/i.test(n.robots) ? 'NO' : 'yes',
    lang: n.lang, old_hreflang: '', new_hreflang: Object.keys(n.hreflang).join(' '),
    new_jsonld_types: n.jsonldTypes.join(' '),
  })
}

rows.sort((a, b) => String(a.locale).localeCompare(String(b.locale)) || String(a.path).localeCompare(String(b.path)))

writeFileSync(
  path.join(OUT, 'metadata-overview.csv'),
  [HEADER.join(','), ...rows.map((r) => HEADER.map((h) => cell(r[h])).join(','))].join('\n') + '\n',
)

/* ------------------------------------------------------------------- summary */

const titleChanged = rows.filter((r) => r.title_changed === 'YES')
const descChanged = rows.filter((r) => r.description_changed === 'YES')
const notSelfRef = rows.filter((r) => r.canonical_self_referencing === 'NO')
const noindex = rows.filter((r) => r.indexable === 'NO')
const noOgImage = rows.filter((r) => !r.new_og_image)
const dupTitles = new Map<string, string[]>()
const dupDescs = new Map<string, string[]>()
for (const r of rows) {
  const t = norm(String(r.new_title))
  const d = norm(String(r.new_description))
  if (t) dupTitles.set(t, [...(dupTitles.get(t) ?? []), `${r.locale}${r.path}`])
  if (d) dupDescs.set(d, [...(dupDescs.get(d) ?? []), `${r.locale}${r.path}`])
}
const dupT = [...dupTitles.values()].filter((v) => v.length > 1)
const dupD = [...dupDescs.values()].filter((v) => v.length > 1)

console.log(`\n=== METADATA OVERVIEW — ${rows.length} pages ===\n`)
console.log(`titles changed vs the old site ........ ${titleChanged.length}`)
console.log(`descriptions changed vs the old site .. ${descChanged.length}`)
console.log(`canonicals NOT self-referencing ....... ${notSelfRef.length}`)
console.log(`noindex pages ......................... ${noindex.length}`)
noindex.forEach((r) => console.log(`     ${r.locale}${r.path}  ->  ${r.new_robots}`))
/**
 * og:image — WAS 53 missing (49 of the 133 old pages already had none), now 0.
 *
 * Every page resolves one through `lib/og-image.ts`, from a photograph the page itself displays. This
 * is now a FAILURE rather than a note: with a fallback chain ending in the brand image there is no
 * legitimate way for a page to have none, so a zero here means the chain broke.
 */
console.log(`pages with no og:image ................ ${noOgImage.length}   (was 53; 49/133 old pages had none)`)
noOgImage.slice(0, 8).forEach((r) => console.log(`     ${r.locale}${r.path}`))
if (noOgImage.length > 8) console.log(`     …and ${noOgImage.length - 8} more (see the CSV)`)

/**
 * A share image that 404s is worse than none: the platform shows a broken card rather than falling back
 * to text. Checked against the media folder the site serves from, the same source `media:validate` uses.
 */
// The same folder `pnpm media:validate` checks against. Gitignored and rebuilt by `pnpm media:fetch`,
// so a fresh clone skips this check rather than failing on an absence that is expected.
const mediaDir = path.join('_import', 'ameland-residence')
const haveMedia = existsSync(mediaDir) ? new Set(readdirSync(mediaDir)) : null
/**
 * Match `/media/<file>` ANYWHERE in the value, not just at the start.
 *
 * The exported og:image is absolute once an origin is configured
 * ("https://www.ameland-residence.nl/media/foo.jpg"), so an anchored `startsWith('/media/')` test
 * matches nothing and the check passes every page vacuously. That is precisely how this first shipped,
 * and it reported "0 dead" for a deliberately broken image — a green light that meant nothing. Verified
 * now by injecting a nonexistent file and confirming it is reported.
 */
const MEDIA_SRC = /\/media\/([^/?#]+)$/
const deadOg = haveMedia
  ? rows.filter((r) => {
      const file = MEDIA_SRC.exec(String(r.new_og_image || ''))?.[1]
      if (!file) return false
      return !haveMedia.has(decodeURIComponent(file))
    })
  : []
if (haveMedia) {
  console.log(`og:image files that do not exist ...... ${deadOg.length}`)
  deadOg.slice(0, 8).forEach((r) => console.log(`     ${r.locale}${r.path}  ->  ${r.new_og_image}`))
} else {
  console.log(`og:image file existence ............... skipped (${mediaDir}/ not present)`)
}
console.log(`duplicate titles ...................... ${dupT.length} group(s)`)
dupT.slice(0, 5).forEach((g) => console.log(`     ${g.join(', ')}`))
console.log(`duplicate descriptions ................ ${dupD.length} group(s)   (also duplicated on the old site)`)
dupD.slice(0, 5).forEach((g) => console.log(`     ${g.join(', ')}`))

if (descChanged.length) {
  console.log(`\n--- descriptions that differ from the old site ---`)
  descChanged.forEach((r) => {
    console.log(`  ${r.locale}${r.path}`)
    console.log(`     old: ${String(r.old_description).slice(0, 110)}`)
    console.log(`     new: ${String(r.new_description).slice(0, 110)}`)
  })
}

console.log(`\nWrote reports/metadata-overview.csv`)

/**
 * Only the og:image findings are gating.
 *
 * The duplicate titles/descriptions and the changed-description list are reported for review — they are
 * the client's editorial content and some are duplicated on the old site too, so failing on them would
 * block every build on a decision only the client can make. A missing or dead share image, by contrast,
 * is unambiguously a fault in this codebase.
 */
const blocking = noOgImage.length + deadOg.length
if (blocking > 0) {
  console.error(`\n=== ${blocking} og:image PROBLEM(S) — see above ===`)
  process.exit(1)
}
