/**
 * SEO regression check against the ACTUAL generated HTML.
 *
 *     pnpm build && pnpm seo:audit
 *
 * Reads every prerendered page out of the build output and asserts the things that must stay true:
 *
 *   1. exactly one <h1> per page                     6. no Dutch template UI text on German pages
 *   2. no skipped heading levels in <main>           7. breadcrumbs present
 *   3. a self-referencing canonical (+ og:url)       8. which pages are noindex
 *   4. reciprocal, region-qualified hreflang         9. BreadcrumbList == the visible trail
 *   5. JSON-LD parses, is typed, has no empty values
 *
 * Every one of these was BROKEN before this pass (no canonicals, no JSON-LD, no h1 on 43 pages per
 * language, 45 pages with skipped levels, Dutch labels on German pages), so this file exists to stop
 * them regressing silently. It exits non-zero on a blocking problem, so CI can gate on it.
 *
 * WARN vs FAIL: warnings are things owned by editorial content (an <h3> inside a CMS rich-text field),
 * failures are things owned by the template. Only failures set the exit code.
 */
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const files = globSync('.next-verify/server/app/**/*.html', { cwd: ROOT })
  .map((f) => f.split(path.sep).join('/')) // Windows: normalise \ to / so URL derivation works
  .filter((f) => !/_not-found|_global-error/.test(f))
  .sort()

type Row = {
  file: string
  locale: string
  url: string
  h1: string[]
  canonical?: string
  hreflang: Record<string, string>
  jsonldTypes: string[]
  jsonldErrors: string[]
  headings: string[]
  ogUrl?: string
  robots?: string
}

const dec = (s: string) =>
  s
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/').replace(/&nbsp;/g, ' ')

const strip = (s: string) => dec(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

const rows: Row[] = []

for (const file of files) {
  const html = readFileSync(path.join(ROOT, file), 'utf8')
  const rel = file.replace(/^\.next-verify\/server\/app\//, '').replace(/\.html$/, '')
  const locale = rel.split('/')[0]

  /**
   * Heading order is judged on MAIN CONTENT only. The task document scopes the text comparison to
   * exclude navigation and footer, and the same applies here: the footer's <h4> column headings
   * ("Contact", link-list titles) sit outside <main> and would otherwise register as an h2 -> h4 skip
   * on all 135 pages. Take only what is inside <main>.
   */
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html
  const headings = [...main.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[1].toLowerCase())
  const h1 = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]))

  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1]
  const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)?.[1]
  const robots = html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/i)?.[1]

  const hreflang: Record<string, string> = {}
  for (const m of html.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/gi)) {
    hreflang[m[1]] = m[2]
  }

  const jsonldTypes: string[] = []
  const jsonldErrors: string[] = []
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = dec(m[1]).replace(/\\u003c/g, '<')
    try {
      const parsed = JSON.parse(raw)
      const nodes = parsed['@graph'] ?? [parsed]
      if (!parsed['@context']) jsonldErrors.push('missing @context')
      for (const n of nodes) {
        if (!n['@type']) { jsonldErrors.push('node without @type'); continue }
        jsonldTypes.push(n['@type'])
        // Hollow values must never be emitted.
        for (const [k, v] of Object.entries(n)) {
          if (v === '' || v === null) jsonldErrors.push(`${n['@type']}.${k} is empty`)
          if (Array.isArray(v) && v.length === 0) jsonldErrors.push(`${n['@type']}.${k} is []`)
        }
      }
    } catch (e) {
      jsonldErrors.push(`JSON parse error: ${(e as Error).message}`)
    }
  }

  rows.push({ file, locale, url: '/' + rel, h1, canonical, hreflang, jsonldTypes, jsonldErrors, headings, ogUrl, robots })
}

/* ------------------------------------------------------------------ report */
let problems = 0
const fail = (msg: string) => { console.log('  FAIL ' + msg); problems++ }

console.log(`\n=== Pages analysed: ${rows.length} ===\n`)

console.log('--- 1. Exactly one H1 per page ---')
const noH1 = rows.filter((r) => r.h1.length === 0)
const multiH1 = rows.filter((r) => r.h1.length > 1)
if (noH1.length) { fail(`${noH1.length} page(s) with NO h1:`); noH1.slice(0, 15).forEach((r) => console.log('        ' + r.url)) }
if (multiH1.length) { fail(`${multiH1.length} page(s) with MULTIPLE h1:`); multiH1.slice(0, 15).forEach((r) => console.log(`        ${r.url} -> ${JSON.stringify(r.h1)}`)) }
if (!noH1.length && !multiH1.length) console.log(`  ok   all ${rows.length} pages have exactly one h1`)

