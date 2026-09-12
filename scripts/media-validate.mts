/**
 * Validate every file in _import/ameland-residence/ — is it really the image it claims to be?
 *
 *     tsx scripts/media-validate.mts
 *
 * A download can "succeed" and still be worthless: the old CMS answers a missing asset with HTTP 404
 * but a ~50 KB HTML error page as the body. Something that only checks status codes or non-zero size
 * accepts those. So this reads each file's MAGIC BYTES and confirms the container matches the
 * extension, then reports pixel dimensions for the raster formats.
 *
 * Also cross-checks the folder against the content: every referenced file present, and any file on disk
 * that nothing references (dead weight that should not ship to the CMS).
 */
import { globSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DIR = path.join(ROOT, '_import', 'ameland-residence')

/* ----------------------------------------------------------------- format detection */

type Info = { kind: string; width?: number; height?: number }

function sniff(buf: Buffer, name: string): Info | null {
  // JPEG: FF D8 FF
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: 'jpeg', ...jpegSize(buf) }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.length > 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // GIF
  if (buf.length > 10 && buf.subarray(0, 3).toString('latin1') === 'GIF') {
    return { kind: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }
  // WebP: RIFF....WEBP
  if (buf.length > 16 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { kind: 'webp' }
  }
  // MP4 / ISO-BMFF: "ftyp" at offset 4
  if (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    return { kind: 'mp4' }
  }
  // SVG / XML — text, so look at the head for a root element.
  const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return head.includes('<svg') ? { kind: 'svg' } : { kind: 'xml-not-svg' }
  }
  // Anything else that begins as HTML is an error page, not media.
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return { kind: 'HTML-ERROR-PAGE' }
  void name
  return null
}

/** JPEG dimensions by walking the segment markers to the SOF frame. */
function jpegSize(buf: Buffer): { width?: number; height?: number } {
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marker = buf[i + 1]
    // SOF0/1/2/3 carry the frame dimensions.
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const len = buf.readUInt16BE(i + 2)
    if (len < 2) break
    i += 2 + len
  }
  return {}
}

/** Which container the filename claims. */
function expected(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (ext === 'mp4') return 'mp4'
  return ext
}

/* --------------------------------------------------------------------------- content refs */

