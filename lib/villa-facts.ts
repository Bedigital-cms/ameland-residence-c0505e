/**
 * Villa facts read out of a villa's OWN content — never inferred, never defaulted.
 *
 * The task document requires structured data (and any scannable card attributes) to use "verified
 * information" only, and forbids inventing data. This site's content model has no numeric fields:
 * `VillaContent` stores prose (`paragraphs`, `highlights`, `usps`) and checklist lines (`features`).
 * So every fact here is recovered by matching phrases the page itself displays, and any fact the
 * page does not state is left `undefined`.
 *
 * That produces deliberately UNEVEN results, which is the honest outcome:
 *   · "8-persoons" appears on nl/villa-zee and nl/villa-zilt but on no other Dutch page, and in
 *     German only on villa-zilt ("8 Personen"). Villa Zee's German page never states a capacity, so
 *     its German JSON-LD gets no `occupancy` — copying the number across languages would be
 *     asserting on the German page something only the Dutch page says.
 *   · Bedroom counts come from lines like "Drie 2-persoons slaapkamers"; where a villa's checklist
 *     doesn't enumerate them (the German pages mostly don't), the count is omitted.
 *
 * Consequence for the villa-overview filters the document asks for: they can only be built on the
 * facts that are actually present, which today means sauna / pets / EV charging / location — not
 * guests or bedrooms. See the audit report.
 */
import type { VillaContent } from './types'

export type Amenity = { name: string; value: true }

export type VillaFacts = {
  /** Sleeping capacity, only when the page states it ("8-persoons", "8 Personen"). */
  guests?: number
  /** Bedroom count, only when the checklist enumerates bedrooms. */
  bedrooms?: number
  /** Bathroom count, only when the checklist enumerates bathrooms. */
  bathrooms?: number
  /** True/false only when the page makes an explicit statement about pets; else undefined. */
  petsAllowed?: boolean
  /** Village named on the page (Nes, Buren, Ballum, Hollum), when stated. */
  locality?: string
  /** Facilities the page explicitly lists. */
  amenities: Amenity[]
  /** Whether the page states an EV charging point (used by the overview cards + filters). */
  evCharging: boolean
  /** Whether the page states a private sauna. */
  sauna: boolean
}

/** Dutch and German number words used in the checklist lines ("Drie 2-persoons slaapkamers"). */
const WORD_NUMBERS: Record<string, number> = {
  een: 1, één: 1, eine: 1, ein: 1,
  twee: 2, zwei: 2,
  drie: 3, drei: 3,
  vier: 4,
  vijf: 5, fünf: 5,
  zes: 6, sechs: 6,
}

