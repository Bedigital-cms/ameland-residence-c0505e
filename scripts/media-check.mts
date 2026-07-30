/**
 * Verify every `/media/<file>` reference in the content, and locate the source asset for each.
 *
 *     tsx scripts/media-check.mts            # report only
 *     tsx scripts/media-check.mts --download # also fetch what it finds into _import/ameland-residence/
 *
 * WHY THIS IS NEEDED
 *
 * The site stores media as flat `/media/<filename>` paths. `app/media/[filename]/route.ts` redirects
 * those to the CMS media endpoint, so nothing resolves until the assets have been imported into the CMS
 * (see MEDIA.md). Before that import can happen, the files have to exist on disk — and the delivery
 * folder `_import/ameland-residence/` is gitignored, so a fresh clone of this repo has none of them.
 *
 * The OLD live sites still serve every one of these images, but under a transform path:
 *
 *     new content: /media/Villa-Zee-Ameland.jpg
 *     old site:    /media/372/NL/Afbeeldingen/1920x1080xfit@70/Villa%20Zee%20Ameland.jpg
 *
 * The migration normalised the names (`%20` -> `-`), so recovering a file means searching the crawled
 * old HTML for an image whose normalised stem matches. That is what `buildIndex` does — it never guesses
 * a URL, it only uses one that genuinely appeared in a crawled page.
 *
 * Anything not found is reported, not invented.
 */
