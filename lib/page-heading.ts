/**
 * Works out a page's H1 — and where it should come from — WITHOUT inventing editorial text.
 *
 * The problem this solves (found during the audit): `HeroBlock` renders its title as a <p
 * class="hero-title">, and every `pages.json` hero stores `title: ""`. Every section heading below is
 * an <h2> from `SectionTitle`. So all 20 nl + 21 de pages, plus the homepage, shipped with NO <h1> at
 * all and a heading tree that starts at H2. Only villa and blog detail pages had one.
 *
 * The fix must not write new copy (the task document forbids inventing editorial text and requires
 * using existing page titles). Every page already HAS a human-readable display heading — it is just
 * marked up as an H2 in the first text/textImage section:
 *
 *     over-ons   → sections[0] hero (title "")   + sections[1] textImage title "Over ons"
 *     contact    → sections[0] hero (title "")   + sections[1] text      title "Contactgegevens"
 *
 * So: take that existing heading, render it as the page's H1 inside the hero overlay, and demote the
 * now-duplicated section heading so the text isn't printed twice. Nothing is rewritten — the same
 * words move from an <h2> under the image to an <h1> over it, which is precisely what the document
 * asks for ("Display 'About us' clearly as the H1 inside the hero image").
 *
 * `page.title` is deliberately NOT used as the H1: those are SEO meta titles carrying a
 * "| Ameland Residence" suffix ("Contactgegevens | Ameland Residence", "Sinds 2009 luxe
 * vakantievilla's op Ameland | Ameland Residence"). They belong in <title>, not on the page.
 */
import type { Section } from './types'

export type PageHeading = {
  /** The H1 text, taken verbatim from existing content. Empty when the page has no usable heading. */
  text: string
  /**
   * Index of the section the heading was taken from, so the renderer can suppress that section's own
   * <h2> and avoid printing the same words twice. -1 when the heading came from elsewhere.
   */
  fromSection: number
  /** Index of the hero section to place the H1 in, or -1 when the page has no hero. */
  heroIndex: number
}

/**
 * Section types whose `title` is a page-level display heading (not a sub-heading deep in the page).
 *
 * `text`/`textImage` are the common case. The others matter for pages whose entire body IS one
 * section and whose only heading lives there — verified against the content: the blog hub's heading
 * sits on its `collection` ("Blogs"), the reviews page's on its `reviews` section, and the villa hub's
 * on its first `text`. Without them those pages find no heading and end up with no H1 at all.
 */
const HEADING_SECTIONS = new Set(['text', 'textImage', 'collection', 'reviews', 'cards'])

/**
 * Find the H1 for a page.
 *
 * Order of preference, all from existing content:
 *  1. The hero's own `title`, when an editor has set one — it is already displayed over the image.
 *  2. The title of the first heading-bearing section, which is the page's visible heading today.
 *  3. The page's own `title` with its SEO suffix stripped, for the handful of pages whose body is a
 *     widget or a generated index and which carry no display heading at all.
 *
 * `fromSection` is only set for case 2, where the heading has to be suppressed at its old location.
 */
export function pageHeading(sections: Section[], fallbackTitle?: string): PageHeading {
  const heroIndex = sections.findIndex((s) => s.type === 'hero')

  // 1. An explicitly authored hero title wins — it is the intended page heading.
  if (heroIndex >= 0) {
    const hero = sections[heroIndex]
    if (hero.type === 'hero' && hero.title.trim()) {
      return { text: hero.title.trim(), fromSection: -1, heroIndex }
    }
  }

  // 2. Otherwise adopt the first section heading, which is what visitors see as the page title today.
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    if (!HEADING_SECTIONS.has(s.type)) continue
    const title = 'title' in s && typeof s.title === 'string' ? s.title.trim() : ''
    if (title) return { text: title, fromSection: i, heroIndex }
  }

  // 3. Last resort — the page's own `title`, with the SEO suffix stripped. A few pages carry no
  //    display heading anywhere in their sections (sitemap, video, zoek-boek): their body is a widget
  //    or a generated index. This is still EXISTING text, and the alternative is a page with no H1,
  //    which the task document forbids outright.
  const fallback = cleanSeoTitle(fallbackTitle)
  if (fallback) return { text: fallback, fromSection: -1, heroIndex }

  return { text: '', fromSection: -1, heroIndex }
}

/**
 * Reduce an SEO meta title to a usable on-page heading.
 *
 * `pages.json` titles are written for the <title> tag and carry a brand suffix
 * ("Contactgegevens | Ameland Residence", "Sitemap | Ameland Residence"). On the page itself that
 * suffix is noise — the brand already appears in the header and the breadcrumb — so the part before
 * the separator is used. Only " | ", " - " and dashes surrounded by spaces count as separators, so a
 * hyphenated word is never split. Falls back to the full title when nothing is left.
 */
function cleanSeoTitle(title: string | undefined): string {
  if (!title) return ''
  const head = title.split(/\s+[|–—]\s+|\s+-\s+/)[0]?.trim() ?? ''
  return head || title.trim()
}