/** Every human-readable string the villa page renders, as one haystack for phrase matching. */
function haystack(v: VillaContent): string {
  return [
    v.title,
    v.subtitle,
    v.cardText,
    ...(v.paragraphs ?? []),
    ...(v.moreParagraphs ?? []),
    ...(v.highlights ?? []),
    ...(v.usps ?? []).map((u) => u.label),
    ...(v.features ?? []).flatMap((g) => [g.heading, ...g.items]),
    v.seo?.title,
    v.seo?.description,
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(' \n ')
    .replace(/<[^>]+>/g, ' ')
}

/** Just the checklist lines — the structured part of the content, used for counting rooms. */
function featureLines(v: VillaContent): string[] {
  return (v.features ?? []).flatMap((g) => g.items).map((s) => s.replace(/<[^>]+>/g, ' ').trim())
}

/**
 * Sleeping capacity — only from a phrase where the number directly qualifies the ACCOMMODATION,
 * e.g. "8-persoons duinvilla", "8-persoons villa", "Ferienhaus für 8 Personen".
 *
 * This is deliberately strict, because a loose match produces false capacity claims. Verified against
 * the real content, all three of these are traps that a looser rule reads as a capacity:
 *   · "Drie 2-persoons slaapkamers" — describes each BEDROOM, not the house (would yield 2)
 *   · "8 persoons eettafel" / "6 persoons eettafel" — the DINING TABLE on the terrace
 *   · "2 persoonsbad" — the bathtub
 * Requiring an accommodation noun immediately after the number is what separates the real claim from
 * all three. Searched only in `cardText` and the SEO title/description — the fields that describe the
 * property as a whole — never in the room-by-room checklist, where every number is about one room.
 *
 * Result on today's content: only nl/villa-zee states a capacity ("Luxe 8-persoons duinvilla"). Every
 * other villa page, in both languages, gets no `occupancy` in its JSON-LD. That is the honest reading
 * — see the audit report's editorial questions for the fix (a real numeric field in the CMS).
 */
const ACCOMMODATION_NOUN = /(?:duin)?villa|vakantievilla|vakantiehuis|vakantiewoning|bungalow|woning|huis|appartement|ferienhaus|ferienwohnung|ferienvilla|haus|unterkunft/i

function findGuests(v: VillaContent): number | undefined {
  // Only whole-property descriptions, never the per-room checklist.
  const fields = [v.cardText, v.seo?.title, v.seo?.description].filter((s): s is string => !!s)
  for (const field of fields) {
    const text = field.replace(/<[^>]+>/g, ' ')
    // "8-persoons duinvilla" — number, the persons word, then an accommodation noun right after.
    const nlStyle = /(\d+)\s*[-–]?\s*persoons\s+([A-Za-zÀ-ÿ-]+)/gi
    for (const m of text.matchAll(nlStyle)) {
      if (!ACCOMMODATION_NOUN.test(m[2])) continue
      const n = Number(m[1])
      if (n >= 2 && n <= 20) return n
    }
    // "Ferienhaus für 8 Personen" / "villa voor 8 personen" — noun, preposition, number.
    const deStyle = new RegExp(`(${ACCOMMODATION_NOUN.source})[^.\\n]{0,30}?\\b(?:f(?:ü|u)r|voor)\\s+(\\d+)\\s*(?:personen|Personen|pers)`, 'gi')
    for (const m of text.matchAll(deStyle)) {
      const n = Number(m[2])
      if (n >= 2 && n <= 20) return n
    }
  }
  return undefined
}

/**
 * How many rooms one checklist line describes.
 *
 * The count must come from a quantifier that sits BEFORE the room noun ("Drie 2-persoons
 * slaapkamers" → 3, "2 slaapkamers" → 2). A number appearing after the noun counts something inside
 * the room, not the rooms themselves — "Schlafzimmer mit 2 Boxspringbetten" is ONE bedroom with two
 * beds, and reading it as 2 would overstate the property. A line with no leading quantifier is 1.
 */
function roomsOnLine(line: string, noun: RegExp): number {
  let before = line.split(noun)[0] ?? ''
  // Drop a room-SIZE qualifier first: in "Drie 2-persoons slaapkamers" the 2 is beds per room, and
  // the room count is the "Drie" in front of it. Leaving it in would return 2 instead of 3.
  before = before.replace(/\d+\s*[-–]?\s*(?:persoons|Personen|pers\.?)\s*/gi, ' ')
  // A bare leading count ("2 slaapkamers", "3 Schlafzimmer").
  const digit = before.match(/(\d+)\s*$/)?.[1]
  if (digit) return Number(digit)
  // Or a number WORD ("Drie", "drei").
  const words = before.trim().toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean)
  for (let i = words.length - 1; i >= 0; i--) {
    const n = WORD_NUMBERS[words[i]]
    if (n) return n
  }
  return 1
}

/**
 * Bedroom count from the checklist — the sum of its enumerated bedroom lines. On nl/villa-zee:
 * "Slaapkamer met 2 boxsprings…" (1) + "Drie 2-persoons slaapkamers…" (3) = 4.
 *
 * Returns undefined when no line mentions a bedroom. Note this reflects what the CONTENT lists, which
 * differs per language: the German checklists omit the upstairs bedroom lines their Dutch
 * counterparts have, so several German villas legitimately yield a lower count or none at all. That
 * gap is a content-parity issue reported in the audit, not something to paper over here — silently
 * substituting the Dutch number would put an unsourced claim on the German page.
 */
function findBedrooms(lines: string[]): number | undefined {
  const BEDROOM = /slaapkamers?|Schlafzimmer(?:n)?/i
  let total = 0
  let sawAny = false
  for (const line of lines) {
    if (!BEDROOM.test(line)) continue
    sawAny = true
    total += roomsOnLine(line, BEDROOM)
  }
  return sawAny && total > 0 ? total : undefined
}

/**
 * Bathroom count from the checklist, same rule as bedrooms.
 *
 * Counts only lines naming a BATHROOM ("Ruime luxe badkamer", "Badezimmer"). Standalone fixture lines
 * that the checklists list separately — "Douche", "Toilet", "Bad", "Dubbele wastafel" — are fixtures
 * within a bathroom, not additional bathrooms, so they are not counted. `numberOfBathroomsTotal`
 * would otherwise inflate to 5+ on pages that simply itemise the fittings.
 */
