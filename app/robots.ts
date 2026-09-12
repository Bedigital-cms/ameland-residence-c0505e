import type { MetadataRoute } from 'next'

import { defaultLocale } from '@/lib/i18n'
import { siteOrigin } from '@/lib/urls'

/**
 * /robots.txt — the previous template shipped none, so crawlers had no sitemap reference and no
 * guidance on the non-content routes.
 *
 * Deliberately permissive: this is a marketing site whose whole purpose is to be indexed. Only two
 * things are disallowed, both non-content:
 *   · /media/ — the redirect route to the CMS media endpoint. The IMAGES are meant to be indexed, and
 *     they are: pages reference them and Google follows <img src>. What has no value in the index is
 *     the 302 route itself.
 *   · /api/ — no public API pages exist; excluding it keeps crawl budget on real content.
 *
 * The `sitemap` line is only emitted when the origin is actually known (`NEXT_PUBLIC_SITE_URL`, or a
 * per-domain host in production). A relative sitemap path is invalid in robots.txt, so on a preview
 * without a configured origin the line is omitted rather than written wrong — the sitemap is still
 * reachable at /sitemap.xml and can be submitted directly in Search Console.
 *
 * Note this does NOT block the Vercel staging host from being indexed. That protection belongs at the
 * deployment level (Vercel preview deployments are noindex by default via `x-robots-tag`), not here —
 * a robots.txt that blocks staging would ship to production and block production too.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin(defaultLocale())
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/media/', '/api/'] }],
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  }
}

/** Static: depends only on config, never on the request. */
export const dynamic = 'force-static'
