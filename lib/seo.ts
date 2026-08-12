import type { Metadata } from 'next'

import type { Seo } from './types'

/**
 * Turn a page's stored SEO block into Next metadata.
 *
 * Titles, descriptions, keywords and social images were migrated one-for-one from the previous site
 * so search rankings survive the move; the CMS can edit them per page, per language.
 */
export function metadataFrom(seo: Seo | undefined, fallbackTitle: string): Metadata {
  const title = seo?.title || fallbackTitle
  const noindex = /noindex/i.test(seo?.robots || '')
  return {
    // `absolute` so a migrated title is used verbatim, without the layout's "| brand" template.
    title: { absolute: title },
    description: seo?.description || undefined,
    keywords: seo?.keywords || undefined,
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: seo?.description || undefined,
      images: seo?.ogImage ? [seo.ogImage] : undefined,
      type: 'website',
    },
  }
}