function findBathrooms(lines: string[]): number | undefined {
  const BATH = /badkamers?|Badezimmer(?:n)?/i
  let total = 0
  let sawAny = false
  for (const line of lines) {
    if (!BATH.test(line)) continue
    sawAny = true
    total += roomsOnLine(line, BATH)
  }
  return sawAny && total > 0 ? total : undefined
}

/**
 * Pet policy — only from an explicit statement, in either direction:
 *   "Honden zijn niet toegestaan" / "Haustiere sind nicht erlaubt" → false
 *   "Honden toegestaan" / "Haustiere sind erlaubt"                 → true
 * Silence stays `undefined`: absence of a pets line is not a policy.
 */
function findPets(hay: string): boolean | undefined {
  const NEG = /(honden|huisdieren|hunde|haustiere)[^.\n]{0,40}?(niet|nicht|geen|kein)/i
  const NEG2 = /(niet|nicht|geen|kein)[^.\n]{0,30}?(honden|huisdieren|hunde|haustiere)/i
  if (NEG.test(hay) || NEG2.test(hay)) return false
  const POS = /(honden|huisdieren|hunde|haustiere)\s*(zijn|sind)?\s*(wel\s*)?(toegestaan|erlaubt|welkom|willkommen)/i
  if (POS.test(hay)) return true
  return undefined
}

/** Village on Ameland named on the page. Ordered so the first genuine mention wins. */
function findLocality(hay: string): string | undefined {
  for (const village of ['Nes', 'Buren', 'Ballum', 'Hollum']) {
    // Word-boundary match so "Buren" isn't found inside other words.
    if (new RegExp(`\\b${village}\\b`).test(hay)) return village
  }
  return undefined
}

/**
 * Facilities, each gated on a phrase the page actually shows. The `name` is the schema.org-facing
 * English label; the detection patterns cover both languages.
 */
const AMENITY_RULES: { name: string; re: RegExp }[] = [
  { name: 'Sauna', re: /\bsauna\b/i },
  { name: 'Solarium', re: /\bsolarium\b/i },
  { name: 'Hot tub', re: /whirlpool|jacuzzi/i },
  { name: 'Fireplace', re: /gashaard|sfeerhaard|haard|kamin/i },
  { name: 'Underfloor heating', re: /vloerverwarming|fußbodenheizung|fussbodenheizung/i },
  { name: 'WiFi', re: /\bwifi\b|w-lan|wlan/i },
  { name: 'Dishwasher', re: /vaatwasser|geschirrspüler|geschirrspuler/i },
  { name: 'Washing machine', re: /wasmachine|waschmaschine/i },
  { name: 'Tumble dryer', re: /droogtrommel|wasdroger|trockner/i },
  { name: 'Television', re: /smart ?tv|\btv\b|fernseher/i },
  { name: 'Garden', re: /\btuin\b|\bgarten\b/i },
  { name: 'Terrace', re: /terras|terrasse/i },
  { name: 'Barbecue', re: /\bbbq\b|barbecue|grill/i },
  { name: 'Bathtub', re: /ligbad|\bbad\b|badewanne/i },
  { name: 'Parking', re: /parkeer|parkplatz|parkeergelegenheid/i },
  { name: 'EV charging station', re: /laadpaal|laadstation|ladestation|laadpunt/i },
  { name: 'Baby cot', re: /campingbed|kinderbed|reisebett|kinderbett/i },
  { name: 'High chair', re: /kinderstoel|hochstuhl/i },
]

/** Read every fact this villa's own content states. Anything unstated is omitted. */
export function villaFacts(v: VillaContent): VillaFacts {
  const hay = haystack(v)
  const lines = featureLines(v)

  const amenities: Amenity[] = AMENITY_RULES.filter((r) => r.re.test(hay)).map((r) => ({ name: r.name, value: true as const }))

  return {
    guests: findGuests(v),
    bedrooms: findBedrooms(lines),
    bathrooms: findBathrooms(lines),
    petsAllowed: findPets(hay),
    locality: findLocality(hay),
    amenities,
    evCharging: amenities.some((a) => a.name === 'EV charging station'),
    sauna: amenities.some((a) => a.name === 'Sauna'),
  }
}
