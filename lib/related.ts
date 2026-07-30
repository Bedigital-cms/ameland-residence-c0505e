/**
 * Related-content links: which articles genuinely relate to which villa, and vice versa.
 *
 * The task document asks for connections between blogs and relevant villas, dog-friendly content and
 * pet-friendly accommodation, family content and larger villas, and travel content and practical pages.
 * The link audit measured what already exists:
 *
 *     NL  blogs -> a villa: 57/57      villas -> a blog: 0/5
 *     DE  blogs -> a villa: 25/25      villas -> a blog: 0/5
 *
 * So the articles already point at the villas (the villa grid at the foot of every article). The missing
 * direction is villa -> article, which is also the more useful one: someone reading about a specific house
 * gets no route into the 57 articles about the island.
 *
 * HOW RELEVANCE IS DECIDED — measured, not asserted.
 *
 * Both sides are classified with the SAME topic vocabulary already used by the blog filters
 * (`lib/blog-topics.ts`), applied to each villa's own visible text. An article is related to a villa when
 * they share a topic. That means the pairing is derived from what the pages actually say:
 *
 *   · the bungalow states "Haustiere sind erlaubt" -> matches the `hond` topic -> dog articles
 *   · every villa states a sauna -> matches `sauna` -> the sauna articles
 *   · a villa near Nes mentions the beach and dunes -> `strand` / `natuur` articles
 *
 * Nothing is hand-paired and no relationship is invented. Where a villa shares no topic with any article
 * the list comes back empty and no section renders, rather than showing arbitrary "related" content.
 */
import { topicsFor, topicsOf } from './blog-topics'
import { featureLabel } from './features'
import type { BlogCollection, BlogContent, VillaContent } from './types'
import { villaFacts } from './villa-facts'

/**
 * The text a villa states about itself.
 *
 * Tags are stripped BEFORE matching, not after. The villa prose contains links like
 * `<a href="/algemene-voorwaarden-zilt-stern-zee-en-nova">` — and `voorwaarden` contains the letters
 * that made a naive `hond`-ish pattern fire, which is how a villa that forbids dogs ended up matched to
 * dog articles. Matching only the visible words removes that whole class of false positive.
 */
function villaText(villa: VillaContent): string {
  return [
    villa.title,
    villa.subtitle,
    villa.cardText,
    ...(villa.paragraphs ?? []),
    ...(villa.moreParagraphs ?? []),
    ...(villa.highlights ?? []),
    ...(villa.usps ?? []).map((u) => u.label),
    // Labels without their counts: a quantity never carries topic meaning, and "(2)" is noise here.
    ...(villa.features ?? []).flatMap((g) => [g.heading, ...g.items.map(featureLabel)]),
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    // Drop the whole <a> element including its href, then any remaining tag, keeping the link TEXT.
    .map((s) => s.replace(/<a\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .join(' \n ')
}

/**
 * Topic ids this villa's own text supports.
 *
 * The `hond` topic is special-cased on POLARITY. Four of the five villas say "Honden zijn niet
 * toegestaan" / "Haustiere sind nicht erlaubt" — the word "hond" is present, so a plain keyword match
 * classifies them as dog-relevant and then recommends dog articles on a page that forbids dogs. That is
 * worse than no recommendation. `villaFacts.petsAllowed` already reads the policy in both directions, so
 * the topic is granted only when pets are genuinely allowed.
 */
export function villaTopics(locale: string, villa: VillaContent): string[] {
  const hay = villaText(villa)
  const facts = villaFacts(villa)
  return topicsFor(locale)
    .filter((t) => {
      if (t.id === 'hond') return facts.petsAllowed === true
      return t.match.test(hay)
    })
    .map((t) => t.id)
}

export type RelatedArticle = { slug: string; blog: BlogContent; shared: string[] }

/**
 * Articles related to a villa, best match first.
 *
 * ON THE OVERLAP BETWEEN VILLAS. Four of the five houses are deliberately alike: same dune area near Nes,
 * private sauna, no pets, comparable size. A word-level comparison of their own copy shows the only
 * genuinely distinctive vocabulary is incidental ("rietgedekte" on Zilt, "doodlopende weg" on Nova). So
 * their recommendation lists overlapping heavily is the CORRECT outcome, not a defect — the villas really
 * do suit the same articles. The bungalow, which differs (Ballum, dogs welcome, family field), gets a
 * visibly different list, which is the check that the matching responds to real differences.
 *
 * Fabricating variety here — rotating articles per villa, or seeding by slug — would invent a distinction
 * the content does not contain, so it is not done.
 *
 * `limit` keeps the section scannable; the full article list stays reachable from the hub.
 */
export function relatedArticles(
  locale: string,
  villa: VillaContent,
  blogs: BlogCollection,
  limit = 3,
): RelatedArticle[] {
  const total = Object.keys(blogs).length || 1

  /** How many articles carry each topic — the basis for deciding which topics actually discriminate. */
  const topicFreq = new Map<string, number>()
  for (const blog of Object.values(blogs)) {
    for (const t of topicsOf(locale, blog)) topicFreq.set(t, (topicFreq.get(t) ?? 0) + 1)
  }

  /**
   * Ignore topics that match MOST of the corpus.
   *
   * `natuur` covers 38 of 57 Dutch articles and `strand`/`cultuur` are close behind — every villa is near
   * nature and the sea, so sharing those says nothing about which article suits which house. Including
   * them produced the same three recommendations on all five villas (measured before this rule).
   *
   * A topic only counts as a signal when fewer than half the articles carry it. What remains is the
   * distinguishing vocabulary: sauna, dogs, family, weekend, food, weather, cycling.
   */
  const isDiscriminating = (t: string) => (topicFreq.get(t) ?? 0) < total * 0.5

  const mine = new Set(villaTopics(locale, villa).filter(isDiscriminating))
  if (mine.size === 0) return []

  const scored: RelatedArticle[] = []
  for (const [slug, blog] of Object.entries(blogs)) {
    const shared = topicsOf(locale, blog).filter((t) => mine.has(t))
    if (shared.length === 0) continue
    scored.push({ slug, blog, shared })
  }

  // Rarer shared topics weigh more, so the most specific match ranks first.
  const weight = (t: string) => Math.log(total / (topicFreq.get(t) ?? 1) + 1)

  return scored
    .map((s) => ({ s, score: s.shared.reduce((n, t) => n + weight(t), 0) }))
    // Stable tie-break on slug, so the list never reshuffles between builds.
    .sort((a, b) => b.score - a.score || a.s.slug.localeCompare(b.s.slug))
    .slice(0, limit)
    .map((x) => x.s)
}
