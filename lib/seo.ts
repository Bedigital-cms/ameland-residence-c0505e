import type { Metadata } from 'next'

import type { Seo } from './types'
import { alternatesFor } from './urls'

/**
 * Turn a page's stored SEO block into Next metadata.
 *
 * Titles, descriptions, keywords and social images were migrated one-for-one from the previous site
 * so search rankings survive the move; the CMS can edit them per page, per language.
 *
 * `page` describes this page's identity across languages and adds the two things every indexable
 * page needs and this template previously emitted nowhere:
 *   · a SELF-REFERENCING CANONICAL, built for the active routing mode — see `lib/urls.ts` for why
 *     the route path alone would be wrong in production;
 *   · reciprocal HREFLANG alternates (`nl-NL` / `de-DE` / `x-default`), only between pages that
 *     genuinely exist in both languages.
 *
 * Omit `page` and the metadata keeps its previous behaviour (no canonical, no alternates) — used for
 * routes that aren't indexable targets.
 *
 * A `noindex` page still gets a canonical: the directive keeps it out of the index, while the
 * canonical keeps any signals it does accumulate pointing at itself rather than at a duplicate.
 */
export type PageIdentity = {
  /** The language being rendered. */
  locale: string
  /** locale → that language's prefix-free path for this page (see content/equivalents.ts). */
  equivalents: Record<string, string>
}

export function metadataFrom(seo: Seo | undefined, fallbackTitle: string, page?: PageIdentity): Metadata {
  const title = seo?.title || fallbackTitle
  const noindex = /noindex/i.test(seo?.robots || '')
  const alternates = page ? alternatesFor(page.locale, page.equivalents) : undefined
  const canonical = alternates?.canonical
  return {
    // `absolute` so a migrated title is used verbatim, without the layout's "| brand" template.
    title: { absolute: title },
    description: seo?.description || undefined,
    keywords: seo?.keywords || undefined,
    robots: noindex ? { index: false, follow: true } : undefined,
    ...(alternates ? { alternates } : {}),
    openGraph: {
      title,
      description: seo?.description || undefined,
      images: seo?.ogImage ? [seo.ogImage] : undefined,
      type: 'website',
      // Open Graph URL must be the canonical one, else shares and the canonical disagree.
      ...(canonical ? { url: canonical } : {}),
    },
  }
}
