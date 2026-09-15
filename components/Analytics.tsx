import { analyticsBootstrapScript, resolveAnalytics } from '@/lib/analytics'

import { DataLayer } from './DataLayer'

/**
 * Single mount point for production analytics (GTM + Consent Mode v2 + optional CookieFirst).
 *
 * Renders nothing unless this runtime may load trackers (production host / explicit enable) AND a
 * valid GTM container id is resolved (from the CMS "Tracking" tab or env). All GTM/consent logic
 * lives in `lib/analytics.ts`; this file is the layout hook that emits the head bootstrap, the
 * official GTM `<noscript>` iframe (first thing in <body>), and the client dataLayer route context.
 */
export function Analytics({ locale }: { locale: string }) {
  const cfg = resolveAnalytics(locale)
  if (!cfg) return null
  return (
    <>
      <script id="bd-analytics" dangerouslySetInnerHTML={{ __html: analyticsBootstrapScript(cfg) }} />
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(cfg.gtmId)}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
      <DataLayer tenant={cfg.tenant} locale={cfg.language} />
    </>
  )
}
