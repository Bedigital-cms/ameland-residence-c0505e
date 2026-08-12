/**
 * Availability for the search bar, straight from Tommy.
 *
 * The Tommy booking widget renders its own calendar, but only inside its own UI — the search bar on
 * the homepage and the filter on `/last-minutes` are ours, so they need the raw data. Tommy exposes
 * it on the same endpoint the widget itself uses:
 *
 *   GET /kalender/?accommodatie=<id>&aantal-kalenders=<n>&datum=<MM-YYYY>
 *   Authentication: <account>:<apikey>
 *
 * `datum` really is month-precision: the server prefixes "01-", so "08-2026" is the only shape it
 * parses (a full "2026-08-01" makes it build "01-2026-08-01" and fail).
 *
 * One call covers ONE accommodation, so a whole-site calendar is one request per villa, merged
 * here. Each villa's id is its `tommyId` in villas.json, which is what lets a selected period be
 * filtered back down to the villas that can actually take it.
 */

/** A day Tommy will accept as the START of a stay for a given accommodation. */
export type VillaAvailability = {
  /** villas.json `tommyId`. */
  tommyId: string
  /** Party sizes this accommodation takes, straight from Tommy (`minPersonen`/`maxPersonen`).
   *  0 = Tommy did not say, which is treated as "no limit" rather than "cannot be booked". */
  minPersons: number
  maxPersons: number
  /** "YYYY-MM-DD" arrival days, ascending. */
  arrivals: string[]
  /** "YYYY-MM-DD" departure days, ascending. */
  departures: string[]
}

export type Availability = {
  /** Per accommodation, so a picked period can be matched back to villas. */
  villas: VillaAvailability[]
  /** Union of every villa's arrival days — what the calendar paints green. */
  arrivals: string[]
  /** Union of every villa's departure days. */
  departures: string[]
  /** First month covered, "YYYY-MM" — the calendar opens here. */
  fromMonth: string
  /** Largest party any villa takes; the "Samenstelling" dropdown runs up to this. */
  maxPersons: number
  /**
   * Tommy's id for the "Volwassenen (18+ jr)" person category.
   *
   * The booking widget counts people per category, not as one number, and it reads the counts from
   * the PAGE query string as `persoonscategorie[<id>]=<n>`. Handing a party size to the widget
   * therefore means knowing this id; it is per account, so it is read from Tommy rather than fixed
   * in code. 0 when the account could not be read — the prefill is then simply left off.
   */
  adultCategoryId: number
  /** True when the upstream call failed; the UI then falls back to a plain (unrestricted) picker. */
  degraded: boolean
}

const API = 'https://api.tommybookingsupport.com'

/**
 * How many months of calendar to pull.
 *
 * `aantal-kalenders` is honoured up to 9; ask for 10 or more and the endpoint quietly ignores it and
 * returns 2 months instead of erroring, so this must stay at the cap rather than "a big number".
 */
const MONTHS = 9

type TommyDay = {
  inMonth: boolean
  date: string
  /** The accommodation is sellable at all on this date (false = outside the season). */
  beschikbaar: boolean
  /** Already booked. */
  bezet: boolean
  /** Tommy's arrival/changeover rules allow a stay to start here. */
  aankomstdag: boolean
  /** ...and to end here. */
  vertrekdag: boolean
  /** In the past — never selectable. */
  verleden: boolean
  /** Whether the NIGHT AFTER is sold. Not part of the arrival/departure rule — a stay may end on a
   *  day the next guest arrives — but Tommy sends it, so it is typed. */
  volgendeBezet: boolean
  /** Whether the night BEFORE is sold. This is what tells an arrival changeover from a departure. */
  vorigeBezet: boolean
}

type TommyCalendar = { weeks: Record<string, TommyDay>[] }
type TommyResponse = { data?: { kalenders?: TommyCalendar[] } }

