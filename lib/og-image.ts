/**
 * The social share image for a page, derived from what the page itself shows.
 *
 * 53 of the 135 pages had no `og:image` — 49 of them already had none on the old site. A share of any
 * of those on WhatsApp, Facebook or LinkedIn renders as a bare link with no picture, which for a villa
 * rental is the least persuasive form a link can take.
 *
 * NOTHING NEW IS INVENTED HERE. An explicit `seo.ogImage` always wins; the fallback only reaches for a
 * photograph the page already displays — its hero, or the first real image in its content. That keeps
 * the share preview honest: what someone sees in the preview is what they see when they arrive, which
 * is also what the brief means by structured data and metadata matching visible content.
 *
 * WHY THIS IS CODE AND NOT 53 EDITS TO THE CONTENT
 *
 * Writing the paths into `pages.json` and `villas.json` by hand would freeze today's hero against
 * tomorrow's. When an editor swaps a page's hero image in the CMS, the share image should follow, and
 * with a derived fallback it does — with copied paths it silently keeps pointing at the old photo. The
 * CMS field stays available for the case where the two genuinely should differ.
 */
import type { ColumnBlock, Section, VillaContent } from './types'

/**
 * The homepage hero, used for the handful of pages that display no photograph at all.
 *
 * Deliberately NOT the logo: `site.logo` is an SVG, and Facebook, LinkedIn and WhatsApp all refuse to
 * render SVG in a share card — the result would be no image again, only harder to notice. This is a real
 * JPEG that already represents the site on its own homepage.
 */
const BRAND_FALLBACK = '/media/ameland-residence-20260730-b206f2-header-home-ameland-residence-desktop01.jpg'

/** A usable share image: a real path, and not a video. */
function usable(src: string | undefined): src is string {
  return !!src && src.startsWith('/media/') && !/\.(mp4|webm|mov)$/i.test(src)
}

/**
 * The first genuine photograph in a section list.
 *
 * Walks sections in document order and returns the first image a visitor would actually see, so the
 * share card matches the top of the page. `group` blocks are searched recursively because the column
 * layouts nest one level.
 *
 * Skips a hero's `video` (a share card cannot be an MP4) and falls through to that hero's poster images
 * instead, which is what the page shows before playback anyway.
 */
export function firstContentImage(sections: Section[] | undefined): string | undefined {
  for (const section of sections ?? []) {
    switch (section.type) {
      case 'hero': {
        const img = section.images?.find(usable)
        if (img) return img
        break
      }
      case 'textImage':
        if (usable(section.image)) return section.image
        break
      case 'gallery': {
        const img = section.images?.find(usable)
        if (img) return img
        break
      }
      case 'cards':
      case 'banners': {
        const img = section.items?.map((i) => i.image).find(usable)
        if (img) return img
        break
      }
      case 'columns': {
        const img = firstColumnImage(section.columns)
        if (img) return img
        break
      }
    }
  }
  return undefined
}

/** The same search inside a `columns` section, including `group` nesting. */
function firstColumnImage(blocks: ColumnBlock[] | undefined): string | undefined {
  for (const block of blocks ?? []) {
    if (block.kind === 'gallery') {
      const img = block.images?.find(usable)
      if (img) return img
    }
    if (block.kind === 'video' && usable(block.poster)) return block.poster
    if (block.kind === 'group') {
      const img = firstColumnImage(block.blocks)
      if (img) return img
    }
  }
  return undefined
}

/**
 * Share image for a normal page (`pages.json`, `home.json`).
 *
 * Order: the explicit CMS field, then the page's own first photograph, then the brand fallback. Every
 * page therefore ends up with one, and only the last resort is not page-specific.
 */
export function ogImageForPage(ogImage: string | undefined, sections: Section[] | undefined): string {
  if (usable(ogImage)) return ogImage
  return firstContentImage(sections) ?? BRAND_FALLBACK
}

/**
 * Share image for a villa.
 *
 * Prefers the hero over `cardImage`: the hero is the photograph the page opens with, while the card
 * image is framed for a 4:3 grid tile and is often a tighter crop that reads poorly at share-card
 * proportions. Both are the same villa, so either is truthful — this is a quality choice.
 */
export function ogImageForVilla(villa: VillaContent): string {
  if (usable(villa.seo?.ogImage)) return villa.seo.ogImage
  const hero = villa.hero?.images?.find(usable)
  if (hero) return hero
  if (usable(villa.cardImage)) return villa.cardImage
  return firstContentImage(villa.extraSections) ?? BRAND_FALLBACK
}

/**
 * Share image for a blog article.
 *
 * Articles already carry `image` and mostly set `ogImage` too, so this is mainly a guard for a new
 * article whose SEO block has not been filled in.
 */
export function ogImageForBlog(article: { image?: string; cardImage?: string; seo?: { ogImage?: string } }): string {
  if (usable(article.seo?.ogImage)) return article.seo.ogImage
  if (usable(article.image)) return article.image
  if (usable(article.cardImage)) return article.cardImage
  return BRAND_FALLBACK
}