function contentRefs(): Set<string> {
  const refs = new Set<string>()
  const walk = (n: unknown): void => {
    if (typeof n === 'string') {
      for (const m of n.matchAll(/\/media\/[^"'\s)>\\]+/g)) {
        if (!/\/media\/\.{2,}$/.test(m[0])) refs.add(decodeURIComponent(m[0].replace(/^\/media\//, '')))
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

/* -------------------------------------------------------------------------------- report */

/**
 * Files in the folder that are NOT media and must not be judged as such:
 *  · `_download-report.json` — the original migration's own fetch log. Worth keeping (it is the record
 *    that `Nova-buitenkant-2.jpg` failed with 0 bytes at migration time), but it is metadata.
 *  · dotfiles.
 */
const NON_MEDIA = /^_download-report\.json$|^\./

let allEntries: string[]
try {
  allEntries = readdirSync(DIR)
} catch {
  console.error(`Missing ${DIR}. Run: tsx scripts/media-check.mts --download`)
  process.exit(1)
}
const files = allEntries.filter((f) => !NON_MEDIA.test(f))
const nonMedia = allEntries.filter((f) => NON_MEDIA.test(f))

const bad: string[] = []
const mismatched: string[] = []
const tiny: string[] = []
const kinds: Record<string, number> = {}
let bytes = 0

for (const name of files) {
  const full = path.join(DIR, name)
  const size = statSync(full).size
  bytes += size
  // Read only the head — enough for magic bytes and dimensions, and 154 MB should not be loaded whole.
  const fd = readFileSync(full, { flag: 'r' }).subarray(0, 65536)
  const info = sniff(fd, name)

  if (!info || info.kind === 'HTML-ERROR-PAGE' || info.kind === 'xml-not-svg') {
    bad.push(`${name} — ${info?.kind ?? 'unrecognised format'} (${size} bytes)`)
    continue
  }
  kinds[info.kind] = (kinds[info.kind] || 0) + 1

  const want = expected(name)
  if (want && want !== info.kind && !(want === 'svg' && info.kind === 'svg')) {
    mismatched.push(`${name} — extension says ${want}, content is ${info.kind}`)
  }
  // A real photo below ~200px in either dimension is probably a placeholder that slipped through.
  if (info.width && info.height && (info.width < 200 || info.height < 200) && !/icoon|icon|logo|label|favicon|effect|patroon|fade/i.test(name)) {
    tiny.push(`${name} — ${info.width}x${info.height}`)
  }
}

/**
 * Known-unavailable source, documented in MEDIA.md: the old site 404s on this file at every path,
 * including the one its own pages request, and the original migration's `_download-report.json` records
 * it as `bytes: 0, error: true`. There is nothing to download, so it is reported separately rather than
 * counted as a failure of this recovery.
 */
const KNOWN_MISSING = new Set<string>([
  // Was `Nova-buitenkant-2.jpg` — dead at source. Its four content references have since been repointed
  // to `overzicht-villa-nova-01.jpg`, so nothing references it any more and the exception is empty.
  // Kept as the place to list a genuinely unavailable asset should one appear again.
])

const refs = contentRefs()
const onDisk = new Set(files)

/**
 * CASE SENSITIVITY — the check that only fails in production.
 *
 * This audit runs on Windows, whose filesystem is case-insensitive, so `Villa-Zee.jpg` and
 * `villa-zee.jpg` look like the same file here. The CMS serves from Cloudflare R2 behind a Linux host,
 * where they are two different objects. A reference whose case does not match the stored filename
 * therefore passes every local check and then 404s once deployed — exactly the class of bug that is
 * invisible until the client reports broken images.
 *
 * So compare case-sensitively and report any reference that matches only when case is ignored.
 */
const byLower = new Map([...onDisk].map((f) => [f.toLowerCase(), f]))
const caseOnly = [...refs]
  .filter((r) => !onDisk.has(r) && byLower.has(r.toLowerCase()))
  .map((r) => ({ ref: r, disk: byLower.get(r.toLowerCase())! }))

/**
 * Filenames that differ ONLY by case from each other. Two such files coexist on Linux but collide on
 * Windows/macOS — one silently overwrites the other when the folder is copied to the CMS.
 */
const lowerCounts = new Map<string, string[]>()
for (const f of files) {
  const k = f.toLowerCase()
  if (!lowerCounts.has(k)) lowerCounts.set(k, [])
  lowerCounts.get(k)!.push(f)
}
const caseCollisions = [...lowerCounts.values()].filter((g) => g.length > 1)

/**
 * Filenames that would not survive the media route's `encodeURIComponent` round-trip, or that carry
 * characters known to break object storage / CDN paths.
 */
const unsafeNames = files.filter(
  (f) =>
    decodeURIComponent(encodeURIComponent(f)) !== f ||
    /[%#?&+]/.test(f) ||
    /\s/.test(f) ||
    f !== f.normalize('NFC'),
)

const allMissing = [...refs].filter((r) => !onDisk.has(r) && !byLower.has(r.toLowerCase()))
const missing = allMissing.filter((r) => !KNOWN_MISSING.has(r))
const knownMissing = allMissing.filter((r) => KNOWN_MISSING.has(r))
const orphans = files.filter((f) => !refs.has(f))

console.log(`\n=== _import/ameland-residence/ VALIDATION ===\n`)
console.log(`files ................ ${files.length}`)
console.log(`total size ........... ${(bytes / 1024 / 1024).toFixed(1)} MB`)
console.log(`formats .............. ${JSON.stringify(kinds)}`)
console.log(`\ncorrupt / error pages  ${bad.length}`)
bad.forEach((b) => console.log(`   ${b}`))
console.log(`extension mismatches   ${mismatched.length}`)
mismatched.forEach((m) => console.log(`   ${m}`))
console.log(`suspiciously small     ${tiny.length}`)
tiny.forEach((t) => console.log(`   ${t}`))

console.log(`\nreferenced by content  ${refs.size}`)
console.log(`REFERENCED BUT ABSENT  ${missing.length}`)
missing.forEach((m) => console.log(`   ${m}`))
console.log(`on disk but unused     ${orphans.length}`)
orphans.forEach((o) => console.log(`   ${o}`))
if (nonMedia.length) console.log(`non-media files kept   ${nonMedia.length} (${nonMedia.join(', ')})`)

console.log(`\n--- production-only hazards (this machine is case-insensitive) ---`)
console.log(`case-only mismatches   ${caseOnly.length}   ${caseOnly.length ? 'WOULD 404 ON LINUX/R2' : ''}`)
caseOnly.forEach((c) => console.log(`   content refs "${c.ref}" but disk has "${c.disk}"`))
console.log(`case-collisions        ${caseCollisions.length}`)
caseCollisions.forEach((g) => console.log(`   ${g.join('  vs  ')}`))
console.log(`URL-unsafe filenames   ${unsafeNames.length}`)
unsafeNames.forEach((f) => console.log(`   ${f}`))

if (knownMissing.length) {
  console.log(`\nknown-unavailable      ${knownMissing.length}`)
  for (const k of knownMissing) {
    console.log(`   ${k} — 404 on the old site at every path, incl. the one its own pages request.`)
    console.log(`      The original migration logged it as bytes:0 error:true. See MEDIA.md.`)
    console.log(`      Needs a new upload, or repoint the 4 content fields to an existing Nova photo.`)
  }
}

// Case mismatches and collisions are production-breaking, so they fail the check too.
const fatal = bad.length + missing.length + caseOnly.length + caseCollisions.length + unsafeNames.length
console.log(
  fatal === 0
    ? `\n=== ALL ${files.length} FILES VALID; ${refs.size - knownMissing.length}/${refs.size} REFERENCES SATISFIED ===`
    : `\n=== ${fatal} PROBLEM(S) ===`,
)
process.exit(fatal === 0 ? 0 : 1)