/** "2026-08-01" → "08-2026", the only `datum` shape the endpoint parses. */
function monthParam(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`
}

/*
 * Whether a day can start or end a stay.
 *
 * Transcribed from the widget itself rather than guessed: it derives per-day classes and then
 * refuses a selection whose endpoints carry the wrong ones (`setKalender` + `selectieDagen`).
 *
 *   free            = beschikbaar && !(bezet && vorigeBezet)   // both sides sold = unusable
 *   "beschikbaar"   = free && (aankomstdag || vertrekdag)
 *   "aankomstdag"   = free && aankomstdag && !vertrekdag       // arrival-ONLY day
 *   "vertrekdag"    = free && vertrekdag && !aankomstdag       // departure-ONLY day
 *   "vertrekdag-bezet" = vorigeBezet && !bezet                 // someone checks out that morning
 *   "aankomstdag-bezet" = !vorigeBezet && bezet                // someone checks in that afternoon
 *
 * An arrival is then refused on a departure-only day or on a check-out day; a departure is refused
 * on an arrival-only day or on a check-in day. Note what this permits: a changeover day is both,
 * so a stay may END on a day whose afternoon is already sold to the next guest — 21-08 → 28-08 on
 * Villa Zilt is exactly that, and any stricter rule (`!bezet`, `!volgendeBezet`) would drop it.
 */
type DayClasses = { available: boolean; arrivalOnly: boolean; departureOnly: boolean; checkOut: boolean; checkIn: boolean }

function classify(d: TommyDay): DayClasses {
  const free = d.beschikbaar && !(d.bezet && d.vorigeBezet)
  return {
    available: free && (d.aankomstdag || d.vertrekdag),
    arrivalOnly: free && d.aankomstdag && !d.vertrekdag,
    departureOnly: free && d.vertrekdag && !d.aankomstdag,
    checkOut: d.vorigeBezet && !d.bezet,
    checkIn: !d.vorigeBezet && d.bezet,
  }
}

/** Days in an adjacent month come along for the grid; only the month's own days are authoritative. */
function inScope(d: TommyDay): boolean {
  return d.inMonth && !d.verleden
}

function isArrival(d: TommyDay): boolean {
  if (!inScope(d)) return false
  const c = classify(d)
  return c.available && !c.departureOnly && !c.checkIn
}

function isDeparture(d: TommyDay): boolean {
  if (!inScope(d)) return false
  const c = classify(d)
  return c.available && !c.arrivalOnly && !c.checkOut
}

async function fetchVilla(tommyId: string, account: string, apiKey: string, from: Date): Promise<VillaAvailability | null> {
  const qs = new URLSearchParams({
    accommodatie: tommyId,
    'aantal-kalenders': String(MONTHS),
    datum: monthParam(from),
  })
  try {
    const res = await fetch(`${API}/kalender/?${qs}`, {
      headers: { Authentication: `${account}:${apiKey}` },
      // Availability moves as bookings come in, but not by the second; a short revalidate keeps the
      // statically rendered pages honest without hitting Tommy on every request.
      next: { revalidate: 900 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as TommyResponse
    const arrivals: string[] = []
    const departures: string[] = []
    for (const cal of json.data?.kalenders ?? []) {
      for (const week of cal.weeks ?? []) {
        for (const day of Object.values(week)) {
          if (isArrival(day)) arrivals.push(day.date)
          if (isDeparture(day)) departures.push(day.date)
        }
      }
    }
    arrivals.sort()
    departures.sort()
    return { tommyId, arrivals, departures, minPersons: 0, maxPersons: 0 }
  } catch {
    return null
  }
}

/**
 * Availability for every villa that has a `tommyId`, in one pass.
 *
 * Never throws and never returns nothing: if Tommy is unreachable the result is `degraded`, and the
 * picker then simply stops restricting dates instead of leaving the page without a search bar.
 */
type TommyAccommodation = { id: number; minPersonen?: number; maxPersonen?: number }

/**
 * The id of the adult person category for this account.
 *
 * Categories are configured per Tommy account, so the id cannot be hard-coded. The widget's own
 * bootstrap endpoint lists them in display order with the adults first, which is also the only one
 * with a non-zero default — that is what identifies it.
 */
async function fetchAdultCategory(account: string, apiKey: string): Promise<number> {
  try {
    const res = await fetch(`${API}/widget/boeken`, {
      headers: { Authentication: `${account}:${apiKey}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return 0
    const json = (await res.json()) as { variables?: { persoonscategorien?: { id: number; standaard?: number }[] } }
    const cats = json.variables?.persoonscategorien ?? []
    return cats.find((c) => (c.standaard ?? 0) > 0)?.id ?? cats[0]?.id ?? 0
  } catch {
    return 0
  }
}

/**
 * Party size per accommodation. One request covers the whole account, so this is a single extra
 * call rather than one per villa. Failure is not fatal: without it every villa simply has no
 * declared limit and the party-size filter stops narrowing instead of emptying the page.
 */
