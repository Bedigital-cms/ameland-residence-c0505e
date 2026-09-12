/**
 * Canonical URL construction — the single source of truth for every absolute URL the site emits
 * (canonicals, hreflang alternates, sitemap entries, JSON-LD `@id`/`url` fields).
 *
 * Why this module exists: a page's public URL is NOT simply its route path. This site runs three
 * routing modes (see `proxy.ts`), and two of them rewrite the URL:
 *
 *   · per-domain mode (production): nl lives on ameland-residence.nl, de on ameland-residence.de,
 *     both on CLEAN paths — the `/[locale]` route segment never appears publicly.
 *   · hideDefaultPrefix: the default language is clean, other languages keep `/<locale>`.
 *   · classic (staging/preview): every language keeps its `/<locale>` prefix.
 *
 * So a canonical built naively from the route (`/nl/contact`) would be WRONG in production, where
 * that URL 301s to `/contact`. Emitting it would point search engines at a redirect and split
 * signals across two hostnames. Every URL therefore goes through `publicPath` + `siteOrigin` here.
 *
 * Content paths are stored prefix-free ("/contact"), which is already the production shape — the
 * locale prefix is a routing detail these helpers add back only when the active mode needs it.
 *
 * Server-only: reads the i18n config from the filesystem via `lib/i18n`.
 */
import { activeLocales, defaultLocale, domainLocaleMap, domainLocaleMode, hideDefaultPrefix } from './i18n'

/** Strip trailing slashes (but never reduce "/" to ""). */
function trimSlashes(p: string): string {
  const out = p.replace(/\/+$/, '')
  return out || '/'
}

/**
 * The public, prefix-free content path for a page: "/" for the homepage, "/contact",
 * "/villa-s/villa-zee". This is the shape stored in content JSON and the shape production serves.
 */
export function contentPath(segments: (string | undefined)[]): string {
  const parts = segments.filter((s): s is string => !!s)
  return parts.length ? `/${parts.join('/')}` : '/'
}

/**
 * The path this page is actually reachable at, for the CURRENT routing mode.
 *
 *  · per-domain mode → the clean path (the domain carries the language)
 *  · hideDefaultPrefix + default locale → the clean path
 *  · otherwise → "/<locale>" + path
 *
 * Pass a prefix-free content path ("/contact"). Returns a root-relative path with no trailing slash.
 */
export function publicPath(locale: string, path: string): string {
  const clean = trimSlashes(path.startsWith('/') ? path : `/${path}`)
  if (domainLocaleMode()) return clean
  if (hideDefaultPrefix() && locale === defaultLocale()) return clean
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}

/**
 * The host that serves a given language in per-domain mode ("ameland-residence.nl"), or undefined
 * when the language has no dedicated domain (single-domain / staging).
 */
export function hostForLocale(locale: string): string | undefined {
  if (!domainLocaleMode()) return undefined
  return Object.entries(domainLocaleMap()).find(([, loc]) => loc === locale)?.[0]
}

/**
 * Absolute origin ("https://ameland-residence.nl") for a language, or "" when it can't be known.
 *
 * `NEXT_PUBLIC_SITE_URL` wins — it is how preview deployments (and local builds) declare their own
 * origin. Otherwise per-domain mode derives it from the host map. Returning "" is deliberate and
 * safe: callers then emit ROOT-RELATIVE canonicals/alternates, which browsers and crawlers resolve
 * against the current host. A guessed origin would be worse than a relative one — it would point
 * the crawler at a domain that may not serve this content.
 */
export function siteOrigin(locale: string): string {
  const override = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
  if (override) return override
  const host = hostForLocale(locale)
  return host ? `https://${host}` : ''
}

/**
 * Fully-qualified URL for a page when the origin is known, else the root-relative public path.
 * Used for canonicals and JSON-LD, both of which accept either form.
 */
export function absoluteUrl(locale: string, path: string): string {
  const rel = publicPath(locale, path)
  const origin = siteOrigin(locale)
  if (!origin) return rel
  return rel === '/' ? `${origin}/` : `${origin}${rel}`
}

/**
 * Fully-qualified URL for a static ASSET (`/media/…`), when the origin is known.
 *
 * Distinct from `absoluteUrl`, which routes its argument through `publicPath` and would therefore
 * prefix a locale onto the path — `/nl/media/foo.jpg`, which does not exist. An asset path is already
 * final and must be joined to the origin untouched.
 *
 * Falls back to the root-relative path when no origin is configured. That is correct for a preview
 * build, though note a social crawler needs the absolute form: `og:image` is fetched by Facebook's or
 * LinkedIn's servers, which have no page context to resolve a relative path against. In production
 * `NEXT_PUBLIC_SITE_URL` (or a per-domain host) supplies the origin and the tag comes out absolute.
 */
export function absoluteAssetUrl(locale: string, path: string): string {
  if (!path.startsWith('/')) return path
  const origin = siteOrigin(locale)
  return origin ? `${origin}${path}` : path
}

/** BCP-47 region-qualified hreflang code ("nl" → "nl-NL"). Falls back to the bare code. */
const HREFLANG: Record<string, string> = { nl: 'nl-NL', de: 'de-DE' }
export function hreflangCode(locale: string): string {
  return HREFLANG[locale] || locale
}

/**
 * Build the `alternates` metadata block for one page: a self-referencing canonical plus reciprocal
 * hreflang entries.
 *
 * `equivalents` maps locale → that language's own prefix-free path for THIS page. Only languages
 * present in the map get an hreflang entry — the document's rule is that a page must not be linked
 * to a language where no genuine equivalent exists (villa "watersnip" is `luxe-bungalow-watersnip`
 * in nl but `luxesbungalow-watersnip` in de, and some articles exist in only one language). A page
 * with no cross-language equivalent gets a canonical and NO alternates, which is correct — a
 * one-sided hreflang is ignored by search engines anyway.
 *
 * `x-default` points at the default language when that language has an equivalent, giving crawlers
 * a defined destination for unmatched locales.
 */
export function alternatesFor(locale: string, equivalents: Record<string, string>): {
  canonical: string
  languages?: Record<string, string>
} {
  const self = equivalents[locale]
  const canonical = absoluteUrl(locale, self ?? '/')

  const languages: Record<string, string> = {}
  for (const loc of activeLocales()) {
    const path = equivalents[loc]
    if (!path) continue // no genuine equivalent → no hreflang entry (never link a guess)
    languages[hreflangCode(loc)] = absoluteUrl(loc, path)
  }
  // Only advertise alternates when this page genuinely exists in more than one language.
  if (Object.keys(languages).length < 2) return { canonical }

  const def = defaultLocale()
  if (equivalents[def]) languages['x-default'] = absoluteUrl(def, equivalents[def])
  return { canonical, languages }
}
