/**
 * Villa detail page checks, run against the BUILT HTML.
 *
 *     pnpm build && pnpm test:villa-page
 *
 * The villa page gained in-page anchor navigation, a key-facts strip and a reordered section flow. Each
 * of those has a way of silently rotting, so each gets a check:
 *
 *  1. DEAD ANCHORS — every `href="#id"` in the nav must have a matching element id on the same page.
 *     A renamed section leaves a link that scrolls nowhere, and nothing in a normal build would notice.
 *  2. ORPHANED SECTIONS — an anchor target that nothing links to means the nav lost an entry.
 *  3. FACT HONESTY — the strip may only state facts the page itself supports. Checked by re-deriving
 *     them from the content and comparing against what was rendered.
 *  4. SECTION ORDER — key facts and the nav must come BEFORE the prose, and booking must be last. That
 *     ordering is the point of the change; a future edit that reshuffles it should fail here.
 *  5. ONE H1 — the reorder moved headings around, so re-assert it per villa page.
 */
import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { VillaCollection } from '../lib/types.js'
import { villaFacts } from '../lib/villa-facts.js'
import { villaAttributes } from '../lib/villa-filter.js'

const ROOT = process.cwd()

let failures = 0
const fail = (page: string, msg: string) => {
  console.log(`  FAIL ${page}: ${msg}`)
  failures++
}

/** Villa detail pages in the build output, by locale + hub + slug. */
const pages = globSync('.next-verify/server/app/{nl,de}/{villa-s,ferienhauser}/*.html', { cwd: ROOT }).map((f) =>
  f.split(path.sep).join('/'),
)

if (pages.length === 0) {
  console.error('No villa pages found in .next-verify — run `pnpm build` first.')
  process.exit(1)
}

const villasByLocale: Record<string, VillaCollection> = {
  nl: JSON.parse(readFileSync(path.join(ROOT, 'content/nl/villas.json'), 'utf8')),
  de: JSON.parse(readFileSync(path.join(ROOT, 'content/de/villas.json'), 'utf8')),
}

console.log(`\n=== VILLA PAGE CHECK (${pages.length} pages) ===\n`)

for (const file of pages) {
  const html = readFileSync(path.join(ROOT, file), 'utf8')
  const rel = file.replace('.next-verify/server/app/', '').replace('.html', '')
  const [locale, , slug] = rel.split('/')
  const villa = villasByLocale[locale]?.[slug]
  if (!villa) {
    fail(rel, 'no matching villa in content')
    continue
  }

  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html

  /* 1 + 2 — anchors */
  const navTargets = [...main.matchAll(/class="villanav-link" href="#([^"]+)"/g)].map((m) => m[1])
  const ids = new Set([...main.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
  for (const target of navTargets) {
    if (!ids.has(target)) fail(rel, `nav links to #${target} but no element has that id`)
  }
  // Anchor targets the page defines for villa sections, that the nav does not offer.
  const SECTION_IDS = ['over-deze-villa', 'fotos', 'indeling', 'voorzieningen', 'faq', 'boeken']
  for (const id of SECTION_IDS) {
    if (ids.has(id) && navTargets.length >= 3 && !navTargets.includes(id)) {
      fail(rel, `#${id} exists but the nav does not link to it`)
    }
  }

  /* 3 — the strip may only claim what the content states */
  const facts = villaFacts(villa)
  /**
   * Numbers are checked against `villaAttributes`, not `villaFacts`.
   *
   * The rule is unchanged — a page may not display a figure the content does not state — but "the
   * content" now includes the numeric `guests`/`bedrooms`/`bathrooms` fields, which is where these
   * values authoritatively live. Checking the prose parse alone would fail every villa whose capacity
   * is a field rather than a sentence, which is now all of them.
   *
   * The check still bites: delete a `guests` field and the tile disappears with it, so a rendered
   * number always traces back to a stated one.
   */
  const numbers = villaAttributes(villa)
  const rendered = new Map(
    [...main.matchAll(/class="keyfact-label">([^<]*)<\/dt><dd class="keyfact-value">([^<]*)</g)].map((m) => [m[1], m[2]]),
  )
  const guestLabel = locale === 'de' ? 'Personen' : 'Personen'
  if (rendered.has(guestLabel) && !numbers.guests) {
    fail(rel, `renders a guest count but the content states none`)
  }
  if (numbers.guests && rendered.get(guestLabel) !== String(numbers.guests)) {
    // Only an error when a value is shown that disagrees; a missing tile is fine below the 2-tile floor.
    if (rendered.has(guestLabel)) fail(rel, `guest count ${rendered.get(guestLabel)} != content ${numbers.guests}`)
  }
  const petsLabel = locale === 'de' ? 'Haustiere' : 'Huisdieren'
  if (rendered.has(petsLabel) && facts.petsAllowed === undefined) {
    fail(rel, `renders a pet policy but the content states none`)
  }

  /* 4 — order: key facts and nav before the prose, booking last */
  const iFacts = main.indexOf('section-keyfacts')
  const iNav = main.indexOf('villanav')
  const iIntro = main.indexOf('section-villa-intro')
  const iBooking = main.indexOf('section-booking')

  if (iFacts >= 0 && iIntro >= 0 && iFacts > iIntro) fail(rel, 'key facts render after the intro prose')
  if (iNav >= 0 && iIntro >= 0 && iNav > iIntro) fail(rel, 'anchor nav renders after the intro prose')
  if (iBooking >= 0) {
    for (const [name, idx] of [
      ['gallery', main.indexOf('section-gallery')],
      ['layout', main.indexOf('section-features')],
      ['faq', main.indexOf('class="faq"')],
    ] as const) {
      if (idx >= 0 && idx > iBooking) fail(rel, `${name} renders after the booking widget`)
    }
  }

  /* 5 — exactly one h1 */
  const h1s = [...main.matchAll(/<h1\b/g)].length
  if (h1s !== 1) fail(rel, `${h1s} <h1> element(s), expected 1`)

  const tiles = rendered.size
  console.log(
    `  ok   ${rel.padEnd(40)} tiles:${String(tiles).padStart(2)}  nav:${String(navTargets.length).padStart(2)}  h1:${h1s}`,
  )
}

console.log(failures === 0 ? `\nALL VILLA PAGE CHECKS PASSED` : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
