/**
 * Interface strings the TEMPLATE itself needs, per language.
 *
 * These are not editorial content — they are accessibility labels and interface words that markup
 * requires but no content field supplies (a breadcrumb nav needs an accessible name; a landmark needs
 * a label). Editorial copy stays in `content/<locale>/*.json` and is never duplicated here.
 *
 * Kept deliberately tiny. Anything a visitor reads as page CONTENT belongs in the CMS, not in code —
 * if a string here starts growing into a sentence, it is content and should move.
 *
 * Falls back to the default locale's string, then to the key's Dutch value, so a newly activated
 * language never renders an empty label.
 */
const UI = {
  nl: {
    breadcrumb: 'Kruimelpad',
    readMore: 'Lees meer',
    readLess: 'Lees minder',
    goodToKnow: 'Goed om te weten',
    checkAvailability: 'Bekijk beschikbaarheid',
    ourVillas: "Onze villa's",
    moreInfo: 'Meer informatie',
  },
  de: {
    breadcrumb: 'Brotkrümelnavigation',
    readMore: 'Mehr lesen',
    readLess: 'Weniger lesen',
    goodToKnow: 'Gut zu wissen',
    checkAvailability: 'Verfügbarkeit ansehen',
    ourVillas: 'Unsere Ferienhäuser',
    moreInfo: 'Mehr Informationen',
  },
} as const

export type UiKey = keyof (typeof UI)['nl']

/** An interface string for a locale, falling back to Dutch when the language has no entry yet. */
export function t(locale: string, key: UiKey): string {
  const table = (UI as Record<string, Partial<Record<UiKey, string>>>)[locale]
  return table?.[key] ?? UI.nl[key]
}
