/**
 * Reading a villa checklist line, in either of the two forms it can take.
 *
 * A line is a plain string (`"Campingbedjes (2)"`) or a structured item (`{ label, qty }`). Every
 * consumer goes through here, so no caller has to know which it got — and, more to the point, no
 * caller can accidentally interpolate an object into markup or feed one to `.replace()`.
 *
 * WHY THE QUANTITY IS RENDERED BACK INTO THE LABEL
 *
 * The old site printed the count beside the row, and the migration flattened it into the text as
 * "(N)". Restoring those 34 rows kept that inline form (see scripts/restore-villa-checklist.mts),
 * so `"Campingbedjes (2)"` is what is on the page today. `featureText()` therefore renders the
 * structured form back to exactly that string: converting an item's storage must not change a
 * visitor's page, and must not change what the structured data says either — the brief requires
 * JSON-LD to match visible content word for word.
 *
 * A presentation change (the count as a separate styled element, say) is a deliberate design
 * decision to take later. It is not something a storage migration should cause as a side effect.
 */
import type { FeatureItem } from './types'

/** The label alone, with no quantity — for matching and classification. */
export function featureLabel(item: FeatureItem): string {
  return typeof item === 'string' ? item : item.label
}

/** The quantity, when the item carries one as a real number. */
export function featureQty(item: FeatureItem): number | undefined {
  return typeof item === 'string' ? undefined : item.qty
}

/**
 * What the visitor reads: the label, plus "(N)" whenever a quantity is set.
 *
 * A count of ONE still prints. That is not an oversight — the real content contains "Fauteuil (1)",
 * "Sessel (1)", "Camping-Kinderbett (1)" and "Hochstuhl (1)", because the old site printed a quantity
 * column for every row that had one, including 1. Suppressing it would delete four visible markers the
 * moment those lines were converted to the structured form, and the brief forbids losing content.
 *
 * An item with NO `qty` renders as the bare label, which is how a tick row (no quantity at all) is
 * distinguished from a quantity row that happens to say one. `scripts/feature-item-test.mts` pins this
 * against the actual content — it is what caught the wrong rule here.
 */
export function featureText(item: FeatureItem): string {
  if (typeof item === 'string') return item
  return item.qty === undefined ? item.label : `${item.label} (${item.qty})`
}

/**
 * Every checklist line of a villa as display text, flattened across groups.
 *
 * Used by the fact extractor and the related-articles matcher, both of which want the same thing the
 * page shows — including the counts, since `roomsOnLine()` reads a trailing "(3)" as a room count.
 */
export function featureTexts(groups: { heading: string; items: FeatureItem[] }[] | undefined): string[] {
  return (groups ?? []).flatMap((g) => g.items).map(featureText)
}
