import type { Crumb } from '@/content/breadcrumbs'

import { LocaleLink } from './LocaleLink'

/**
 * Visible breadcrumb trail — the on-page counterpart of the `BreadcrumbList` JSON-LD (both are built
 * from the same `Crumb[]`, see `content/breadcrumbs.ts`).
 *
 * Markup notes:
 *  · <nav aria-label> + <ol> gives assistive tech the trail semantics for free; the ordered list is
 *    what conveys hierarchy, so it stays a real list rather than styled <div>s.
 *  · The separator is a decorative <span aria-hidden> — a screen reader announcing "greater-than"
 *    between every crumb is noise.
 *  · The current page is the last crumb and is NOT a link: it carries `aria-current="page"` and
 *    renders as plain text, so keyboard users don't tab to a link that goes nowhere.
 *  · `variant="onImage"` is used inside a hero (light text on the dark gradient); the default is for
 *    breadcrumbs on a normal light background.
 *
 * Renders nothing for a trail of fewer than two crumbs — a lone "Home" is not a trail.
 */
export function Breadcrumb({
  trail,
  label,
  variant = 'default',
}: {
  trail: Crumb[]
  /** Accessible name for the nav landmark, in the page's language. */
  label: string
  variant?: 'default' | 'onImage'
}) {
  if (trail.length < 2) return null
  const last = trail.length - 1

  return (
    <nav className={`crumbs${variant === 'onImage' ? ' crumbs--on-image' : ''}`} aria-label={label}>
      <ol className="crumbs-list">
        {trail.map((c, i) => (
          <li key={`${c.path}-${i}`} className="crumbs-item">
            {i === last ? (
              <span className="crumbs-current" aria-current="page">
                {c.name}
              </span>
            ) : (
              <>
                <LocaleLink href={c.path} className="crumbs-link">
                  {c.name}
                </LocaleLink>
                <span className="crumbs-sep" aria-hidden="true">
                  /
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
