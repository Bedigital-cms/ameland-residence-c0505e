'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import { applyBlogQuery, featuredBlog, type BlogQuery } from '@/lib/blog-query'
import { topicsFor } from '@/lib/blog-topics'
import type { BlogCollection } from '@/lib/types'

import { BlogIndex } from './BlogIndex'

/**
 * Applies the blog overview's `?q=&topic=&page=` state on the client.
 *
 * WHY THIS EXISTS — keeping the hub STATIC.
 *
 * The first version read `searchParams` in the server component. That works, but it opts the whole route
 * out of static generation: the build output showed `ƒ /[locale]/[slug]` and `/nl/blogs` + `/de/blogs`
 * stopped being prerendered, so the two most-linked pages on the site became server-rendered on demand
 * (and, in this build, produced no HTML at all — the link audit caught it as 133 "broken" links to a
 * page that had no file).
 *
 * Reading the query string here instead keeps the hub in the static export. The trade-off is handled:
 *
 *  · The SERVER still renders the complete, unfiltered index — all cards, the featured article, and the
 *    full crawlable link list. That is what ships in the HTML and what a crawler or a JS-less visitor
 *    sees, which is exactly what the brief requires ("all articles accessible through standard crawlable
 *    links", "accessible without JavaScript").
 *  · With JavaScript on, this component re-renders the same index filtered. The controls remain real
 *    links and a real GET form, so navigation still works by URL either way — JS only saves a round trip.
 *
 * `useSearchParams` requires a Suspense boundary during static generation; the parent provides it.
 */
export function BlogFilterState({
  locale,
  blogs,
  base,
  formAction,
}: {
  locale: string
  blogs: BlogCollection
  base: string
  formAction: string
}) {
  const params = useSearchParams()

  const query: BlogQuery = useMemo(() => {
    const known = new Set(topicsFor(locale).map((t) => t.id))
    const rawTopic = (params.get('topic') ?? '').trim().toLowerCase()
    const rawPage = Number.parseInt(params.get('page') ?? '', 10)
    return {
      q: (params.get('q') ?? '').trim().slice(0, 80),
      topic: known.has(rawTopic) ? rawTopic : '',
      page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 9999) : 1,
    }
  }, [params, locale])

  const { searchMatched, filtered } = useMemo(() => applyBlogQuery(locale, blogs, query), [locale, blogs, query])

  return (
    <BlogIndex
      locale={locale}
      blogs={blogs}
      base={base}
      formAction={formAction}
      query={query}
      searchMatched={searchMatched}
      filtered={filtered}
      featured={featuredBlog(blogs)}
    />
  )
}
