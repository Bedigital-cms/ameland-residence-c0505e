/**
 * Parse and apply the blog overview's URL state.
 *
 * All filter state is in the query string (`?q=&topic=&page=`) so every view is a real, crawlable,
 * bookmarkable URL and the whole overview works with JavaScript disabled — see `components/BlogIndex.tsx`
 * for why that shape was chosen.
 *
 * Inputs here come straight from the URL, i.e. from an untrusted source, so each one is validated
 * rather than trusted: `topic` must be a known id, `page` must be a sane positive integer, and `q` is
 * length-capped. Nothing is interpolated into markup — the search term is rendered as text by React —
 * but a 10 KB query string should still not become a 10 KB regex haystack on every request.
 */
import { matchesQuery, topicsFor, topicsOf } from './blog-topics'
import type { BlogCollection, BlogContent } from './types'

export type BlogQuery = { q: string; topic: string; page: number }

/** Longest search term accepted. Well past any real query; blocks pathological input. */
const MAX_Q = 80

/** Next gives a repeated query param as an array; take the first and ignore the rest. */
function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

/**
 * Read `?q=&topic=&page=` into a validated query object.
 *
 * An unknown topic id resolves to '' (show everything) rather than an empty result set: a stale or
 * hand-edited link should degrade to the full list, not to a dead-looking page.
 */
export function parseBlogQuery(
  locale: string,
  searchParams: Record<string, string | string[] | undefined> | undefined,
): BlogQuery {
  const sp = searchParams ?? {}
  const q = first(sp.q).trim().slice(0, MAX_Q)

  const rawTopic = first(sp.topic).trim().toLowerCase()
  const known = new Set(topicsFor(locale).map((t) => t.id))
  const topic = known.has(rawTopic) ? rawTopic : ''

  const rawPage = Number.parseInt(first(sp.page), 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 9999) : 1

  return { q, topic, page }
}

export type BlogEntry = { slug: string; blog: BlogContent }

/**
 * Apply the query in two stages, because the UI needs both.
 *
 *   · `searchMatched` — search only. Drives the topic-chip counts, so each chip can show how many
 *     results it would give *within the current search*. Counting the fully filtered list instead would
 *     zero every chip but the active one.
 *   · `filtered` — search AND topic. What actually gets listed.
 */
export function applyBlogQuery(
  locale: string,
  blogs: BlogCollection,
  query: BlogQuery,
): { searchMatched: BlogEntry[]; filtered: BlogEntry[] } {
  const all: BlogEntry[] = Object.entries(blogs).map(([slug, blog]) => ({ slug, blog }))

  const searchMatched = query.q ? all.filter((e) => matchesQuery(e.blog, query.q)) : all
  const filtered = query.topic
    ? searchMatched.filter((e) => topicsOf(locale, e.blog).includes(query.topic))
    : searchMatched

  return { searchMatched, filtered }
}

/**
 * The featured article: the first entry in the collection.
 *
 * `BlogContent` has no date, no "featured" flag and no ordering field, so there is nothing to rank by —
 * picking "newest" or "most popular" would be inventing data the content does not contain. The JSON key
 * order is the order the client's CMS lists them in, which makes the first entry the closest thing to an
 * editorial choice that actually exists. It is also stable, so the featured article does not change
 * between builds.
 */
export function featuredBlog(blogs: BlogCollection): BlogEntry | undefined {
  const [slug, blog] = Object.entries(blogs)[0] ?? []
  return slug && blog ? { slug, blog } : undefined
}
