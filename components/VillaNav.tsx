import { t } from '@/lib/ui-text'

/**
 * In-page anchor navigation for a villa detail page.
 *
 * The task document asks for "anchor links to page sections". A villa page is long — intro, key facts,
 * gallery, room-by-room checklist, feature sections, FAQ, booking — and today the only way to reach the
 * booking widget is to scroll past all of it.
 *
 * The ids are defined HERE, in one place, and the same list drives both this nav and the `id` attributes
 * on the sections (see `VILLA_SECTIONS` below and its use in `VillaPage`). Defining them in two places is
 * how anchor navigation rots: a renamed section silently leaves a link pointing at nothing.
 *
 * Only sections that actually exist on THIS villa get a link — the bungalow has no `extraSections`, so it
 * gets no "features" entry rather than a dead anchor.
 */

/** Section ids used as anchor targets. Stable — they appear in URLs people may bookmark or share. */
export const VILLA_SECTIONS = {
  about: 'over-deze-villa',
  gallery: 'fotos',
  layout: 'indeling',
  features: 'voorzieningen',
  faq: 'faq',
  booking: 'boeken',
} as const

export type VillaSectionId = (typeof VILLA_SECTIONS)[keyof typeof VILLA_SECTIONS]

/** Which anchors to show, in page order, with their labels. */
export type VillaNavItem = { id: VillaSectionId; label: string }

export function villaNavItems(
  locale: string,
  present: { gallery: boolean; layout: boolean; features: boolean; faq: boolean; booking: boolean },
): VillaNavItem[] {
  const items: VillaNavItem[] = [{ id: VILLA_SECTIONS.about, label: t(locale, 'navAbout') }]
  if (present.gallery) items.push({ id: VILLA_SECTIONS.gallery, label: t(locale, 'navPhotos') })
  if (present.layout) items.push({ id: VILLA_SECTIONS.layout, label: t(locale, 'navLayout') })
  if (present.features) items.push({ id: VILLA_SECTIONS.features, label: t(locale, 'navFeatures') })
  if (present.faq) items.push({ id: VILLA_SECTIONS.faq, label: t(locale, 'navFaq') })
  if (present.booking) items.push({ id: VILLA_SECTIONS.booking, label: t(locale, 'navBooking') })
  return items
}

/**
 * Sticky anchor bar.
 *
 * Plain in-page `<a href="#id">` links — no JavaScript, no scroll hijacking. The browser's own
 * `:target` handling and `scroll-margin-top` (set in CSS, so the sticky header does not cover the
 * heading) do the work. Fewer than three destinations is not worth a nav bar.
 */
export function VillaNav({ locale, items }: { locale: string; items: VillaNavItem[] }) {
  if (items.length < 3) return null
  return (
    <nav className="villanav" aria-label={t(locale, 'navOnThisPage')}>
      <div className="container villanav-inner">
        <ul className="villanav-list">
          {items.map((item) => (
            <li key={item.id}>
              <a className="villanav-link" href={`#${item.id}`}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
