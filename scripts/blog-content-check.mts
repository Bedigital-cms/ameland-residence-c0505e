/**
 * Check every blog article for damaged HTML, joined paragraphs and missing subheadings.
 *
 *     pnpm test:blog-content
 *
 * The task document asks for this explicitly. Each check below looks for a specific failure mode that a
 * content migration actually produces, rather than generic linting:
 *
 *  · UNCLOSED / UNKNOWN TAGS — `RichText` renders these strings with `dangerouslySetInnerHTML`, so a
 *    stray `<div` or an unbalanced `<strong>` silently swallows the rest of the article in the browser.
 *  · ESCAPED MARKUP — `&lt;p&gt;` in the text means a migration double-escaped it; the reader sees the
 *    tags as literal characters.
 *  · JOINED PARAGRAPHS — a single "paragraph" holding several hundred words with many sentence breaks is
 *    the signature of two or more paragraphs merged during migration.
 *  · MISSING SUBHEADINGS — a long article whose blocks all have an empty `heading` renders as an
 *    undifferentiated wall of text and has no H2s for structure.
 *  · BROKEN LINKS — an `<a>` with no href, or an href that points at a page/asset that does not exist.
 *  · MEDIA REFS — every `/media/` path in body text must exist in the delivery folder.
 *
 * Findings are WARNINGS, not failures, except structural HTML damage: the rest are editorial judgements
 * for the client, and this script's job is to surface them with enough detail to act on.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import type { BlogCollection, PageCollection, VillaCollection } from '../lib/types.js'

const ROOT = process.cwd()
const MEDIA_DIR = path.join(ROOT, '_import', 'ameland-residence')

/** Tags the CMS rich-text subset is allowed to produce (see lib/types.ts `Html`). */
const ALLOWED = new Set(['strong', 'em', 'b', 'i', 'a', 'br', 'ul', 'ol', 'li', 'h3', 'h4', 'p', 'span'])
/** Void elements that legitimately never close. */
const VOID = new Set(['br', 'img', 'hr'])

type Finding = { severity: 'ERROR' | 'WARN'; locale: string; slug: string; what: string; detail: string }
const findings: Finding[] = []

const mediaOnDisk = existsSync(MEDIA_DIR) ? new Set(readdirSync(MEDIA_DIR)) : null

/** Every tag in the string, in order, as {name, closing}. */
function tags(html: string): { name: string; closing: boolean; selfClosing: boolean }[] {
  return [...html.matchAll(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)\s*>/g)].map((m) => ({
    name: m[2].toLowerCase(),
    closing: m[1] === '/',
    selfClosing: m[3] === '/',
  }))
}

/** Report unbalanced or unknown tags. */
function checkHtml(locale: string, slug: string, where: string, html: string): void {
  // A `<` that never becomes a tag — usually a truncated element.
  const stray = html.match(/<(?![/a-zA-Z!])/)
  if (stray) findings.push({ severity: 'ERROR', locale, slug, what: 'stray "<"', detail: `${where}: …${html.slice(Math.max(0, (stray.index ?? 0) - 40), (stray.index ?? 0) + 40)}…` })

  // Double-escaped markup: the reader sees the tags.
  if (/&lt;\s*\/?\s*(p|div|strong|em|a|br|ul|li|h[1-6])\b/i.test(html)) {
    findings.push({ severity: 'ERROR', locale, slug, what: 'escaped HTML in text', detail: `${where}: ${html.slice(0, 120)}` })
  }

  const stack: string[] = []
  for (const t of tags(html)) {
    if (!ALLOWED.has(t.name)) {
      findings.push({ severity: 'ERROR', locale, slug, what: `unexpected <${t.name}>`, detail: where })
      continue
    }
    if (VOID.has(t.name) || t.selfClosing) continue
    if (t.closing) {
      const open = stack.pop()
      if (open !== t.name) {
        findings.push({
          severity: 'ERROR',
          locale,
          slug,
          what: 'mismatched tags',
          detail: `${where}: </${t.name}> closes <${open ?? 'nothing'}>`,
        })
        return
      }
    } else {
      stack.push(t.name)
    }
  }
  if (stack.length) {
    findings.push({ severity: 'ERROR', locale, slug, what: 'unclosed tag(s)', detail: `${where}: <${stack.join('>, <')}>` })
  }
}

/** Plain text length and sentence count, for the joined-paragraph heuristic. */
function stats(html: string): { words: number; sentences: number } {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    words: text ? text.split(' ').length : 0,
    // Sentence ends: . ! ? followed by space + capital, which avoids counting "3.5" or "bijv.".
    sentences: (text.match(/[.!?]\s+[A-ZÄÖÜÉ]/g) ?? []).length + 1,
  }
}

/* ------------------------------------------------------------------------- run */

