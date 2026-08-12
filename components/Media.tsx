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
 */
type Shape = 'card' | 'wide' | 'portrait' | 'square' | 'free'

const SHAPE_CLASS: Record<Shape, string> = {
  card: 'media-ph--card',
  wide: 'media-ph--wide',
  portrait: 'media-ph--portrait',
  square: 'media-ph--square',
  free: 'media-ph--free',
}

export function Media({
  src,
  alt = '',
  shape = 'free',
  className = '',
  label = 'Afbeelding',
}: {
  src?: string | null
  alt?: string
  shape?: Shape
  className?: string
  /** Text shown inside the placeholder while no image is uploaded. */
  label?: string
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={path} alt={alt} className={className || undefined} />
  )
}
