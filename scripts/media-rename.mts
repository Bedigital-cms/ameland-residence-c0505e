/**
 * Rename every media asset to the platform naming convention, and rewrite every reference to match.
 *
 *     tsx scripts/media-rename.mts --dry      # show the mapping, change nothing
 *     tsx scripts/media-rename.mts --write    # rename files AND rewrite all references
 *
 * TARGET FORMAT
 *
 *     {tenantSlug}-{YYYYMMDD}-{randomId}-{slugifiedOriginalName}.{extension}
 *     ameland-residence-20260730-a7f3k9-villa-zee-ameland.jpg
 *
 * WHY randomId IS A HASH, NOT RANDOM
 *
 * `_import/ameland-residence/` is gitignored — it is a one-time delivery artefact, rebuilt on a fresh
 * clone with `pnpm media:fetch`. With a genuinely random id, a rebuild would produce DIFFERENT names
 * than the ones already imported into the CMS, so every content path would 404. The id is therefore a
 * short hash of the ORIGINAL filename: same input, same output, forever. Re-running this script is a
 * no-op, which is also what makes it verifiable.
 *
 * The date is a fixed constant for the same reason — "today" would change on every run.
 *
 * WHAT MUST MOVE TOGETHER
 *
 * `app/media/[filename]/route.ts` forwards the filename straight to the CMS with no translation layer,
 * so the stored asset name and the content path must always agree. This script therefore renames the
 * files on disk AND rewrites every reference in the same pass:
 *   · content/<locale>/*.json  — the image/video fields
 *   · app/globals.css          — two design assets referenced from CSS
 *   · MEDIA.md                 — the documented filenames, so the docs do not go stale
 *
 * The CMS needs no code change: its importer creates a DB record per file from whatever filename is in
 * the folder (MEDIA.md § Importeren), so importing the renamed folder is all that is required.
 */
