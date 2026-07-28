import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

/**
 * Phase-function config so the build output dir is chosen automatically:
 *  - `next dev`         → `.next`         (local preview/dev server)
 *  - local `next build` → `.next-verify`  (isolated, so the platform's validation build never
 *                                          clashes with a running dev server sharing `.next`)
 *  - Vercel build       → `.next`         (VERCEL=1)
 * `IZZI_DIST_DIR` overrides everything (the platform passes it for the validation build).
 *
 * Redirects are data-driven: `content/redirects.json` holds the list, edited via the CMS (AI or the
 * manual redirects editor) as a change request. This config reads that file and hands it to Next's
 * native `redirects()`, so a redirect works on Vercel, locally and any host. Missing/invalid file →
 * no redirects (never breaks the build).
 *
 * i18n: rules are authored prefix-free (source `/old`, destination `/new`). On a multi-language site
 * every language has its own URL space, so for EACH rule we emit:
 *   - a per-locale rule: `/<locale>/old` → `/<locale>/new` (a prefixed old URL redirects in-language),
 *   - a bare rule: `/old` → the DEFAULT language's new URL.
 * The default language's target depends on `hideDefaultPrefix`:
 *   - hideDefaultPrefix OFF (every language prefixed): default target is `/<default>/new`.
 *   - hideDefaultPrefix ON (default served on clean URLs): default target is `/new` (NO prefix) —
 *     else the proxy would strip the prefix and cause a SECOND redirect (`/old`→`/nl/new`→`/new`).
 * Every case resolves in ONE hop. Single-language sites keep the plain flat rule.
 */
type RedirectRule = { source: string; destination: string; permanent: boolean }
function loadRedirects(): RedirectRule[] {
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'redirects.json'), 'utf8'))
    const list = Array.isArray(raw?.redirects) ? raw.redirects : []
    return list.filter(
      (r: unknown): r is RedirectRule =>
        !!r && typeof (r as RedirectRule).source === 'string' && typeof (r as RedirectRule).destination === 'string',
    )
  } catch {
    return []
  }
}

type I18nInfo = { enabled: boolean; defaultLocale: string; locales: string[]; hideDefaultPrefix: boolean }
/** i18n config for redirect building. `enabled` = multi-language actually on (>1 active locale). */
function i18nInfo(): I18nInfo {
  try {
    const cfg = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'i18n.json'), 'utf8'))
    const locales: string[] = Array.isArray(cfg?.locales) ? cfg.locales.filter((l: unknown): l is string => typeof l === 'string') : []
    const defaultLocale = typeof cfg?.defaultLocale === 'string' ? cfg.defaultLocale : 'nl'
    const enabled = cfg?.enabled === true && locales.length > 1
    return { enabled, defaultLocale, locales, hideDefaultPrefix: cfg?.hideDefaultPrefix === true }
  } catch {
    return { enabled: false, defaultLocale: 'nl', locales: [], hideDefaultPrefix: false }
  }
}

/** Prefix an internal path ("/x") with "/<locale>"; leave anchors, absolute URLs, and already-prefixed paths. */
function withLocale(dest: string, locale: string): string {
  if (!dest.startsWith('/') || dest.startsWith('//')) return dest // external / protocol-relative
  const first = dest.split('/')[1]
  if (first === locale) return dest // already prefixed
  return dest === '/' ? `/${locale}` : `/${locale}${dest}`
}
/** Prefix a source path with a locale ("/old" → "/nl/old", "/" → "/nl"). */
const prefixPath = (locale: string, p: string): string => (p === '/' ? `/${locale}` : `/${locale}${p}`)

/** Expand authored (prefix-free) rules into concrete per-locale + bare Next redirect rules. */
function buildRedirects(): RedirectRule[] {
  const rules = loadRedirects()
  const { enabled, defaultLocale, locales, hideDefaultPrefix } = i18nInfo()
  const out: RedirectRule[] = []
  for (const r of rules) {
    const permanent = r.permanent !== false
    if (!enabled) {
      out.push({ source: r.source, destination: r.destination, permanent }) // single-language: flat
      continue
    }
    // A prefixed old URL in each active language → the same-language new URL. In clean-URL mode the
    // default language targets the unprefixed new path (so it doesn't get a second, strip-prefix redirect).
    for (const loc of locales) {
      const dest = loc === defaultLocale && hideDefaultPrefix ? r.destination : withLocale(r.destination, loc)
      out.push({ source: prefixPath(loc, r.source), destination: dest, permanent })
    }
    // The bare (unprefixed) old URL → the default language's new URL.
    out.push({
      source: r.source,
      destination: hideDefaultPrefix ? r.destination : withLocale(r.destination, defaultLocale),
      permanent,
    })
  }
  return out
}

export default (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  const distDir = process.env.IZZI_DIST_DIR || (!isDev && !process.env.VERCEL ? '.next-verify' : '.next')
  return {
    reactStrictMode: true,
    distDir,
    async redirects() {
      return buildRedirects()
    },
  }
}
