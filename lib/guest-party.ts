/**
 * The guest composition an overview visitor is filtering with: adults, children, babies.
 *
 * Separated from the React control so the rules are testable without rendering anything, and so the
 * SERVER can apply the same party to the same villas that the client does. The whole filter contract on
 * this site is "every state is a real URL that works without JavaScript", and that only holds if the
 * arithmetic lives somewhere both sides can call.
 *
 * WHY BABIES DO NOT COUNT
 *
 * A 0–2 year old sleeps in a travel cot, which every villa lists as an extra rather than as one of its
 * beds — the restored checklist rows say "Campingbedjes (2)". So a baby does not consume capacity, and
 * counting one would wrongly hide a house from a family that fits in it. The cap of 2 mirrors the number
 * of cots the villas actually list.
 */

export type GuestParty = {
  /** 1–8. There is always at least one adult. */
  adults: number
  /** 2–18 year olds. Count towards capacity exactly like adults. */
  children: number
  /** Under 2s. Capped at 2, and deliberately outside the capacity sum. */
  babies: number
}

export const PARTY_LIMITS = {
  adultsMin: 1,
  adultsMax: 8,
  childrenMin: 0,
  babiesMin: 0,
  babiesMax: 2,
  /** Adults + children may not exceed this. The largest villa sleeps 8. */
  occupancyMax: 8,
} as const

export const DEFAULT_PARTY: GuestParty = { adults: 1, children: 0, babies: 0 }

/** The number a villa's capacity must cover. Babies excluded by design — see the module note. */
export function requiredCapacity(party: GuestParty): number {
  return party.adults + party.children
}

/** Whether the visitor has narrowed anything. A lone adult is the default, not a filter. */
export function isPartyFiltered(party: GuestParty): boolean {
  return (
    party.adults !== DEFAULT_PARTY.adults ||
    party.children !== DEFAULT_PARTY.children ||
    party.babies !== DEFAULT_PARTY.babies
  )
}

/**
 * Clamp a party to the rules, resolving over-capacity by trimming CHILDREN first.
 *
 * Reached from two directions: the stepper (where a disabled button should already have prevented it)
 * and a hand-edited or stale URL (where anything is possible). Both must land on a legal party rather
 * than filtering on nonsense — `?volwassenen=99` should behave like the maximum, not return nothing.
 *
 * Children give way before adults because adults are the field the visitor set first and the one with a
 * hard floor of 1; silently reducing them would look like the control fighting back.
 */
export function clampParty(party: GuestParty): GuestParty {
  const { adultsMin, adultsMax, childrenMin, babiesMin, babiesMax, occupancyMax } = PARTY_LIMITS
  const adults = clamp(party.adults, adultsMin, adultsMax)
  const babies = clamp(party.babies, babiesMin, babiesMax)
  // Children fill whatever the adults leave.
  const children = clamp(party.children, childrenMin, Math.max(childrenMin, occupancyMax - adults))
  return { adults, children, babies }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Can this field still go up without breaking a limit? Drives the `disabled` state on the + buttons. */
export function canIncrement(party: GuestParty, field: keyof GuestParty): boolean {
  const { adultsMax, babiesMax, occupancyMax } = PARTY_LIMITS
  const occupancy = requiredCapacity(party)
  if (field === 'adults') return party.adults < adultsMax && occupancy < occupancyMax
  if (field === 'children') return occupancy < occupancyMax
  return party.babies < babiesMax
}

/** Can this field still go down? Drives the `disabled` state on the − buttons. */
export function canDecrement(party: GuestParty, field: keyof GuestParty): boolean {
  const { adultsMin, childrenMin, babiesMin } = PARTY_LIMITS
  if (field === 'adults') return party.adults > adultsMin
  if (field === 'children') return party.children > childrenMin
  return party.babies > babiesMin
}

/* ------------------------------------------------------------------ URL state */

/**
 * Query parameter names. Dutch, matching the existing `?hond=` / `?plaats=` filters — these strings are
 * part of the public URL contract and are shared across both languages so a link works on either domain.
 */
export const PARTY_PARAMS = { adults: 'volwassenen', children: 'kinderen', babies: 'babies' } as const

/** Read a party out of a query string, clamping anything malformed to a legal value. */
export function partyFromParams(get: (key: string) => string | null | undefined): GuestParty {
  const num = (key: string, fallback: number) => {
    const raw = (get(key) ?? '').trim()
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }
  return clampParty({
    adults: num(PARTY_PARAMS.adults, DEFAULT_PARTY.adults),
    children: num(PARTY_PARAMS.children, DEFAULT_PARTY.children),
    babies: num(PARTY_PARAMS.babies, DEFAULT_PARTY.babies),
  })
}

/**
 * The party as query parameters, omitting anything at its default.
 *
 * Keeps the unfiltered hub URL clean, which matters because that URL is the canonical one and is what
 * the sitemap lists — `?volwassenen=1` would otherwise appear as a distinct, indexable duplicate.
 */
export function partyToParams(party: GuestParty): Record<string, string> {
  const out: Record<string, string> = {}
  if (party.adults !== DEFAULT_PARTY.adults) out[PARTY_PARAMS.adults] = String(party.adults)
  if (party.children !== DEFAULT_PARTY.children) out[PARTY_PARAMS.children] = String(party.children)
  if (party.babies !== DEFAULT_PARTY.babies) out[PARTY_PARAMS.babies] = String(party.babies)
  return out
}
