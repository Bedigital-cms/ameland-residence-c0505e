/**
 * Media — renders an uploaded image, or a clean blank placeholder when the path is empty.
 *
 * Every content model in this template keeps image fields as strings that may be "" until a
 * client uploads media via the BE Digital CMS. When empty we must NOT render a broken <img>;
 * instead we show a styled placeholder box (right aspect-ratio, subtle label) so the design
 * still reads correctly during onboarding. As soon as the CMS fills the path, the real image
 * appears — no code change.
 *
 * `shape` picks the aspect-ratio/framing used by the surrounding section so the placeholder
 * occupies exactly the same space the real image will.
 *
 * WHY THIS IS AN <img> AND NOT next/image
 *
 * `next/image` needs to FETCH the source to optimise it. Content stores `/media/<file>`, which
 * `app/media/[filename]/route.ts` 302-redirects to the CMS's media endpoint on a host that differs per
 * environment (`MEDIA_PUBLIC_BASE`: localhost in dev, `cms.bedigital.nl` in prod, R2 behind it). The
 * optimiser would therefore need `images.remotePatterns` for a host that is not known at build time,
 * and it cannot follow a redirect to an unlisted host. So `next/image` cannot be switched on from
 * inside this repo alone — it is a deployment-level decision, documented in SEO-AUDIT.md.
 *
 * What IS done here, and delivers most of the same benefit without that dependency:
 *  · `loading="lazy"` + `decoding="async"` on everything below the fold — the single biggest LCP and
 *    bandwidth win, and the brief asks for lazy loading explicitly.
 *  · `width`/`height` on every image, so the browser reserves the right box before the bytes arrive.
 *    Without them each image is a layout shift; that is the CLS half of Core Web Vitals.
 *  · `priority` for above-the-fold images (hero, featured), which must NOT be lazy — lazy-loading the
 *    LCP element actively delays it.
 *  · `sizes` so a card-sized slot does not download a 1920px file on a phone.
 *
 * `aspect` supplies the intrinsic ratio. The real pixel dimensions are not in the content model, so a
 * representative ratio per shape is used: the CSS already crops with `object-fit: cover`, so the ratio
 * only needs to be right, not the absolute numbers.
 */
type Shape = 'card' | 'wide' | 'portrait' | 'square' | 'free'

const SHAPE_CLASS: Record<Shape, string> = {
  card: 'media-ph--card',
  wide: 'media-ph--wide',
  portrait: 'media-ph--portrait',
  square: 'media-ph--square',
  free: 'media-ph--free',
}

/**
 * Intrinsic width/height per shape.
 *
 * CAREFUL — these are not cosmetic. Where the CSS sets `width: 100%` and leaves height to `auto`, the
 * browser derives the rendered HEIGHT from this ratio, so a wrong ratio visibly distorts the layout. Two
 * cases were broken by an earlier version of this table and are the reason for the note:
 *
 *  · `portrait` was 900x1200 (3:4). `.split-media img` is `width: 100%` with no height rule, so a
 *    half-width column rendered an image a third taller than it was wide — the "left image far too long"
 *    report. The split sections are landscape photos, so the ratio must be landscape too.
 *  · The footer/header logo is 250x120 in its own SVG viewBox; declaring 190x54 made it render at over
 *    twice its correct height and stretched the whole footer.
 *
 * Rule of thumb: only use a ratio here that matches how the CSS actually frames that shape. Where the CSS
 * pins the ratio itself (`aspect-ratio` + `object-fit: cover`, as on the cards), the numbers only reserve
 * space and any matching ratio is fine.
 */
const SHAPE_SIZE: Record<Shape, { width: number; height: number }> = {
  card: { width: 1200, height: 800 }, // 3:2 — .card-media / .blogcard-media pin this with aspect-ratio
  wide: { width: 1600, height: 900 }, // 16:9 — article figures, featured card
  // 4:3 landscape. NOT portrait despite the name: `.split-media img` has no height rule, so this ratio
  // decides the rendered height, and these are landscape photos of villas and the island.
  portrait: { width: 1200, height: 900 },
  square: { width: 900, height: 900 },
  free: { width: 1600, height: 1067 }, // unconstrained; a 3:2 default still beats no dimensions
}

export function Media({
  src,
  alt = '',
  shape = 'free',
  className = '',
  label = 'Afbeelding',
  priority = false,
  eager = false,
  sizes,
  width: widthOverride,
  height: heightOverride,
}: {
  src?: string | null
  alt?: string
  shape?: Shape
  className?: string
  /** Text shown inside the placeholder while no image is uploaded. */
  label?: string
  /**
   * The page's LCP image: eager AND `fetchpriority="high"`. Exactly one per page — marking several
   * defeats the point, because the browser then has no ranking to act on.
   */
  priority?: boolean
  /**
   * Above the fold but NOT the LCP element: load eagerly, without claiming high priority. Used where a
   * component may render twice (e.g. a Suspense fallback and its client replacement) and a duplicated
   * `fetchpriority="high"` would be a contradiction.
   */
  eager?: boolean
  /** Responsive hint, e.g. "(max-width: 700px) 100vw, 33vw" for a 3-column card grid. */
  sizes?: string
  /**
   * Override the shape's ratio with the image's REAL intrinsic size.
   *
   * Needed wherever the CSS uses `width: auto` instead of `width: 100%`. There the browser lays the image
   * out at the ATTRIBUTE width first and only then applies `max-width`, so an attribute much larger than
   * the real file inflates the box. The footer badge is the case that caught this: declared 900x900 from
   * the `square` shape while the PNG is 250x250 and its column is capped at 250px, which stretched the
   * footer. Pass the true size and attribute and CSS agree.
   */
  width?: number
  height?: number
}) {
  const path = (src ?? '').trim()

  if (!path) {
    return (
      <div
        className={`media-ph ${SHAPE_CLASS[shape]} ${className}`.trim()}
        role="img"
        aria-label={alt || label}
      >
        <span className="media-ph-icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </span>
        <span className="media-ph-label">{label}</span>
      </div>
    )
  }

  const shapeSize = SHAPE_SIZE[shape]
  const width = widthOverride ?? shapeSize.width
  const height = heightOverride ?? shapeSize.height

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={path}
      alt={alt}
      className={className || undefined}
      width={width}
      height={height}
      // Above the fold: eager. Below: lazy. Never lazy-load the LCP image.
      loading={priority || eager ? 'eager' : 'lazy'}
      // Only the single LCP image claims high priority.
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      sizes={sizes}
    />
  )
}
