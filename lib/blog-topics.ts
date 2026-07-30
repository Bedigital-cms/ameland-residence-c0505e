/**
 * Topic classification for blog articles — derived from each article's OWN text, never invented.
 *
 * The task document asks for topic filters on the blog overview. `BlogContent` has no category or tag
 * field, so the topics have to come from somewhere. Two candidates were measured against the real
 * corpus before choosing:
 *
 *  1. `seo.keywords` — every article has them, but they are near-universal boilerplate: "ameland
 *     residence" appears on 57/57 Dutch articles, "luxe vakantie" on 56, "vakantiewoning ameland" on 52.
 *     Filters built on those would put almost every article in almost every bucket, i.e. no filter at
 *     all. Measured, rejected.
 *  2. Phrase matching over title + excerpt + keywords + section headings — the text a reader actually
 *     sees. Produces a usable spread (Dutch: 38 nature, 22 culture, 21 beach, 11 sauna, 7 dogs …) and
 *     leaves ZERO articles unclassified in either language.
 *
 * So (2). Each topic is a hand-written pattern over vocabulary that genuinely appears in the articles;
 * nothing is machine-generated and no article is assigned a topic its text does not support. An article
 * can carry several topics, which is correct — a piece about walking the dog on the beach belongs under
 * all three.
 *
 * The topic LABELS are new UI strings (there is no content field holding them), which is why they live
 * here beside the patterns rather than in the CMS: inventing content is forbidden, but a filter needs a
 * button label. They are deliberately plain descriptions of what the articles are about, not marketing
 * copy, and they never appear as page prose — only as filter controls and a `?topic=` value.
 */
import type { BlogContent } from './types'

export type Topic = {
  /** Stable URL-safe id used in `?topic=` — must not change, it is a linkable filter state. */
  id: string
  /** Button label in this language. */
  label: string
  /** Matched against the article's visible text. */
  match: RegExp
}

/**
 * Dutch topics. Order is display order; roughly most-to-least populated so the filter row reads well.
 * Patterns are accent-tolerant where the corpus varies.
 */
const NL: Topic[] = [
  { id: 'natuur', label: 'Natuur & wandelen', match: /natuur|wandel|duin|vogel|zeehond|wadlop|robben/i },
  { id: 'strand', label: 'Strand & zee', match: /strand|\bzee\b|kust/i },
  { id: 'cultuur', label: 'Cultuur & dorpen', match: /cultuur|musea|museum|dorp|kunstmaand|bezienswaardig/i },
  { id: 'eten', label: 'Eten & drinken', match: /culinair|restaurant|\beten\b|proefroute|gastronom/i },
  { id: 'sauna', label: 'Sauna & wellness', match: /sauna|wellness|solarium|ligbad|jacuzzi/i },
  { id: 'familie', label: 'Familie', match: /famili|gezin|kinderen|\bkind\b|oma|opa/i },
  { id: 'fietsen', label: 'Fietsen', match: /fiets/i },
  { id: 'weer', label: 'Weer & seizoenen', match: /\bweer\b|seizoen|voorjaar|winter|zomer|herfst|lente|klimaat|regen/i },
  { id: 'reizen', label: 'Reizen & vervoer', match: /reizen|vervoer|veerboot|\bboot\b|zonder auto|bereik/i },
  { id: 'hond', label: 'Met hond', match: /\bhond|viervoeter|huisdier/i },
  { id: 'weekend', label: 'Weekend & midweek', match: /weekend|midweek/i },
  { id: 'lastminute', label: 'Last minute', match: /last.?minute/i },
]

/** German topics — same vocabulary, German wording. Umlauts optional so both spellings match. */
const DE: Topic[] = [
  { id: 'natuur', label: 'Natur & Wandern', match: /natur|wander|d(ü|u)ne|vogel|robben|wattwander/i },
  { id: 'strand', label: 'Strand & Meer', match: /strand|\bmeer\b|k(ü|u)ste/i },
  { id: 'cultuur', label: 'Kultur & Dörfer', match: /kultur|museen|museum|d(ö|o)rf|sehensw(ü|u)rdig|kunstmonat/i },
  { id: 'eten', label: 'Essen & Trinken', match: /kulinar|restaurant|\bessen\b|gastronom/i },
  { id: 'sauna', label: 'Sauna & Wellness', match: /sauna|wellness|solarium|badewanne|whirlpool/i },
  { id: 'familie', label: 'Familie', match: /famili|kinder/i },
  { id: 'fietsen', label: 'Fahrrad', match: /fahrrad|radfahren|radtour/i },
  { id: 'weer', label: 'Wetter & Jahreszeiten', match: /wetter|jahreszeit|fr(ü|u)hling|winter|sommer|herbst|klima|regen/i },
  { id: 'reizen', label: 'Reise & Anfahrt', match: /reise|anfahrt|f(ä|a)hre|erreich/i },
  { id: 'hond', label: 'Mit Hund', match: /\bhund|vierbein|haustier/i },
  { id: 'weekend', label: 'Wochenende', match: /wochenende|kurzurlaub/i },
  { id: 'lastminute', label: 'Last Minute', match: /last.?minute/i },
]

/** Topic list for a locale. Unknown locales fall back to Dutch so the filter never renders empty. */
export function topicsFor(locale: string): Topic[] {
  return locale === 'de' ? DE : NL
}

/** The text a topic is matched against: everything a reader sees, headings included. */
function haystack(blog: BlogContent): string {
  return [
    blog.title,
    blog.excerpt,
    blog.seo?.keywords ?? '',
    ...(blog.blocks ?? []).map((b) => b.heading),
  ]
    .filter(Boolean)
    .join(' \n ')
}

/** Topic ids this article belongs to. May be several; is never empty for the current corpus. */
export function topicsOf(locale: string, blog: BlogContent): string[] {
  const hay = haystack(blog)
  return topicsFor(locale)
    .filter((t) => t.match.test(hay))
    .map((t) => t.id)
}

/**
 * Free-text search over the same visible text.
 *
 * Every whitespace-separated term must appear somewhere (AND, not OR) — with 57 articles an OR search
 * matches almost everything and is useless. Diacritics are folded so "dune" finds "düne" and vice
 * versa, which matters on the German side.
 */
export function matchesQuery(blog: BlogContent, query: string): boolean {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
  const hay = fold(haystack(blog))
  const terms = fold(query).split(/\s+/).filter(Boolean)
  return terms.every((t) => hay.includes(t))
}

/** How many articles carry each topic — drives the counts shown on the filter buttons. */
export function topicCounts(locale: string, blogs: Record<string, BlogContent>): Record<string, number> {
  return countTopics(locale, Object.values(blogs))
}

/**
 * Topic counts over an arbitrary list of articles.
 *
 * The overview counts topics over the SEARCH RESULT rather than the whole corpus, so a chip never
 * promises results the active search would exclude. Same classification path as `topicsOf`, so the
 * counts and the filtering can never disagree.
 */
export function countTopics(locale: string, list: BlogContent[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const blog of list) {
    for (const id of topicsOf(locale, blog)) out[id] = (out[id] ?? 0) + 1
  }
  return out
}
