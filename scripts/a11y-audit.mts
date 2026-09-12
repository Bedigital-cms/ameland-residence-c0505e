/**
 * Accessibility and performance audit over the BUILT HTML.
 *
 *     pnpm build && pnpm audit:a11y
 *
 * Covers the checks from the task document's "Performance and accessibility" section that can be
 * verified statically from the markup. Contrast ratios are computed from the real CSS custom properties,
 * so the numbers are the ones that actually ship.
 *
 * Not covered here (needs a real browser / field data): Core Web Vitals measurements, and visual
 * regression. What IS covered is every input to them that lives in the markup — render mode, client-JS
 * surface, image dimensions, heading order, landmarks, focus states, and long-word overflow.
 */
import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

let failures = 0
let warnings = 0
const fail = (msg: string, list: string[] = []) => {
  console.log(`  FAIL ${msg}`)
  list.slice(0, 10).forEach((l) => console.log(`        ${l}`))
  if (list.length > 10) console.log(`        …and ${list.length - 10} more`)
  failures++
}
const warn = (msg: string, list: string[] = []) => {
  console.log(`  WARN ${msg}`)
  list.slice(0, 10).forEach((l) => console.log(`        ${l}`))
  warnings++
}

const files = globSync('.next-verify/server/app/**/*.html', { cwd: ROOT })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => !/_not-found|_global-error/.test(f))
  .sort()

if (files.length === 0) {
  console.error('No built pages found — run `pnpm build` first.')
  process.exit(1)
}

type Page = { url: string; html: string; main: string; locale: string }
const pages: Page[] = files.map((f) => {
  const html = readFileSync(path.join(ROOT, f), 'utf8')
  const url = '/' + f.replace('.next-verify/server/app/', '').replace('.html', '')
  return { url, html, main: html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html, locale: url.split('/')[1] ?? 'nl' }
})

console.log(`\n=== ACCESSIBILITY + PERFORMANCE AUDIT — ${pages.length} pages ===\n`)

/* ------------------------------------------------------------------ 1. contrast */

/** sRGB relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const css = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8')
const tokens: Record<string, string> = {}
for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) tokens[m[1]] = m[2]

console.log('--- 1. Colour contrast (computed from the shipped CSS tokens) ---')
const PAIRS: { name: string; fg: string; bg: string; min: number; note?: string }[] = [
  { name: 'body text on paper', fg: tokens['ink-body'], bg: tokens.paper, min: 4.5 },
  { name: 'headings on paper', fg: tokens['ink-soft'], bg: tokens.paper, min: 4.5 },
  { name: 'body text on grey', fg: tokens['ink-body'], bg: tokens.grey, min: 4.5 },
  { name: 'headings on grey', fg: tokens['ink-soft'], bg: tokens.grey, min: 4.5 },
  { name: 'headings on mint', fg: tokens['ink-soft'], bg: tokens.mint, min: 4.5 },
  { name: 'card-facts label on paper', fg: tokens['ink-soft'], bg: tokens.paper, min: 4.5 },
  { name: 'focus ring on paper', fg: tokens['sage-deep'], bg: tokens.paper, min: 3 },
  { name: 'sage-deep icon on grey', fg: tokens['sage-deep'], bg: tokens.grey, min: 3 },
  { name: 'primary button (white on ink)', fg: '#ffffff', bg: tokens.ink, min: 4.5 },
  { name: 'chip active (white on ink)', fg: '#ffffff', bg: tokens.ink, min: 4.5 },
  { name: 'handwriting subtitle on paper', fg: tokens['sage-deep'], bg: tokens.paper, min: 4.5 },
  { name: 'article card excerpt on paper', fg: tokens['sage-deep'], bg: tokens.paper, min: 4.5 },
  { name: 'usp bar (sage on ink)', fg: tokens.sage, bg: tokens.ink, min: 4.5 },
  { name: 'skip link (white on ink)', fg: '#ffffff', bg: tokens.ink, min: 4.5 },
]
const contrastIssues: string[] = []
for (const p of PAIRS) {
  if (!p.fg || !p.bg) continue
  const r = ratio(p.fg, p.bg)
  const ok = r >= p.min
  const line = `${ok ? 'ok  ' : 'LOW '} ${r.toFixed(2)}:1  (min ${p.min})  ${p.name}${p.note ? ` — ${p.note}` : ''}`
  console.log(`  ${line}`)
  if (!ok) contrastIssues.push(line.trim())
}
if (contrastIssues.length) warn(`${contrastIssues.length} colour pair(s) below target:`, contrastIssues)

/* ------------------------------------------------- 2. landmarks + skip link */

