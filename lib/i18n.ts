/**
 * Site-level i18n configuration reader.
 *
 * Reads `content/i18n.json` (written by the CMS tenant toggle) and exposes which locales this
 * particular site has ACTIVATED, its default, and whether multi-language is on. Everything else
 * (routing, content loading, the switcher) derives from here, so flipping the toggle in the CMS
 * is the single source of truth — no code change needed to add/remove a language for a site.
 *
 * Server-only: reads the filesystem. Safe to import from Server Components, generateStaticParams,
 * the proxy, and next.config.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { isSupportedLocale } from './locales'

export type I18nConfig = {
  enabled: boolean
  defaultLocale: string
  locales: string[]
  /** Serve the default language WITHOUT its /<locale> prefix ("/behandelingen" not "/nl/behandelingen"). */
  hideDefaultPrefix: boolean
  /** Per-domain locale mode ON: each domain serves ONE language on clean (prefix-free) URLs, decided
   *  by the request host (see `domainLocales`). No /<locale> prefix, no language switcher. */
  domainLocalesEnabled: boolean
  /** host → locale map for per-domain mode (bare hostnames; only imported/served locales are kept). */
  domainLocales: Record<string, string>
}

const FALLBACK: I18nConfig = {
  enabled: false,
  defaultLocale: 'nl',
  locales: ['nl'],
  hideDefaultPrefix: false,
  domainLocalesEnabled: false,
  domainLocales: {},
}

let cached: I18nConfig | null = null

/**
 * Whether a locale has actually been IMPORTED — i.e. its `content/<locale>/` folder exists on disk.
 * A locale can be ACTIVATED in the CMS (listed in i18n.json) before any content is imported for it;
 * until it's imported, the site must not serve or advertise it (no route, no switcher entry). The
 * default locale is always treated as present so the site can always render.
 */
function hasContentFolder(locale: string): boolean {
  return existsSync(path.join(process.cwd(), 'content', locale))
}

/** Normalise a Host header to a bare, lowercase hostname (drop port, trim). */
function bareHost(host: string | null | undefined): string {
  return (host || '').trim().toLowerCase().split(':')[0]
}

/**
 * Read + validate content/i18n.json once. Invalid/missing → safe single-locale fallback (nl).
 *
 * The served locales are the ACTIVATED ones (from i18n.json) INTERSECTED with the ones actually
 * IMPORTED (have a content/<locale>/ folder). So a language the CMS activated but hasn't imported
 * yet never appears on the live site — routing, generateStaticParams and the switcher all derive
 * from this, so the client only ever sees languages that have real content.
 */
export function i18nConfig(): I18nConfig {
  if (cached) return cached
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'i18n.json'), 'utf8'))
    const defaultLocale =
      typeof raw?.defaultLocale === 'string' && isSupportedLocale(raw.defaultLocale) ? raw.defaultLocale : FALLBACK.defaultLocale
    // Keep only supported codes; always include the default; dedupe preserving order.
    const requested: string[] = Array.isArray(raw?.locales) ? raw.locales.filter((l: unknown): l is string => typeof l === 'string') : []
    const activated = Array.from(new Set([defaultLocale, ...requested].filter(isSupportedLocale)))
    // Serve only imported languages: the default always, plus any non-default whose content folder exists.
    const locales = activated.filter((l) => l === defaultLocale || hasContentFolder(l))
    const served = locales.length ? locales : [FALLBACK.defaultLocale]

    // Per-domain locale map — keep only hosts mapped to a SERVED (imported) locale, so a mapping to a
    // not-yet-imported / removed language can never take effect. Mode is only on with ≥1 valid mapping.
    const rawMap = raw?.domainLocales && typeof raw.domainLocales === 'object' ? (raw.domainLocales as Record<string, unknown>) : {}
    const domainLocales: Record<string, string> = {}
    for (const [host, loc] of Object.entries(rawMap)) {
      const h = bareHost(host)
      if (h && typeof loc === 'string' && served.includes(loc)) domainLocales[h] = loc
    }
    const domainLocalesEnabled = raw?.domainLocalesEnabled === true && served.length > 1 && Object.keys(domainLocales).length > 0

    cached = {
      enabled: raw?.enabled === true && served.length > 1,
      defaultLocale,
      locales: served,
      hideDefaultPrefix: raw?.hideDefaultPrefix === true,
      domainLocalesEnabled,
      domainLocales,
    }
  } catch {
    cached = FALLBACK
  }
  return cached
}

/** Active locale codes for this site (always at least the default). */
export function activeLocales(): string[] {
  return i18nConfig().locales
}

/** The locale served at the site root. */
export function defaultLocale(): string {
  return i18nConfig().defaultLocale
}

/** Whether this site actually runs multi-language (toggle on AND >1 active locale). */
export function i18nEnabled(): boolean {
  return i18nConfig().enabled
}

/**
 * Whether the default language is served WITHOUT its /<locale> prefix (clean URLs).
 * When true: "/behandelingen" serves the default language; "/<default>/behandelingen" 301-redirects
 * to "/behandelingen"; other languages keep their prefix ("/fr/behandelingen").
 */
export function hideDefaultPrefix(): boolean {
  return i18nConfig().hideDefaultPrefix
}

/** Whether `code` is one this site has activated (not merely supported by the platform). */
export function isActiveLocale(code: string): boolean {
  return activeLocales().includes(code)
}

/** Normalise an incoming locale to an active one, falling back to the default. */
export function resolveLocale(code: string | undefined): string {
  return code && isActiveLocale(code) ? code : defaultLocale()
}

/* --------------------------- per-domain locale mode --------------------------- */

/**
 * Whether per-domain locale mode is effectively ON: the toggle is set, the site is multi-language,
 * and at least one host→locale mapping points at a served language. In this mode the request HOST
 * decides the language (clean URLs, no /<locale> prefix, no switcher) — see `localeForHost`.
 */
export function domainLocaleMode(): boolean {
  return i18nConfig().domainLocalesEnabled
}

/** The host→locale map for per-domain mode (bare hostnames; only served locales). */
export function domainLocaleMap(): Record<string, string> {
  return i18nConfig().domainLocales
}

/**
 * Locales the in-page LANGUAGE SWITCHER should offer. Same as `activeLocales()` normally, but EMPTY
 * in per-domain mode — there each domain is a single language, so the switcher is hidden (the visitor
 * changes language by visiting the other domain, not via an in-page control). Routing and
 * `generateStaticParams` still use `activeLocales()`, so every language is built either way.
 */
export function switcherLocales(): string[] {
  return domainLocaleMode() ? [] : activeLocales()
}

/**
 * The locale a given request host should serve in per-domain mode, or null when this host isn't
 * mapped (or per-domain mode is off). The host is matched bare + lowercase, with a leading "www."
 * ignored so casabase.de and www.casabase.de map the same. Returns null → caller falls back to the
 * classic URL-prefix behaviour (so preview/staging hosts still work).
 */
export function localeForHost(host: string | null | undefined): string | null {
  if (!domainLocaleMode()) return null
  const map = domainLocaleMap()
  const h = bareHost(host)
  if (!h) return null
  return map[h] ?? map[h.replace(/^www\./, '')] ?? null
}
