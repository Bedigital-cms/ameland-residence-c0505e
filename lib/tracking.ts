/**
 * Tenant tracking configuration reader (`content/integrations.json` → `tracking`).
 *
 * The BE Digital CMS owns this file (Tenants → Tracking): a consultant enters a Google Tag Manager
 * container id and toggles tracking on, and the CMS writes `{ tracking: { enabled, gtmId, tenant } }`
 * into the site repo. The site reads it here at build/render time and injects GTM automatically —
 * no per-customer code change. This mirrors `lib/i18n.ts`: the CMS toggle is the source of truth.
 *
 * Fail-safe: a missing/invalid `tracking` block returns `null`, which makes the analytics layer fall
 * back to its per-locale env defaults (so a site already wired via env keeps working untouched).
 *
 * Server-only: reads the filesystem. Safe to import from Server Components / generateMetadata.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

export type SiteTracking = {
  /** Whether the consultant enabled tracking for this tenant. */
  enabled: boolean
  /** The tenant's single GTM container id (e.g. `GTM-XXXXXXX`). Empty when not set. */
  gtmId: string
  /** Tenant slug (for dataLayer context). Empty when the CMS hasn't written one. */
  tenant: string
}

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/i

/** Whether `id` is a syntactically valid GTM container id (guards against script injection). */
export function isGtmId(id: string | null | undefined): boolean {
  return typeof id === 'string' && GTM_ID_RE.test(id.trim())
}

let cached: SiteTracking | null | undefined

/**
 * The tenant's tracking config, or `null` when `content/integrations.json` has no `tracking` block
 * (the caller then falls back to env). A present-but-disabled block returns `{ enabled: false }` —
 * an explicit "off", which the analytics layer honours by emitting no GTM at all.
 */
export function siteTracking(): SiteTracking | null {
  if (cached !== undefined) return cached
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'integrations.json'), 'utf8'))
    const t = raw?.tracking
    if (t && typeof t === 'object' && !Array.isArray(t)) {
      cached = {
        enabled: t.enabled === true,
        gtmId: typeof t.gtmId === 'string' ? t.gtmId.trim() : '',
        tenant: typeof t.tenant === 'string' ? t.tenant.trim() : '',
      }
      return cached
    }
  } catch {
    // missing / invalid file → fall back to env
  }
  cached = null
  return cached
}

/** Test seam: drop the memoised read so a test can point `process.cwd()` at a fixture. */
export function __resetTrackingCacheForTests(): void {
  cached = undefined
}