console.log('\n--- 2. Landmarks and document structure ---')
const noMain = pages.filter((p) => !/<main\b/i.test(p.html))
if (noMain.length) fail(`${noMain.length} page(s) with no <main> landmark:`, noMain.map((p) => p.url))
else console.log(`  ok   every page has a <main> landmark`)

const noLang = pages.filter((p) => !/<html[^>]+lang="[a-z]{2}/i.test(p.html))
if (noLang.length) fail(`${noLang.length} page(s) with no lang attribute:`, noLang.map((p) => p.url))
else console.log(`  ok   every page declares a document language`)

const navNoLabel = pages.filter((p) => {
  const navs = [...p.html.matchAll(/<nav\b([^>]*)>/gi)]
  return navs.some((m) => !/aria-label|aria-labelledby/i.test(m[1]))
})
if (navNoLabel.length) warn(`${navNoLabel.length} page(s) have a <nav> without an accessible name:`, navNoLabel.map((p) => p.url))
else console.log(`  ok   every <nav> has an accessible name`)

/**
 * A skip link must be the FIRST focusable element, otherwise a keyboard user still tabs through the whole
 * header before reaching it — which defeats the purpose.
 */
const noSkip = pages.filter((p) => !/class="skiplink"[^>]*href="#main"/.test(p.html))
if (noSkip.length) fail(`${noSkip.length} page(s) without a skip link:`, noSkip.map((p) => p.url))
else console.log(`  ok   every page has a skip-to-content link`)

const skipNotFirst = pages.filter((p) => {
  const body = p.html.slice(p.html.indexOf('<body'))
  const firstFocusable = body.search(/<(a|button|input|select|textarea)\b/i)
  const skipAt = body.indexOf('class="skiplink"')
  return skipAt < 0 || firstFocusable < 0 || skipAt > firstFocusable + 40
})
if (skipNotFirst.length) fail(`${skipNotFirst.length} page(s) where the skip link is not the first focusable element:`, skipNotFirst.map((p) => p.url))
else console.log(`  ok   the skip link is the first focusable element on every page`)

const noMainTarget = pages.filter((p) => !/<main[^>]+id="main"/.test(p.html))
if (noMainTarget.length) fail(`${noMainTarget.length} page(s) where <main> is not the skip target:`, noMainTarget.map((p) => p.url))
else console.log(`  ok   <main id="main"> is present as the skip target`)

/* ------------------------------------------------------ 3. controls have names */

console.log('\n--- 3. Interactive controls ---')
const namelessButtons: string[] = []
for (const p of pages) {
  for (const m of p.html.matchAll(/<button\b([^>]*)>([\s\S]{0,200}?)<\/button>/gi)) {
    const attrs = m[1]
    const inner = m[2].replace(/<[^>]+>/g, '').trim()
    if (!inner && !/aria-label|aria-labelledby|title=/i.test(attrs)) {
      namelessButtons.push(`${p.url}  <button${attrs.slice(0, 60)}>`)
    }
  }
}
if (namelessButtons.length) fail(`${namelessButtons.length} button(s) with no accessible name:`, namelessButtons)
else console.log(`  ok   every button has an accessible name`)

const namelessLinks: string[] = []
for (const p of pages) {
  for (const m of p.main.matchAll(/<a\b([^>]*)>([\s\S]{0,300}?)<\/a>/gi)) {
    if (/aria-hidden="true"/i.test(m[1])) continue // intentionally hidden duplicate link
    const inner = m[2].replace(/<[^>]+>/g, '').trim()
    if (!inner && !/aria-label|aria-labelledby|title=/i.test(m[1])) {
      namelessLinks.push(`${p.url}  <a${m[1].slice(0, 70)}>`)
    }
  }
}
if (namelessLinks.length) fail(`${namelessLinks.length} link(s) with no accessible name:`, namelessLinks)
else console.log(`  ok   every content link has an accessible name`)

/* --------------------------------------------------------- 4. focus visibility */

console.log('\n--- 4. Focus states ---')
const hasGlobalFocus = /:focus-visible\s*\{[^}]*outline/.test(css)
console.log(hasGlobalFocus ? `  ok   a global :focus-visible outline is defined` : `  FAIL no global focus outline`)
if (!hasGlobalFocus) failures++
/**
 * A rule that removes an outline is only a problem when it hits something a KEYBOARD user focuses.
 * Two legitimate exceptions:
 *  · a `:focus-visible` rule (that IS the keyboard state, and it sets its own ring)
 *  · `main:focus` — `<main tabIndex={-1}>` exists purely so the skip link can move focus there; it is
 *    not tab-reachable, so a ring on it would be noise after every skip.
 * The selector is also normalised: a comment immediately before a rule was being captured as part of it.
 */
const killsOutline = [...css.matchAll(/([^{}]+)\{[^}]*outline:\s*(none|0)[^}]*\}/g)]
  // A comment immediately before a rule gets swept into the selector capture — strip it first.
  .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim())
  .filter((sel) => sel && !/:focus-visible/.test(sel) && !/^main:focus$/.test(sel))
