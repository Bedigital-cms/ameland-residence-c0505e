import { t } from '@/lib/ui-text'
import type { VillaFacts } from '@/lib/villa-facts'
import type { VillaAttributes } from '@/lib/villa-filter'

import { Icon } from './icons'

/**
 * The at-a-glance facts strip near the top of a villa page.
 *
 * The task document asks for "key features displayed near the top" and "scannable facilities". Without
 * it a visitor has to read three paragraphs and a 28-item checklist to learn how many bedrooms a house
 * has.
 *
 * TWO SOURCES, deliberately. The numbers come from `numbers` (`villaAttributes` — the villa's numeric
 * content fields, falling back to the prose parse); everything else from `facts` (`villaFacts`, which
 * reports only what the page states verbatim). Reading the numbers from `facts` too is what previously
 * left nine of ten villas with no guest tile, because capacity was stated in prose on exactly one page.
 *
 * A tile is still omitted rather than guessed: a wrong occupancy on an accommodation page is worse than
 * a missing one.
 *
 * Pets are the one tri-state: shown as allowed OR not allowed when the page says so, hidden when silent.
 */
export function VillaKeyFacts({
  locale,
  facts,
  numbers,
}: {
  locale: string
  facts: VillaFacts
  numbers: VillaAttributes
}) {
  type Tile = { icon: string; label: string; value: string }
  const tiles: Tile[] = []

  if (numbers.guests) tiles.push({ icon: 'users', label: t(locale, 'guests'), value: String(numbers.guests) })
  if (numbers.bedrooms) tiles.push({ icon: 'bed', label: t(locale, 'bedrooms'), value: String(numbers.bedrooms) })
  if (numbers.bathrooms) tiles.push({ icon: 'bath', label: t(locale, 'bathrooms'), value: String(numbers.bathrooms) })
  if (facts.sauna) tiles.push({ icon: 'sauna', label: t(locale, 'sauna'), value: t(locale, 'yes') })
  if (facts.petsAllowed !== undefined) {
    tiles.push({
      icon: 'paw',
      label: t(locale, 'pets'),
      value: facts.petsAllowed ? t(locale, 'yes') : t(locale, 'no'),
    })
  }
  if (facts.evCharging) tiles.push({ icon: 'plug', label: t(locale, 'evCharging'), value: t(locale, 'yes') })
  if (facts.locality) tiles.push({ icon: 'pin', label: t(locale, 'location'), value: facts.locality })

  // Fewer than two facts is not a strip worth showing — the checklist below covers it.
  if (tiles.length < 2) return null

  return (
    <section className="section-keyfacts" aria-label={t(locale, 'keyFacts')}>
      <div className="container">
        <dl className="keyfacts">
          {tiles.map((tile) => (
            <div className="keyfact" key={tile.label}>
              <Icon name={tile.icon} size={22} />
              <div className="keyfact-text">
                <dt className="keyfact-label">{tile.label}</dt>
                <dd className="keyfact-value">{tile.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