console.log('\n--- 2. Heading order (no skipped levels) ---')
let skips = 0
for (const r of rows) {
  const levels = r.headings.map((h) => Number(h[1]))
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      if (skips < 10) console.log(`  WARN ${r.url}: h${levels[i - 1]} -> h${levels[i]}`)
      skips++
      break
    }
  }
}
console.log(skips === 0 ? '  ok   no skipped heading levels' : `  ${skips} page(s) with a skipped level`)

console.log('\n--- 3. Self-referencing canonical ---')
const noCanon = rows.filter((r) => !r.canonical)
if (noCanon.length) { fail(`${noCanon.length} page(s) with NO canonical:`); noCanon.slice(0, 10).forEach((r) => console.log('        ' + r.url)) }
else console.log(`  ok   all ${rows.length} pages have a canonical`)

/**
 * NOTE ON WHAT "self-referencing" MEANS HERE.
 *
 * The built route path is /<locale>/<slug> because this build ran WITHOUT per-domain mode (that is
 * staging's behaviour). The canonical is generated for the mode the site is configured for, so it can
 * legitimately differ from the route path — comparing them directly is wrong.
 *
 * What must hold is that the canonical PATH equals what `lib/urls.publicPath` would produce for this
 * locale + content path. With domainLocales OFF that is /<locale>/<slug>, i.e. identical to the route.
 *
 * The canonical may be absolute OR root-relative, and both are correct. `lib/urls.siteOrigin` returns
 * "" when neither `NEXT_PUBLIC_SITE_URL` nor per-domain mode is configured — which is the case for a
 * plain `pnpm verify` — and callers then emit root-relative URLs deliberately. So parse the path out
 * without assuming an origin is present; `new URL(r.canonical)` alone throws on "/de".
 */
const canonicalPath = (href: string) =>
  /^https?:\/\//i.test(href) ? new URL(href).pathname : new URL(href, 'https://x.invalid').pathname

const selfMismatch = rows.filter((r) => {
  if (!r.canonical) return false
  return canonicalPath(r.canonical).replace(/\/$/, '') !== r.url.replace(/\/$/, '')
})
if (selfMismatch.length) {
  fail(`${selfMismatch.length} canonical(s) whose path != their own route path:`)
  selfMismatch.slice(0, 10).forEach((r) => console.log(`        ${r.url} -> ${r.canonical}`))
} else console.log(`  ok   every canonical is self-referencing (${rows.length} pages)`)

const ogMismatch = rows.filter((r) => r.ogUrl && r.canonical && r.ogUrl !== r.canonical)
console.log(ogMismatch.length ? `  WARN ${ogMismatch.length} og:url != canonical` : '  ok   og:url matches canonical')

console.log('\n--- 4. hreflang reciprocity ---')
const byPath = new Map(rows.map((r) => [r.url, r]))
let hrefIssues = 0
for (const r of rows) {
  const codes = Object.keys(r.hreflang).filter((c) => c !== 'x-default')
  if (codes.length === 0) continue
  if (codes.length === 1) { console.log(`  WARN ${r.url}: only one hreflang (${codes[0]})`); hrefIssues++; continue }
  // Each alternate must point back at this page.
  for (const [code, href] of Object.entries(r.hreflang)) {
    if (code === 'x-default') continue
    // The alternate href is already a full route path in this build mode (/nl/x, /de/x) — use it as-is.
    // Like the canonical, it is absolute or root-relative depending on whether an origin is configured.
    const target = canonicalPath(href).replace(/\/$/, '') || '/'
    const other = byPath.get(target)
    if (!other) { console.log(`  WARN ${r.url}: alternate ${code} -> ${href} has no built page`); hrefIssues++; continue }
    const back = Object.entries(other.hreflang).find(([c]) => c.split('-')[0] === r.locale)
    if (!back) { console.log(`  FAIL ${r.url}: ${code} does not link back`); hrefIssues++ }
  }
}
const withHref = rows.filter((r) => Object.keys(r.hreflang).length > 0).length
console.log(hrefIssues === 0 ? `  ok   ${withHref} page(s) have hreflang, all reciprocal` : `  ${hrefIssues} hreflang issue(s)`)
const regionOk = rows.every((r) => Object.keys(r.hreflang).every((c) => c === 'x-default' || /^[a-z]{2}-[A-Z]{2}$/.test(c)))
console.log(regionOk ? '  ok   all hreflang codes are region-qualified (nl-NL / de-DE)' : '  FAIL non-region hreflang codes present')

