import { analyticsBootstrapScript, resolveAnalytics } from '@/lib/analytics'

/**
 * Single mount point for production analytics + CookieFirst.
 *
 * Renders nothing unless this runtime is allowed to load trackers (production host / explicit
 * enable) AND a CookieFirst site id is configured. All GTM/GA4/CMP logic lives in `lib/analytics.ts`
 * so this file stays a one-line layout hook.
 */
export function Analytics({ locale }: { locale: string }) {
  const cfg = resolveAnalytics(locale)
  if (!cfg) return null
  return <script id="bd-analytics" dangerouslySetInnerHTML={{ __html: analyticsBootstrapScript(cfg) }} />
}
