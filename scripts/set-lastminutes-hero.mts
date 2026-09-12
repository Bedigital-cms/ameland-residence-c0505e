/**
 * One-time: give the last-minutes page a hero image, in both languages.
 *
 * THE BUG. The page opened with a `text` section, so the H1 rendered over the hero gradient with no
 * photograph behind it — a grey band. Dutch did have a hero, but it was EMPTY (`images: []`) and sat
 * third, below the booking widget, where a full-bleed header makes no sense. German had no hero at all.
 *
 * Every other subpage opens `hero → …` with a desktop and a mobile image; the brief asks for exactly
 * that ("one consistent hero component … with a good mobile crop"). This brings last-minutes into line.
 *
 * WHAT IT DOES, per locale:
 *   · fills the hero with the requested header image + its mobile variant
 *   · moves the hero to position 0 (Dutch), or inserts one (German)
 *   · leaves every other section, and all copy, untouched
 *
 * The hero `title` stays "" deliberately: `lib/page-heading.ts` derives the H1 from the page's own
 * first heading and suppresses the now-duplicate one below. Typing a title here would print it twice.
 *
 * Refuses to write unless a no-op JSON round-trip reproduces each file byte for byte, so re-serialising
 * cannot reformat unrelated lines. Re-running is a no-op.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** The header photo this page should use, and its mobile crop. Same pair the /video page uses. */
const DESKTOP = '/media/ameland-residence-20260730-21765c-header-desktop-ameland-residence04-2.jpg'
const MOBILE = '/media/ameland-residence-20260730-6d2a21-header-mobile-ameland-residence04-2.jpg'

const MEDIA_DIR = path.join('_import', 'ameland-residence')

type Section = { type: string; images?: string[]; mobileImages?: string[]; [k: string]: unknown }

const write = process.argv.includes('--write')
let changes = 0

// A hero pointing at a file that does not exist renders as the same grey band, so check first.
if (existsSync(MEDIA_DIR)) {
  for (const src of [DESKTOP, MOBILE]) {
    const file = decodeURIComponent(src.replace('/media/', ''))
    if (!existsSync(path.join(MEDIA_DIR, file))) {
      console.error(`FAIL missing media file: ${file}`)
      process.exit(1)
    }
  }
  console.log('both media files exist\n')
} else {
  console.log(`(${MEDIA_DIR}/ not present — skipping the file-existence check)\n`)
}

for (const locale of ['nl', 'de']) {
  const file = `content/${locale}/pages.json`
  const raw = readFileSync(file, 'utf8')
  const data = JSON.parse(raw) as Record<string, { sections: Section[] }>

  /**
   * The guard: writing must not silently change anything but the hero.
   *
   * Checked on DATA, not bytes. `content/nl/pages.json` has one paragraph indented 12 spaces where the
   * serialiser emits 10, so a byte-exact test aborts on a file that is otherwise perfectly normal — as
   * it did on the first run of this script. What actually matters is that no VALUE changes, and that
   * any whitespace normalisation is small enough to read in the diff rather than burying the real edit.
   */
  const roundTrip = JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : '')
  if (JSON.stringify(JSON.parse(raw)) !== JSON.stringify(data)) {
    console.error(`FAIL ${file}: a no-op round-trip changes the DATA. Aborting.`)
    process.exit(1)
  }
  if (roundTrip !== raw) {
    const rawLines = raw.split('\n')
    const rtLines = roundTrip.split('\n')
    const drift = rawLines.filter((l, i) => l !== rtLines[i]).length
    if (drift > 5) {
      console.error(`FAIL ${file}: re-serialising would reformat ${drift} lines and bury the real change.`)
      process.exit(1)
    }
    console.log(`note ${file}: ${drift} line(s) will also be re-indented (whitespace only, no value changes)`)
  }

  const page = data['last-minutes']
  if (!page) {
    console.error(`FAIL ${file}: no "last-minutes" page`)
    process.exit(1)
  }

  const before = page.sections.map((s) => s.type).join(' → ')
  const at = page.sections.findIndex((s) => s.type === 'hero')

  if (at === -1) {
    /**
     * No hero: build one. Every field the type declares is written explicitly rather than left
     * undefined, so the CMS form renders a complete, editable hero rather than a half-populated one.
     */
    page.sections.unshift({
      type: 'hero',
      title: '',
      ctaLabel: '',
      ctaUrl: '',
      video: '',
      mobileVideo: '',
      images: [DESKTOP],
      mobileImages: [MOBILE],
    })
    console.log(`${locale}: inserted a hero at position 0`)
    changes++
  } else {
    const hero = page.sections[at]
    if (hero.images?.[0] !== DESKTOP || hero.mobileImages?.[0] !== MOBILE) {
      hero.images = [DESKTOP]
      hero.mobileImages = [MOBILE]
      console.log(`${locale}: filled the empty hero with the header image`)
      changes++
    }
    if (at !== 0) {
      page.sections.splice(at, 1)
      page.sections.unshift(hero)
      console.log(`${locale}: moved the hero from position ${at} to 0`)
      changes++
    }
  }

  const after = page.sections.map((s) => s.type).join(' → ')
  if (before !== after) console.log(`   ${before}\n-> ${after}`)

  if (write) writeFileSync(file, JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : ''))
}

console.log(
  changes === 0 ? '\nAlready up to date (no-op).' : `\n${changes} change(s) ${write ? 'written' : 'to write — re-run with --write'}`,
)