async function fetchCapacity(account: string, apiKey: string): Promise<Map<string, { min: number; max: number }>> {
  const out = new Map<string, { min: number; max: number }>()
  try {
    const res = await fetch(`${API}/accommodatie`, {
      headers: { Authentication: `${account}:${apiKey}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return out
    const json = (await res.json()) as { data?: TommyAccommodation[] }
    for (const a of json.data ?? []) {
      out.set(String(a.id), { min: a.minPersonen || 0, max: a.maxPersonen || 0 })
    }
  } catch {
    // fall through to the empty map
  }
  return out
}

export async function getAvailability(tommyIds: string[]): Promise<Availability> {
  const account = process.env.NEXT_PUBLIC_TOMMY_ACCOUNT || ''
  const apiKey = process.env.NEXT_PUBLIC_TOMMY_APIKEY || ''
  const from = new Date()
  const fromMonth = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}`
  const ids = tommyIds.filter(Boolean)

  const empty: Availability = {
    villas: [], arrivals: [], departures: [], fromMonth, maxPersons: 0, adultCategoryId: 0, degraded: true,
  }
  if (!account || !apiKey || ids.length === 0) return empty

  const [fetched, capacity, adultCategoryId] = await Promise.all([
    Promise.all(ids.map((id) => fetchVilla(id, account, apiKey, from))),
    fetchCapacity(account, apiKey),
    fetchAdultCategory(account, apiKey),
  ])
  const results = fetched
    .filter((r): r is VillaAvailability => r !== null)
    .map((r) => {
      const cap = capacity.get(r.tommyId)
      return cap ? { ...r, minPersons: cap.min, maxPersons: cap.max } : r
    })
  if (results.length === 0) return empty

  const union = (pick: (v: VillaAvailability) => string[]) =>
    [...new Set(results.flatMap(pick))].sort()

  return {
    villas: results,
    arrivals: union((v) => v.arrivals),
    departures: union((v) => v.departures),
    fromMonth,
    // 8 is the house default: without Tommy's numbers the dropdown still has to offer something.
    maxPersons: Math.max(8, ...results.map((v) => v.maxPersons)),
    adultCategoryId,
    degraded: false,
  }
}

/* --------------------------------------------------------------- zoek & boek range */

/**
 * The `range` query parameter the Zoek & boek results page is addressed by:
 *
 *   /zoek-boek?range=21-08-2026 - 28-08-2026
 *
 * Dates are DD-MM-YYYY separated by " - ", matching the URL the booking flow has always produced,
 * so existing links (and anything a guest bookmarked) keep working.
 */
export type DateRange = { arrival: string; departure: string }

/** "YYYY-MM-DD" → "DD-MM-YYYY". */
export function toDutchDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/** "DD-MM-YYYY" → "YYYY-MM-DD", or "" when it is not a date at all. */
export function fromDutchDate(value: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** Build the query value for a picked period. */
export function formatRange(arrival: string, departure: string): string {
  return `${toDutchDate(arrival)} - ${toDutchDate(departure)}`
}

/**
 * Read `?range=` back into ISO dates. Returns null for anything malformed — a hand-edited or
 * truncated URL then renders the unfiltered page rather than a crash or an empty result set.
 */
export function parseRange(value: string | undefined): DateRange | null {
  if (!value) return null
  const [from, to] = value.split(/\s*-\s*(?=\d{2}-\d{2}-\d{4})/)
  const arrival = fromDutchDate(from || '')
  const departure = fromDutchDate(to || '')
  if (!arrival || !departure || departure <= arrival) return null
  return { arrival, departure }
}

/** Shift an ISO date by whole days, e.g. the "1 week eerder / later" suggestions. */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/**
 * The villas that can take the whole period: Tommy must offer the arrival day AND the departure day
 * for that accommodation. Used by both the results page and the last-minute filter, so the two can
 * never disagree about what "available" means.
 */
export function villasForRange(availability: Availability, range: DateRange, persons = 0): string[] {
  return availability.villas
    .filter((v) => v.arrivals.includes(range.arrival) && v.departures.includes(range.departure))
    .filter((v) => fitsParty(v, persons))
    .map((v) => v.tommyId)
}

/** Whether a party fits. A missing limit means Tommy did not declare one, so it never excludes. */
export function fitsParty(villa: VillaAvailability, persons: number): boolean {
  if (!persons) return true
  if (villa.maxPersons && persons > villa.maxPersons) return false
  if (villa.minPersons && persons < villa.minPersons) return false
  return true
}

/** The villas a party fits in, ignoring dates — the party filter on its own. */
export function villasForParty(availability: Availability, persons: number): string[] {
  return availability.villas.filter((v) => fitsParty(v, persons)).map((v) => v.tommyId)
}