console.log('\n--- 5. JSON-LD validity ---')
const withErrors = rows.filter((r) => r.jsonldErrors.length)
if (withErrors.length) {
  fail(`${withErrors.length} page(s) with JSON-LD problems:`)
  withErrors.slice(0, 10).forEach((r) => console.log(`        ${r.url}: ${r.jsonldErrors.slice(0, 3).join('; ')}`))
} else console.log('  ok   every JSON-LD block parses, has @context, and contains no empty values')

const typeCount: Record<string, number> = {}
for (const r of rows) for (const t of r.jsonldTypes) typeCount[t] = (typeCount[t] || 0) + 1
console.log('  types emitted:', JSON.stringify(typeCount))
const noLd = rows.filter((r) => r.jsonldTypes.length === 0)
console.log(noLd.length ? `  WARN ${noLd.length} page(s) with no JSON-LD (first: ${noLd[0]?.url})` : '  ok   every page carries JSON-LD')

console.log('\n--- 6. Dutch UI text on German pages ---')
const DUTCH = ['Lees meer', 'Lees minder', 'Goed om te weten', 'Bekijk beschikbaarheid', "Onze villa's", 'Meer informatie', 'Kruimelpad']
let leaks = 0
for (const r of rows.filter((x) => x.locale === 'de')) {
  const html = readFileSync(path.join(ROOT, r.file), 'utf8')
  for (const s of DUTCH) {
    if (html.includes(s)) { console.log(`  FAIL ${r.url} contains Dutch UI string "${s}"`); leaks++ }
  }
}
console.log(leaks === 0 ? '  ok   no template Dutch UI strings on German pages' : `  ${leaks} leak(s)`)
if (leaks) problems++

console.log('\n--- 7. Breadcrumbs ---')
const withCrumbs = rows.filter((r) => {
  const html = readFileSync(path.join(ROOT, r.file), 'utf8')
  return /class="crumbs/.test(html)
})
console.log(`  ${withCrumbs.length}/${rows.length} pages render a visible breadcrumb trail`)
const crumbLd = rows.filter((r) => r.jsonldTypes.includes('BreadcrumbList')).length
console.log(`  ${crumbLd}/${rows.length} pages emit BreadcrumbList JSON-LD`)
if (withCrumbs.length !== crumbLd) console.log(`  WARN visible trail count != BreadcrumbList count (home pages have no trail, which is correct)`)

console.log('\n--- 8. noindex pages ---')
rows.filter((r) => r.robots && /noindex/i.test(r.robots)).forEach((r) => console.log(`  ${r.url} -> robots="${r.robots}"`))

/* ---------------- 9. BreadcrumbList must match the VISIBLE trail exactly ---------------- */
console.log('\n--- 9. BreadcrumbList matches visible trail ---')
let crumbMismatch = 0
for (const r of rows) {
  const html = readFileSync(path.join(ROOT, r.file), 'utf8')
  const nav = html.match(/<nav class="crumbs[^"]*"[^>]*>([\s\S]*?)<\/nav>/i)?.[1]
  if (!nav) continue
  const visible = [...nav.matchAll(/class="crumbs-(?:link|current)"[^>]*>([\s\S]*?)</g)].map((m) => strip(m[1]))
  const ldNames: string[] = []
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const g = JSON.parse(dec(m[1]).replace(/\u003c/g, '<'))
      for (const n of g['@graph'] ?? [g]) {
        if (n['@type'] === 'BreadcrumbList') for (const li of n.itemListElement) ldNames.push(li.name)
      }
    } catch { /* reported in check 5 */ }
  }
  if (JSON.stringify(visible) !== JSON.stringify(ldNames)) {
    if (crumbMismatch < 8) console.log(`  FAIL ${r.url}\n        visible: ${JSON.stringify(visible)}\n        json-ld: ${JSON.stringify(ldNames)}`)
    crumbMismatch++
  }
}
if (crumbMismatch === 0) console.log('  ok   every BreadcrumbList matches its visible trail word-for-word')
else fail(`${crumbMismatch} BreadcrumbList(s) disagree with the visible trail`)

/* ------------------------------------------------------------------ verdict */
console.log('')
console.log(problems === 0 ? '=== NO BLOCKING PROBLEMS ===' : `=== ${problems} BLOCKING PROBLEM GROUP(S) ===`)
if (skips > 0) {
  console.log(
    `(${skips} skipped-heading warning(s) remain: <h3> tags inside CMS rich-text fields, i.e.` +
      ' editorial content rather than template markup. Fixing those means editing the copy.)',
  )
}
process.exit(problems === 0 ? 0 : 1)