for (const locale of ['nl', 'de']) {
  const blogs = JSON.parse(readFileSync(`content/${locale}/blogs.json`, 'utf8')) as BlogCollection
  const pages = JSON.parse(readFileSync(`content/${locale}/pages.json`, 'utf8')) as PageCollection
  const villas = JSON.parse(readFileSync(`content/${locale}/villas.json`, 'utf8')) as VillaCollection

  // Link targets that exist: pages, villas (under their hub), articles (under theirs).
  const villaHub = Object.entries(pages).find(([, p]) => p.kind === 'villas-hub')?.[0] ?? ''
  const blogHub = Object.entries(pages).find(([, p]) => p.kind === 'blogs-hub')?.[0] ?? ''
  const known = new Set<string>(['/'])
  for (const slug of Object.keys(pages)) known.add(`/${slug}`)
  for (const slug of Object.keys(villas)) known.add(`/${villaHub}/${slug}`)
  for (const slug of Object.keys(blogs)) known.add(`/${blogHub}/${slug}`)

  for (const [slug, blog] of Object.entries(blogs)) {
    const bodies = (blog.blocks ?? []).flatMap((b, i) => b.paragraphs.map((p, j) => ({ html: p, where: `blocks[${i}].paragraphs[${j}]` })))

    for (const { html, where } of bodies) {
      checkHtml(locale, slug, where, html)

      // Joined paragraphs: very long AND many sentence breaks.
      const { words, sentences } = stats(html)
      if (words > 180 && sentences >= 6) {
        findings.push({
          severity: 'WARN',
          locale,
          slug,
          what: 'possibly joined paragraphs',
          detail: `${where}: ${words} words, ~${sentences} sentences`,
        })
      }

      // Links
      for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
        const href = m[1].match(/href\s*=\s*"([^"]*)"/i)?.[1]
        if (!href) {
          findings.push({ severity: 'ERROR', locale, slug, what: '<a> without href', detail: where })
          continue
        }
        if (href.startsWith('/media/')) {
          const file = decodeURIComponent(href.replace('/media/', ''))
          if (mediaOnDisk && !mediaOnDisk.has(file)) {
            findings.push({ severity: 'WARN', locale, slug, what: 'link to missing media', detail: `${where}: ${href}` })
          }
          continue
        }
        if (href.startsWith('/')) {
          const clean = href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'
          if (!known.has(clean)) {
            findings.push({ severity: 'WARN', locale, slug, what: 'internal link to unknown page', detail: `${where}: ${href}` })
          }
        }
      }

      // Media referenced from body text
      for (const m of html.matchAll(/\/media\/([^"'\s)>]+)/g)) {
        const file = decodeURIComponent(m[1])
        if (mediaOnDisk && !mediaOnDisk.has(file)) {
          findings.push({ severity: 'WARN', locale, slug, what: 'missing media file', detail: `${where}: ${file}` })
        }
      }
    }

    // Missing subheadings on a long article.
    const totalWords = bodies.reduce((n, b) => n + stats(b.html).words, 0)
    const headings = (blog.blocks ?? []).filter((b) => (b.heading ?? '').trim()).length
    if (totalWords > 400 && headings === 0) {
      findings.push({
        severity: 'WARN',
        locale,
        slug,
        what: 'no subheadings',
        detail: `${totalWords} words across ${(blog.blocks ?? []).length} block(s), none with a heading`,
      })
    }

    // Empty article / empty excerpt — nothing to render or nothing to show on the card.
    if (totalWords === 0) findings.push({ severity: 'ERROR', locale, slug, what: 'article has no body text', detail: '' })
    if (!(blog.excerpt ?? '').trim()) findings.push({ severity: 'WARN', locale, slug, what: 'no excerpt', detail: 'card shows title only' })
    if (!(blog.cardImage || blog.image)) findings.push({ severity: 'WARN', locale, slug, what: 'no card image', detail: 'card falls back to a placeholder' })
  }
}

/* ---------------------------------------------------------------------- report */

const errors = findings.filter((f) => f.severity === 'ERROR')
const warns = findings.filter((f) => f.severity === 'WARN')

const group = (list: Finding[]) => {
  const byWhat = new Map<string, Finding[]>()
  for (const f of list) {
    if (!byWhat.has(f.what)) byWhat.set(f.what, [])
    byWhat.get(f.what)!.push(f)
  }
  return [...byWhat.entries()].sort((a, b) => b[1].length - a[1].length)
}

console.log(`\n=== BLOG CONTENT CHECK ===\n`)
console.log(`structural errors: ${errors.length}`)
for (const [what, list] of group(errors)) {
  console.log(`\n  ${what}  (${list.length})`)
  for (const f of list.slice(0, 8)) console.log(`     ${f.locale}/${f.slug} — ${f.detail}`)
  if (list.length > 8) console.log(`     …and ${list.length - 8} more`)
}

console.log(`\neditorial warnings: ${warns.length}`)
for (const [what, list] of group(warns)) {
  console.log(`\n  ${what}  (${list.length})`)
  for (const f of list.slice(0, 8)) console.log(`     ${f.locale}/${f.slug} — ${f.detail}`)
  if (list.length > 8) console.log(`     …and ${list.length - 8} more`)
}

console.log(
  errors.length === 0
    ? `\n=== NO STRUCTURAL HTML DAMAGE ===`
    : `\n=== ${errors.length} STRUCTURAL PROBLEM(S) ===`,
)
process.exit(errors.length === 0 ? 0 : 1)