import { existsSync, globSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const IMPORT_DIR = path.join(ROOT, '_import', 'ameland-residence')
const DOWNLOAD = process.argv.includes('--download')

/* ------------------------------------------------------- every reference in the content */

function collectRefs(): Set<string> {
  const refs = new Set<string>()
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      for (const m of node.matchAll(/\/media\/[^"'\s)>\\]+/g)) refs.add(m[0])
      return
    }
    if (Array.isArray(node)) return node.forEach(walk)
    if (node && typeof node === 'object') Object.values(node).forEach(walk)
  }
  for (const file of globSync('content/**/*.json', { cwd: ROOT })) {
    try {
      walk(JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')))
    } catch {
      /* not JSON we can parse — skip */
    }
  }
  // The design also references a few assets straight from CSS (footer pattern, section shape).
  const css = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8')
  for (const m of css.matchAll(/\/media\/[^)"'\s]+/g)) refs.add(m[0])
  return refs
}

/** Normalised comparison key: filename stem, lowercased, separators removed. */
function stem(urlOrPath: string): string {
  let s = urlOrPath
  try {
    s = decodeURIComponent(s)
  } catch {
    /* leave as-is if it is not valid percent-encoding */
  }
  const base = s.split('?')[0].split('/').pop() ?? s
  return base.replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/* --------------------------------------- index of real asset URLs from the crawled old sites */

/**
 * Map normalised stem -> best absolute URL found in the crawled HTML.
 *
 * "Best" = the largest transform available, because the old site serves the same image at many sizes and
 * we want the highest-fidelity source for re-import. Ranking is by the pixel width in the transform
 * folder (`1920x1080xfit@70` -> 1920); `/original/` outranks everything.
 */
function buildIndex(): Map<string, { url: string; score: number }> {
  const index = new Map<string, { url: string; score: number }>()
  const files = globSync('.crawl/pages/*.html', { cwd: ROOT })
  if (files.length === 0) {
    console.error('No crawled pages found. Run: pnpm audit:crawl-old')
    process.exit(1)
  }

  for (const file of files) {
    const html = readFileSync(path.join(ROOT, file), 'utf8')
    const host = file.includes('.de_') || file.endsWith('.de.html') ? 'www.ameland-residence.de' : 'www.ameland-residence.nl'

    // src, data-src and every candidate inside a srcset.
    const candidates = new Set<string>()
    for (const m of html.matchAll(/(?:src|data-src)\s*=\s*"([^"]+)"/gi)) candidates.add(m[1])
    for (const m of html.matchAll(/srcset\s*=\s*"([^"]+)"/gi)) {
      for (const part of m[1].split(',')) {
        const u = part.trim().split(/\s+/)[0]
        if (u) candidates.add(u)
      }
    }
    // CSS background-image in inline styles.
    for (const m of html.matchAll(/url\((['"]?)(\/media\/[^)'"]+)\1\)/gi)) candidates.add(m[2])

    for (const raw of candidates) {
      if (!raw || raw.startsWith('data:')) continue
      if (!/\.(jpe?g|png|webp|avif|gif|svg|mp4)(\?|$)/i.test(raw)) continue
      const abs = raw.startsWith('http') ? raw : `https://${host}${raw.startsWith('/') ? '' : '/'}${raw}`
      const key = stem(abs)
      if (!key) continue

      /**
       * Prefer the biggest source. `/original/` always wins — it is the unresized upload, and for an
       * SVG a "800x800xfit" transform is a rasterising path that returns the wrong thing entirely.
       * Otherwise rank by the pixel width in the transform folder.
       */
      const width = Number(abs.match(/\/(\d{2,5})x\d{2,5}x/)?.[1] ?? 0)
      const score = /\/original\//i.test(abs) ? 1_000_000 : width
      const prev = index.get(key)
      if (!prev || score > prev.score) index.set(key, { url: abs, score })
    }
  }
  return index
}

/* --------------------------------------------------------------------------------- report */

const refs = [...collectRefs()].sort().filter((r) => {
  // "/media/..." is a literal placeholder inside a $comment in content/editable.json, not an asset.
  if (/\/media\/\.{2,}$/.test(r)) return false
  return true
})
const index = buildIndex()

/**
 * Probe the old site's known media folders for a file the crawl never surfaced.
 *
 * Two of the design assets are referenced only from the OLD site's stylesheet, which is not part of the
 * page crawl — so they exist and are downloadable, but no crawled HTML mentions them. Rather than
 * declare them lost, try the handful of folder shapes the old CMS actually uses. Every candidate is
 * confirmed with a real request, so nothing is assumed.
 */
async function probe(filename: string): Promise<string | undefined> {
  const folders = [
    '372/NL/website-settings/original',
    '372/DE/website-settings/original',
    '372/General/original',
    '372/NL/Afbeeldingen/original',
    '372/original',
  ]
  for (const host of ['www.ameland-residence.nl', 'www.ameland-residence.de']) {
    for (const folder of folders) {
      const url = `https://${host}/media/${folder}/${encodeURIComponent(filename)}`
      try {
        const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': 'AmelandResidence-migration-audit/1.0' } })
        // The old server answers 404 with an HTML error body, so status is the only reliable signal.
        if (res.ok) return url
      } catch {
        /* try the next candidate */
      }
    }
  }
  return undefined
}

type Row = { ref: string; file: string; onDisk: boolean; source?: string; viaProbe?: boolean }
const rows: Row[] = refs.map((ref) => {
  const file = decodeURIComponent(ref.replace(/^\/media\//, ''))
  const onDisk = existsSync(path.join(IMPORT_DIR, file))
  return { ref, file, onDisk, source: index.get(stem(ref))?.url }
})

// Anything the crawl did not surface: probe the old site's folder shapes before calling it missing.
for (const row of rows) {
  if (row.source) continue
  const url = await probe(row.file)
  if (url) {
    row.source = url
    row.viaProbe = true
  }
}

const found = rows.filter((r) => r.source)
const notFound = rows.filter((r) => !r.source)
const present = rows.filter((r) => r.onDisk)

console.log(`\n=== MEDIA CHECK ===\n`)
console.log(`references in content + css .......... ${rows.length}`)
console.log(`already present in _import/ .......... ${present.length}`)
console.log(`locatable on the old live sites ...... ${found.length}`)
console.log(`NOT locatable ........................ ${notFound.length}`)

if (notFound.length) {
  console.log(`\n--- not found in any crawled page ---`)
  for (const r of notFound) console.log(`   ${r.ref}`)
  console.log(
    `\nThese either (a) only appear on a page not in the sitemap, (b) are template assets the old\n` +
      `site referenced from CSS we did not crawl, or (c) are genuinely gone. Check individually.`,
  )
}

writeFileSync(
  path.join(ROOT, '.crawl', 'media-map.csv'),
  'content_path,filename,present_in_import,source_url\n' +
    rows.map((r) => `${r.ref},${r.file},${r.onDisk ? 'yes' : 'no'},${r.source ?? ''}`).join('\n') +
    '\n',
)
console.log(`\nWrote .crawl/media-map.csv`)

/* ------------------------------------------------------------------------------- download */

if (!DOWNLOAD) {
  console.log(`\nRe-run with --download to fetch the locatable files into _import/ameland-residence/.`)
  process.exit(0)
}

mkdirSync(IMPORT_DIR, { recursive: true })
let ok = 0
let skipped = 0
let failed = 0

for (const r of found) {
  const dest = path.join(IMPORT_DIR, r.file)
  if (existsSync(dest) && statSync(dest).size > 0) {
    skipped++
    continue
  }
  try {
    const res = await fetch(r.source!, { headers: { 'user-agent': 'AmelandResidence-migration-audit/1.0' } })
    if (!res.ok) {
      console.log(`   FAIL ${res.status}  ${r.file}  <- ${r.source}`)
      failed++
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) {
      console.log(`   FAIL empty  ${r.file}`)
      failed++
      continue
    }
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    ok++
    process.stdout.write(`   ok ${String(ok).padStart(3)}  ${r.file} (${Math.round(buf.length / 1024)} KB)\n`)
    await new Promise((res2) => setTimeout(res2, 200))
  } catch (e) {
    console.log(`   FAIL ${(e as Error).message}  ${r.file}`)
    failed++
  }
}

console.log(`\ndownloaded ${ok}, already present ${skipped}, failed ${failed}`)
console.log(`\n_import/ameland-residence/ is gitignored by design — it is a one-time delivery artefact.`)
console.log(`Next: copy it to <cms>/media/_import/ameland-residence/ and run CMS -> Media -> "Importeren".`)
