import { LocaleLink } from './LocaleLink'
import { Media } from './Media'
import { Icon } from './icons'

import type { BlogEntry, BlogQuery } from '@/lib/blog-query'
import { countTopics, topicsFor, type Topic } from '@/lib/blog-topics'
import type { BlogCollection, BlogContent } from '@/lib/types'
import { t } from '@/lib/ui-text'

/**
 * Blog overview: featured article, search, topic filters, result count, reset, and paging.
 *
 * SERVER-RENDERED, URL-DRIVEN — no client JavaScript.
 *
 * The task document requires every article to stay reachable through standard crawlable links and to
 * work without JavaScript. A client-side filter would break both: the articles would exist only in a JS
 * array, so a crawler (and a visitor with JS off) would see an empty list.
 *
 * So all state lives in the query string and the filtering happens on the server:
 *
 *     /blogs?q=hond&topic=natuur&page=2
 *
 *   · search      -> a plain <form method="get"> — submitting navigates, no handler needed
 *   · topics      -> ordinary <a href> links that set/clear `?topic=`
 *   · pagination  -> ordinary <a href> links that set `?page=`
 *   · reset       -> a link back to the bare hub URL
 *
 * Every control is a link or a native form control, so each filter state is its own crawlable URL and
 * keyboard navigation works for free. Filtered views are `noindex, follow` (see the route) so the
 * combinations do not compete with the hub in search results, while the links are still followed.
 *
 * PAGING AND CRAWLABILITY. Paging shows a slice, which would normally hide articles from a crawler that
 * does not follow `?page=`. Two mitigations: the numbered page links are real anchors, and the hub
 * renders a plain link list of EVERY article below the grid (`.bloglist`), so all 57 are in the HTML of
 * page 1 regardless of the active filter.
 */

/** Articles per page. 12 fills a 3-column grid exactly, and keeps page 1 of 57 to a sane length. */
export const PER_PAGE = 12

type Entry = BlogEntry

