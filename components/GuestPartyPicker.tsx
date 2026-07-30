import {
  canDecrement,
  canIncrement,
  requiredCapacity,
  PARTY_LIMITS,
  type GuestParty,
} from '@/lib/guest-party'
import { t, type UiKey } from '@/lib/ui-text'

import { LocaleLink } from './LocaleLink'

/**
 * Adults / children / babies stepper on the villa overview.
 *
 * EVERY CONTROL IS A LINK, NOT A BUTTON. Same contract as the filter chips: each step is an ordinary
 * `<a href>` carrying the resulting party in the query string, so the whole stepper works with
 * JavaScript disabled and every composition is a real, bookmarkable URL. With JS on, Next intercepts
 * the navigation and the grid updates without a page load.
 *
 * A `<button>` would have been less code and would have broken both of those.
 *
 * At a limit the control renders as a `<span aria-disabled>` rather than a link — there is no href that
 * would do anything, and a link to the current URL announces as actionable while doing nothing. Keyboard
 * users tab straight past it, which is the correct behaviour for a control that has no effect.
 */
const FIELDS: { key: keyof GuestParty; labelKey: UiKey; hintKey: UiKey }[] = [
  { key: 'adults', labelKey: 'partyAdults', hintKey: 'partyAdultsAge' },
  { key: 'children', labelKey: 'partyChildren', hintKey: 'partyChildrenAge' },
  { key: 'babies', labelKey: 'partyBabies', hintKey: 'partyBabiesAge' },
]

export function GuestPartyPicker({
  locale,
  party,
  hrefForParty,
}: {
  locale: string
  party: GuestParty
  /** URL for a modified party — supplied by the caller so it can merge the other active filters. */
  hrefForParty: (next: GuestParty) => string
}) {
  const occupancy = requiredCapacity(party)
  const atMax = occupancy >= PARTY_LIMITS.occupancyMax

  return (
    <div className="guestparty">
      <span className="guestparty-label" id="guestparty-label">
        {t(locale, 'partyTitle')}
      </span>

      <ul className="guestparty-fields" aria-labelledby="guestparty-label">
        {FIELDS.map(({ key, labelKey, hintKey }) => {
          const value = party[key]
          const canUp = canIncrement(party, key)
          const canDown = canDecrement(party, key)
          const name = t(locale, labelKey)

          return (
            <li className="guestparty-field" key={key}>
              <span className="guestparty-name">
                {name}
                <small>{t(locale, hintKey)}</small>
              </span>

              <span className="guestparty-stepper">
                <Step
                  enabled={canDown}
                  href={hrefForParty({ ...party, [key]: value - 1 })}
                  /* The accessible name says WHAT changes, since "−" alone is meaningless out of
                     context and a screen reader user may hit the button without its label nearby. */
                  label={t(locale, 'partyDecrease').replace('{field}', name)}
                  glyph="−"
                />
                {/* aria-live so the new count is announced after a step; the number is the only thing
                    that changes, and without this the stepper is silent to a screen reader. */}
                <output className="guestparty-value" aria-live="polite">
                  {value}
                </output>
                <Step
                  enabled={canUp}
                  href={hrefForParty({ ...party, [key]: value + 1 })}
                  label={t(locale, 'partyIncrease').replace('{field}', name)}
                  glyph="+"
                />
              </span>
            </li>
          )
        })}
      </ul>

      {/* Explains why the + buttons stopped responding. Without it, a disabled control at the moment of
          reaching 8 looks broken rather than deliberate. */}
      {atMax && (
        <p className="guestparty-note" role="status">
          {t(locale, 'partyMaxReached').replace('{n}', String(PARTY_LIMITS.occupancyMax))}
        </p>
      )}
    </div>
  )
}

/** One +/− control: a link when it would change something, an inert span when it would not. */
function Step({
  enabled,
  href,
  label,
  glyph,
}: {
  enabled: boolean
  href: string
  label: string
  glyph: string
}) {
  if (!enabled) {
    return (
      <span className="guestparty-step is-disabled" aria-disabled="true" aria-label={label}>
        <span aria-hidden="true">{glyph}</span>
      </span>
    )
  }
  return (
    <LocaleLink href={href} className="guestparty-step" aria-label={label} scroll={false}>
      <span aria-hidden="true">{glyph}</span>
    </LocaleLink>
  )
}