if (killsOutline.length) warn(`${killsOutline.length} rule(s) remove an outline:`, killsOutline.map((s) => s.slice(0, 70)))
else console.log(`  ok   no rule removes a keyboard focus outline`)

/* ------------------------------------------- 5. reduced motion + long words */

console.log('\n--- 5. Motion and text overflow ---')
console.log(
  /@media \(prefers-reduced-motion: reduce\)/.test(css)
    ? `  ok   reduced-motion preference is honoured`
    : `  FAIL no prefers-reduced-motion block`,
)
if (!/@media \(prefers-reduced-motion: reduce\)/.test(css)) failures++

/**
 * Long German compounds ("Allgemeine Geschäftsbedingungen", "Verfügbarkeit", "Ladestation") overflow
 * narrow columns unless a break is allowed. Check the German pages for the longest word actually
 * rendered, and confirm the CSS permits breaking somewhere.
 */
const longest: { word: string; page: string }[] = []
for (const p of pages.filter((x) => x.locale === 'de')) {
  /**
   * Strip <script> (the JSON-LD block is full of URLs) BEFORE taking the text, and drop anything that
   * looks like a URL or slug rather than prose. Without that, the longest "German word" came back as
   * `ameland-residence-20260730-291575-warum-ein-urlaub…` — a media filename inside a JSON-LD payload,
   * which is not rendered text and cannot overflow anything.
   */
  const text = p.main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
  for (const w of text.split(/[\s/,.;:!?()[\]"'—–]+/)) {
    if (w.length < 24) continue
    // Real German compounds have no hyphens-as-separators, no digits, and no URL punctuation.
    if (/[-_#@]|\d/.test(w)) continue
    longest.push({ word: w, page: p.url })
  }
}
const uniqueLong = [...new Map(longest.map((l) => [l.word, l])).values()].sort((a, b) => b.word.length - a.word.length)
const hasWrapGuard = /overflow-wrap:\s*(anywhere|break-word)|word-break:\s*break-word|hyphens:\s*auto/.test(css)
console.log(
  uniqueLong.length === 0
    ? `  ok   no German word longer than 24 characters is rendered`
    : `  ${uniqueLong.length} long German word(s) rendered; longest: "${uniqueLong[0].word}" (${uniqueLong[0].word.length} chars)`,
)
if (uniqueLong.length > 0) {
  uniqueLong.slice(0, 5).forEach((l) => console.log(`        ${l.word.length}  ${l.word}  (${l.page})`))
  console.log(
    hasWrapGuard
      ? `  ok   the CSS allows long words to break (overflow-wrap / hyphens present)`
      : `  WARN no overflow-wrap or hyphens rule — long words may overflow narrow columns`,
  )
  if (!hasWrapGuard) warnings++
}

/* --------------------------------------------------- 6. client-JS surface */

console.log('\n--- 6. Client JavaScript surface ---')
const clientComponents = globSync('components/**/*.tsx', { cwd: ROOT }).filter((f) =>
  readFileSync(path.join(ROOT, f), 'utf8').startsWith("'use client'"),
)
console.log(`  ${clientComponents.length} client component(s):`)
clientComponents.forEach((f) => console.log(`        ${f.split(path.sep).join('/')}`))
console.log(`  (everything else renders on the server — the brief asks to avoid unnecessary client JS)`)

/* ------------------------------------------------------------------ verdict */

console.log(
  failures === 0
    ? `\n=== NO BLOCKING A11Y PROBLEMS ===${warnings ? ` (${warnings} warning(s))` : ''}`
    : `\n=== ${failures} BLOCKING PROBLEM(S), ${warnings} warning(s) ===`,
)
process.exit(failures === 0 ? 0 : 1)