/** Build a hub URL carrying the given state; omits defaults so the canonical URL stays clean. */
function hubHref(base: string, q: BlogQuery, patch: Partial<BlogQuery>): string {
  const next = { ...q, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.topic) params.set('topic', next.topic)
  if (next.page > 1) params.set('page', String(next.page))
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * One article card. Same shape for every article, per the brief's "consistent article cards".
 *
 * `level` is the card title's heading level. On the hub the page <h1> is the hub title and there is no
 * intervening <h2>, so the cards ARE the second level — using <h3> there skips a level. The featured card
 * sits under its own "Uitgelicht" label, and the grid under the result count, so both are <h2>.
 */
function ArticleCard({
  slug,
  blog,
  base,
  featured = false,
  level = 2,
}: {
  slug: string
  blog: BlogContent
  base: string
  featured?: boolean
  level?: 2 | 3
}) {
  const H = level === 3 ? 'h3' : 'h2'
  const href = `${base}/${slug}`
  return (
    <article className={`blogcard${featured ? ' blogcard--featured' : ''}`}>
      {/*
        The media link is `aria-hidden` + `tabIndex={-1}`: it points at the same article as the title
        link below, so exposing both would make a screen reader announce every card twice.
        The featured card is the first thing on the hub, so it loads eagerly; the grid cards are lazy.
      */}
      <LocaleLink href={href} className="blogcard-media" tabIndex={-1} aria-hidden="true">
        <Media
          src={blog.cardImage || blog.image}
          alt=""
          shape={featured ? 'wide' : 'card'}
          label="Foto"
          // `eager`, not `priority`: this index renders twice (server fallback + client filter state),
          // so a duplicated fetchpriority="high" would contradict itself. Eager still avoids the
          // lazy-load delay on the first thing a visitor sees.
          eager={featured}
          sizes={featured ? '(max-width: 860px) 100vw, 55vw' : '(max-width: 700px) 100vw, (max-width: 900px) 50vw, 33vw'}
        />
      </LocaleLink>
      <div className="blogcard-body">
        <H className="blogcard-title">
          <LocaleLink href={href}>{blog.title}</LocaleLink>
        </H>
        {blog.excerpt && <p className="blogcard-excerpt">{blog.excerpt}</p>}
        <span className="blogcard-more" aria-hidden="true">
          {blog.linkLabel || ''}
          <Icon name="arrow" size={15} />
        </span>
      </div>
    </article>
  )
}

/** The topic filter row. Each chip is a link, so the state is bookmarkable and crawlable. */
function TopicFilter({
  topics,
  counts,
  base,
  query,
  allLabel,
}: {
  topics: Topic[]
  counts: Record<string, number>
  base: string
  query: BlogQuery
  allLabel: string
}) {
  return (
    <nav className="blogfilter" aria-label={allLabel}>
      <ul className="blogfilter-list">
        <li>
          <LocaleLink
            href={hubHref(base, query, { topic: '', page: 1 })}
            className={`chip${query.topic ? '' : ' is-active'}`}
            aria-current={query.topic ? undefined : 'true'}
          >
            {allLabel}
          </LocaleLink>
        </li>
        {topics.map((topic) => {
          const n = counts[topic.id] ?? 0
          if (n === 0) return null // never render a control that returns nothing
          const active = query.topic === topic.id
          return (
            <li key={topic.id}>
              <LocaleLink
                // Clicking the active chip clears it, so a chip is a toggle without needing JS.
                href={hubHref(base, query, { topic: active ? '' : topic.id, page: 1 })}
                className={`chip${active ? ' is-active' : ''}`}
                aria-current={active ? 'true' : undefined}
              >
                {topic.label}
                <span className="chip-count" aria-hidden="true">
                  {n}
                </span>
              </LocaleLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * Numbered pagination.
 *
 * Three things the first version got wrong, all visible in the rendered strip `→ 2  1 2 [3] 4 5  4 →`:
 *
 *  1. The prev/next buttons showed the DESTINATION PAGE NUMBER next to an arrow, so "→ 2" sat beside a
 *     separate "2" button and read as a duplicate. They now say Previous / Next.
 *  2. Both arrows pointed RIGHT — the icon set only has a right arrow, so "previous" needs it mirrored.
 *  3. With many pages every number was rendered, which does not fit on a phone. Long ranges now collapse
 *     to first · … · current-1 · current · current+1 · … · last.
 *
 * Still plain `<a href>` links so each page stays a crawlable URL and it works without JavaScript.
 */
function Pagination({
  base,
  query,
  pages,
  label,
  locale,
}: {
  base: string
  query: BlogQuery
  pages: number
  label: string
  locale: string
}) {
  if (pages <= 1) return null

  /**
   * Which page numbers to show. Always the first and last, plus a window around the current page;
   * `null` marks a gap that renders as an ellipsis. With 7 or fewer pages everything fits, so no gaps.
   */
  const items: (number | null)[] = []
  if (pages <= 7) {
    for (let n = 1; n <= pages; n++) items.push(n)
  } else {
    const window = new Set([1, pages, query.page, query.page - 1, query.page + 1])
    // Keep the strip a stable width near the ends, where the window has room to spare.
    if (query.page <= 3) [2, 3, 4].forEach((n) => window.add(n))
    if (query.page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => window.add(n))
    let prev = 0
    for (let n = 1; n <= pages; n++) {
      if (!window.has(n)) continue
      if (n - prev > 1) items.push(null)
      items.push(n)
      prev = n
    }
  }

  return (
    <nav className="pager" aria-label={label}>
      <ul className="pager-list">
        <li>
          {query.page > 1 ? (
            <LocaleLink
              href={hubHref(base, query, { page: query.page - 1 })}
              className="pager-link pager-step"
              rel="prev"
            >
              {/* The icon set has one right arrow; CSS mirrors it for "previous". */}
              <Icon name="arrow" size={15} className="pager-arrow pager-arrow--prev" />
              <span>{t(locale, 'previous')}</span>
            </LocaleLink>
          ) : (
            // Kept in the DOM but disabled, so the strip does not shift when it appears.
            <span className="pager-link pager-step is-disabled" aria-hidden="true">
              <Icon name="arrow" size={15} className="pager-arrow pager-arrow--prev" />
              <span>{t(locale, 'previous')}</span>
            </span>
          )}
        </li>

        {items.map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              {n === query.page ? (
                <span className="pager-link is-active" aria-current="page">
                  {n}
                </span>
              ) : (
                <LocaleLink
                  href={hubHref(base, query, { page: n })}
                  className="pager-link"
                  aria-label={t(locale, 'goToPage').replace('{n}', String(n))}
                >
                  {n}
                </LocaleLink>
              )}
            </li>
          ),
        )}

        <li>
          {query.page < pages ? (
            <LocaleLink
              href={hubHref(base, query, { page: query.page + 1 })}
              className="pager-link pager-step"
              rel="next"
            >
              <span>{t(locale, 'next')}</span>
              <Icon name="arrow" size={15} className="pager-arrow" />
            </LocaleLink>
          ) : (
            <span className="pager-link pager-step is-disabled" aria-hidden="true">
              <span>{t(locale, 'next')}</span>
              <Icon name="arrow" size={15} className="pager-arrow" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}

export function BlogIndex({
  locale,
  blogs,
  base,
  formAction,
  query,
  searchMatched,
  filtered,
  featured,
}: {
  locale: string
  /** The full collection — used for the complete crawlable link list. */
  blogs: BlogCollection
  /** Hub path, prefix-free ("/blogs") — LocaleLink adds the language prefix. */
  base: string
  /**
   * The same hub path but ALREADY localised ("/de/blogs"), for the search form's `action`.
   * A raw <form action> bypasses LocaleLink, so without this a search on the German hub would submit
   * to the Dutch one.
   */
  formAction: string
  query: BlogQuery
  /**
   * Articles matching the SEARCH term only (topic not yet applied). Drives the chip counts, so each
   * chip shows how many results it would give within the current search.
   */
  searchMatched: Entry[]
  /** Articles matching search AND topic — what is actually listed. */
  filtered: Entry[]
  /** The featured article, shown only in the unfiltered default view. */
  featured?: Entry
}) {
  const topics = topicsFor(locale)
  /**
   * Counts come from `searchMatched` (search applied, topic NOT applied), so each chip reports how many
   * results it would yield within the current search. Counting `filtered` instead would zero every chip
   * except the active one, which makes the filter row look broken.
   */
  const counts = countTopics(locale, searchMatched.map((e) => e.blog))

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const page = Math.min(Math.max(1, query.page), pages)
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const isFiltered = !!(query.q || query.topic)

  return (
    <section className="section section-blogindex">
      <div className="container">
        {/* Featured article: only on the plain, unfiltered first page — under a filter the "featured"
            one would be arbitrary, and repeating it above its own grid entry reads as a duplicate. */}
        {featured && !isFiltered && page === 1 && (
          <div className="blogfeatured">
            <p className="blogfeatured-label">{t(locale, 'featured')}</p>
            <ArticleCard slug={featured.slug} blog={featured.blog} base={base} featured />
          </div>
        )}

        <div className="blogtools">
          {/*
            GET form: submitting navigates to ?q=… with no JavaScript involved.

            `action` must be the LOCALISED path. `base` is the prefix-free content path ("/blogs"), which
            is what LocaleLink expects — but a raw <form action> gets no such treatment, so submitting on
            /de/blogs would navigate to /blogs and drop the language. Hence `formAction`.
          */}
          <form className="blogsearch" action={formAction} method="get" role="search">
            <label className="blogsearch-label" htmlFor="blog-q">
              {t(locale, 'searchArticles')}
            </label>
            <div className="blogsearch-row">
              <input
                id="blog-q"
                className="blogsearch-input"
                type="search"
                name="q"
                defaultValue={query.q}
                placeholder={t(locale, 'searchPlaceholder')}
                autoComplete="off"
              />
              {/* Preserve the active topic across a search submit. */}
              {query.topic && <input type="hidden" name="topic" value={query.topic} />}
              <button className="btn btn-primary blogsearch-submit" type="submit">
                {t(locale, 'search')}
              </button>
            </div>
          </form>

          <TopicFilter topics={topics} counts={counts} base={base} query={query} allLabel={t(locale, 'allTopics')} />

          <div className="blogmeta">
            <p className="blogcount" role="status">
              {total === 1 ? t(locale, 'resultOne') : t(locale, 'resultMany').replace('{n}', String(total))}
              {query.q && ` · ${t(locale, 'forQuery').replace('{q}', query.q)}`}
            </p>
            {isFiltered && (
              <LocaleLink href={base} className="blogreset">
                {t(locale, 'reset')}
              </LocaleLink>
            )}
          </div>
        </div>

        {slice.length > 0 ? (
          <div className="bloggrid">
            {slice.map(({ slug, blog }) => (
              <ArticleCard key={slug} slug={slug} blog={blog} base={base} />
            ))}
          </div>
        ) : (
          <p className="blogempty">{t(locale, 'noResults')}</p>
        )}

        <Pagination base={base} query={{ ...query, page }} pages={pages} label={t(locale, 'pagination')} locale={locale} />

        {/*
          Every article as a plain link, always in the HTML.

          Paging renders a slice, so without this a crawler that ignores `?page=` would only ever see the
          first 12 of 57 articles. This list is not a duplicate of the grid — it carries no images or
          excerpts — and it guarantees each article is one hop from the hub no matter the filter state.
        */}
        <details className="bloglist">
          <summary className="bloglist-summary">{t(locale, 'allArticles').replace('{n}', String(Object.keys(blogs).length))}</summary>
          <ul className="bloglist-links">
            {Object.entries(blogs).map(([slug, blog]) => (
              <li key={slug}>
                <LocaleLink href={`${base}/${slug}`}>{blog.title}</LocaleLink>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  )
}
