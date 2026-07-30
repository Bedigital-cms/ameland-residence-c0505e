import type { RelatedArticle } from '@/lib/related'
import { t } from '@/lib/ui-text'

import { Icon } from './icons'
import { LocaleLink } from './LocaleLink'
import { Media } from './Media'

/**
 * "Read more about the island" — articles related to this villa.
 *
 * Closes the one real gap the link audit found: articles already linked to villas (57/57 and 25/25 via
 * the villa grid at the foot of every article), but no villa linked to any article (0/5 in both
 * languages). Someone reading about a specific house had no route into the 57 island articles.
 *
 * Relevance is derived from shared, discriminating topics between the villa's own text and each article
 * — see `lib/related.ts`. Nothing is hand-paired, and a villa with no genuine overlap renders no section
 * rather than an arbitrary "related" list.
 *
 * Anchor text is the article title, which is descriptive by nature — the brief asks for descriptive
 * anchor text and standard `<a href>` links, so these are plain links, not JS-driven cards.
 */
export function RelatedArticles({
  locale,
  items,
  blogBase,
}: {
  locale: string
  items: RelatedArticle[]
  /** Prefix-free hub path ("/blogs"); LocaleLink adds the language prefix. */
  blogBase: string
}) {
  if (items.length === 0) return null

  return (
    <section className="section section-related">
      <div className="container">
        <h2 className="related-title">{t(locale, 'relatedArticles')}</h2>
        <ul className="relatedgrid">
          {items.map(({ slug, blog }) => (
            <li key={slug}>
              <article className="relatedcard">
                <LocaleLink href={`${blogBase}/${slug}`} className="relatedcard-media" tabIndex={-1} aria-hidden="true">
                  <Media
                    src={blog.cardImage || blog.image}
                    alt=""
                    shape="card"
                    label="Foto"
                    sizes="(max-width: 700px) 100vw, 33vw"
                  />
                </LocaleLink>
                <div className="relatedcard-body">
                  {/* h3: sits under the page h1 and this section's h2. */}
                  <h3 className="relatedcard-title">
                    <LocaleLink href={`${blogBase}/${slug}`}>{blog.title}</LocaleLink>
                  </h3>
                  {blog.excerpt && <p className="relatedcard-excerpt">{blog.excerpt}</p>}
                  <span className="relatedcard-more" aria-hidden="true">
                    {t(locale, 'readArticle')}
                    <Icon name="arrow" size={14} />
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