import { createHash } from 'node:crypto'
import { globSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DIR = path.join(ROOT, '_import', 'ameland-residence')
const MODE = process.argv.includes('--write') ? 'write' : 'dry'

/** Tenant slug — matches MEDIA_TENANT_SLUG and the delivery folder name. */
const TENANT = 'ameland-residence'
/** Fixed migration date. NOT `new Date()` — see the header note on determinism. */
const DATE = '20260730'
/** Length of the hash segment. 6 hex chars = 16.7M values; collisions are checked explicitly below. */
const ID_LEN = 6

/** Files in the delivery folder that are not media and must keep their name. */
const NON_MEDIA = /^_download-report\.json$|^\./

/* ------------------------------------------------------------------------ naming */

/**
 * Deterministic short id from the original filename.
 *
 * Hashing the ORIGINAL name (not the content, not the slug) means the id survives even if the file
 * bytes are re-fetched from a different transform URL, which is exactly what `media:fetch` does.
 */
function shortId(originalName: string): string {
  return createHash('sha256').update(originalName, 'utf8').digest('hex').slice(0, ID_LEN)
}

/**
 * URL/filesystem-safe slug of the original name, without its extension.
 *
 * Diacritics are folded (`Privésauna` -> `privesauna`) so the result is pure ASCII: the media route
 * runs the name through `encodeURIComponent`, and non-ASCII there survives but makes the stored key
 * harder to match by hand. Any run of non-alphanumerics collapses to a single hyphen.
 */
function slugify(nameWithoutExt: string): string {
  return nameWithoutExt
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip the combining accents NFD leaves behind
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

/** Split "Villa-Zee.jpg" into ["Villa-Zee", "jpg"]; a name with no dot gets an empty extension. */
function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf('.')
  if (i <= 0) return [name, '']
  return [name.slice(0, i), name.slice(i + 1).toLowerCase()]
}

/** The new filename for an original one, per the agreed convention. */
function newName(original: string): string {
  const [base, ext] = splitExt(original)
  const slug = slugify(base)
  const id = shortId(original)
  const stem = `${TENANT}-${DATE}-${id}${slug ? `-${slug}` : ''}`
  return ext ? `${stem}.${ext}` : stem
}

/* ---------------------------------------------------------------------- the mapping */

let entries: string[]
try {
  entries = readdirSync(DIR)
} catch {
  console.error(`Missing ${DIR}. Run: pnpm media:fetch`)
  process.exit(1)
}

const mediaFiles = entries.filter((f) => !NON_MEDIA.test(f)).sort()

/** original -> new. Built for files on disk AND for content refs with no file (the known-broken one). */
const map = new Map<string, string>()
for (const f of mediaFiles) map.set(f, newName(f))

/**
 * Content can reference a filename that is not on disk — `Nova-buitenkant-2.jpg` is dead at source
 * (MEDIA.md § Één bestand ontbreekt). Rename its REFERENCES anyway, so that when the client uploads a
 * replacement it can use the conventional name and the content already points at it. Leaving it on the
 * old naming would be the one path in the codebase that does not follow the convention.
 */
function collectRefs(): Set<string> {
  const refs = new Set<string>()
  const walk = (n: unknown): void => {
    if (typeof n === 'string') {
      for (const m of n.matchAll(/\/media\/([^"'\s)>\\]+)/g)) {
        if (!/^\.{2,}$/.test(m[1])) refs.add(decodeURIComponent(m[1]))
      }
      return
    }
    if (Array.isArray(n)) return n.forEach(walk)
    if (n && typeof n === 'object') Object.values(n).forEach(walk)
  }
  for (const f of globSync('content/**/*.json', { cwd: ROOT })) {
    try {
      walk(JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')))
    } catch {
      /* skip unparseable */
    }
  }
  const css = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8')
  for (const m of css.matchAll(/\/media\/([^)"'\s]+)/g)) refs.add(decodeURIComponent(m[1]))
  return refs
}

const refs = collectRefs()
for (const r of refs) if (!map.has(r)) map.set(r, newName(r))

/* -------------------------------------------------------------------- safety checks */

const problems: string[] = []

// 1. No two originals may produce the same new name.
const byNew = new Map<string, string[]>()
for (const [oldName, nn] of map) {
  if (!byNew.has(nn)) byNew.set(nn, [])
  byNew.get(nn)!.push(oldName)
}
for (const [nn, origins] of byNew) {
  if (origins.length > 1) problems.push(`COLLISION: ${origins.join(' + ')} -> ${nn}`)
}

// 2. Case-insensitive collisions too — the CMS serves from R2/Linux but this folder is copied on Windows.
const byNewLower = new Map<string, string[]>()
for (const nn of byNew.keys()) {
  const k = nn.toLowerCase()
  if (!byNewLower.has(k)) byNewLower.set(k, [])
  byNewLower.get(k)!.push(nn)
}
for (const [, group] of byNewLower) {
  if (group.length > 1) problems.push(`CASE COLLISION: ${group.join(' vs ')}`)
}

// 3. Every new name must survive the media route's encodeURIComponent round-trip.
for (const nn of byNew.keys()) {
  if (decodeURIComponent(encodeURIComponent(nn)) !== nn) problems.push(`UNSAFE NAME: ${nn}`)
  if (/[^a-z0-9.-]/.test(nn)) problems.push(`NON-CANONICAL NAME: ${nn}`)
}

// 4. Refuse to run twice: if anything already carries the convention, this is a re-run.
const alreadyRenamed = mediaFiles.filter((f) => f.startsWith(`${TENANT}-${DATE}-`))
if (alreadyRenamed.length > 0 && alreadyRenamed.length !== mediaFiles.length) {
  problems.push(
    `PARTIAL RENAME: ${alreadyRenamed.length}/${mediaFiles.length} files already use the convention.\n` +
      `   The folder is in a mixed state — restore it with \`pnpm media:fetch\` before retrying.`,
  )
}

if (problems.length) {
  console.error(`\n=== REFUSING TO RUN: ${problems.length} problem(s) ===\n`)
  problems.forEach((p) => console.error(`  ${p}`))
  process.exit(1)
}

if (alreadyRenamed.length === mediaFiles.length && mediaFiles.length > 0) {
  console.log(`\nAll ${mediaFiles.length} files already use the convention — nothing to do.`)
  process.exit(0)
}

/* ------------------------------------------------------------------------- preview */

console.log(`\n=== ${MODE === 'write' ? 'RENAMING' : 'DRY RUN'} ===\n`)
console.log(`format ......... {tenant}-{date}-{id}-{slug}.{ext}`)
console.log(`tenant ......... ${TENANT}`)
console.log(`date ........... ${DATE} (fixed)`)
console.log(`id ............. sha256(original filename)[0:${ID_LEN}] — deterministic`)
console.log(`files on disk .. ${mediaFiles.length}`)
console.log(`refs in content  ${refs.size}`)
console.log(`total mappings . ${map.size}\n`)

const sample = [...map.entries()].slice(0, 8)
for (const [o, n] of sample) console.log(`  ${o}\n    -> ${n}`)
console.log(`  … and ${map.size - sample.length} more\n`)

/* --------------------------------------------------------------- reference rewriting */

/**
 * Rewrite `/media/<old>` -> `/media/<new>` in a text file.
 *
 * Plain string replacement on the exact `/media/<name>` token, longest name first. Longest-first matters:
 * `Villa-Nova01.jpg` and `Villa-Nova0.jpg` would otherwise let the shorter one match inside the longer.
 * The token includes the `/media/` prefix so a bare filename mentioned in prose is never touched.
 */
function rewriteText(text: string, mapping: Map<string, string>): { out: string; hits: number } {
  let out = text
  let hits = 0
  const ordered = [...mapping.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [oldName, nn] of ordered) {
    for (const token of [`/media/${oldName}`, `/media/${encodeURIComponent(oldName)}`]) {
      if (!out.includes(token)) continue
      const parts = out.split(token)
      hits += parts.length - 1
      out = parts.join(`/media/${nn}`)
    }
  }
  return { out, hits }
}

const targets = [
  ...globSync('content/**/*.json', { cwd: ROOT }),
  'app/globals.css',
  'MEDIA.md',
].map((p) => p.split(path.sep).join('/'))

let totalHits = 0
const perFile: { file: string; hits: number; next: string }[] = []

for (const rel of targets) {
  const abs = path.join(ROOT, rel)
  let text: string
  try {
    text = readFileSync(abs, 'utf8')
  } catch {
    continue
  }
  const { out, hits } = rewriteText(text, map)
  if (hits > 0) {
    // Content files must stay valid JSON — parse the result before it is written anywhere.
    if (rel.endsWith('.json')) {
      try {
        JSON.parse(out)
      } catch (e) {
        console.error(`\nREFUSING: rewriting ${rel} produced invalid JSON — ${(e as Error).message}`)
        process.exit(1)
      }
    }
    perFile.push({ file: rel, hits, next: out })
    totalHits += hits
  }
}

console.log(`references to rewrite: ${totalHits}`)
for (const f of perFile) console.log(`   ${f.hits.toString().padStart(4)}  ${f.file}`)

if (MODE === 'dry') {
  console.log(`\nRe-run with --write to apply.`)
  process.exit(0)
}

/* ---------------------------------------------------------------------------- apply */

// References first: if a rename fails midway, content still points at names that exist on disk.
for (const f of perFile) writeFileSync(path.join(ROOT, f.file), f.next)
console.log(`\nrewrote ${perFile.length} file(s), ${totalHits} reference(s)`)

let renamed = 0
for (const f of mediaFiles) {
  const nn = map.get(f)!
  if (nn === f) continue
  renameSync(path.join(DIR, f), path.join(DIR, nn))
  renamed++
}
console.log(`renamed ${renamed} file(s) in _import/ameland-residence/`)

// Persist the mapping — the audit trail linking every old name to its new one.
const csv =
  'original,new\n' +
  [...map.entries()].sort().map(([o, n]) => `${o},${n}`).join('\n') +
  '\n'
writeFileSync(path.join(ROOT, 'reports', 'media-rename-map.csv'), csv)
console.log(`wrote reports/media-rename-map.csv (${map.size} mappings)`)
console.log(`\nNext: pnpm media:validate && pnpm build`)
