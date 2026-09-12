import type { MetadataRoute } from 'next'

import { itemEquivalents, pageEquivalents } from '@/content/equivalents'
import { getBlogSlugs } from '@/content/blogs'
import { getPage, getPageSlugs } from '@/content/pages'
import { getVillaSlugs } from '@/content/villas'
import { activeLocales } from '@/lib/i18n'
import { absoluteUrl, hreflangCode } from '@/lib/urls'

/**
 * XML sitemap at /sitemap.xml — the previous template shipped none, so nothing told a crawler which
 * URLs exist or how the Dutch and German versions relate.
 *
 * Built from the SAME content and the SAME URL helpers the pages use, so it can never list a URL that
 * 404s or a path shape the router would redirect. Every entry carries its hreflang alternates, which
 * is the sitemap-level equivalent of the per-page <link rel="alternate"> tags.
 *
 * `noindex` pages are excluded: the thank-you pages carry "noindex, follow" in their SEO block, and
 * listing a page you have asked not to be indexed is a contradiction crawlers report as an error.
 *
 * PER-DOMAIN CAVEAT: in production each language lives on its own domain, and a sitemap may only list
 * URLs on its own host. Next generates one sitemap per deployment, not per domain, so each domain
 * serves this same route — which is why every entry is an ABSOLUTE per-language URL (from
 * `absoluteUrl`) rather than a relative one. Google accepts cross-host entries when the hosts are
 * verified in the same Search Console account; if that is not wanted, split this into two sitemaps
 * behind a host check once the domains are live. Documented in the audit report.
 */

/** Skip pages whose own SEO block asks not to be indexed. */
function isIndexable(locale: string, slug: string): boolean {
  const page = getPage(locale, slug)
  if (!page) return false
  return !/noindex/i.test(page.seo?.robots || '')
}

/** One sitemap entry: the URL plus its reciprocal language alternates. */
function entry(
  locale: string,
  path: string,
  equivalents: Record<string, string>,
  priority: number,
): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {}
  for (const [loc, p] of Object.entries(equivalents)) {
    languages[hreflangCode(loc)] = absoluteUrl(loc, p)
  }
  return {
    url: absoluteUrl(locale, path),
    // No `lastModified`: the content model stores no modification dates, and a build timestamp would
    // claim every page changed on every deploy — a false signal crawlers learn to distrust.
    changeFrequency: 'monthly',
    priority,
    ...(Object.keys(languages).length > 1 ? { alternates: { languages } } : {}),
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = []
  const locales = activeLocales()

  for (const locale of locales) {
    // Homepage — highest priority, always present in every language.
    const homeEq = Object.fromEntries(locales.map((l) => [l, '/']))
    out.push(entry(locale, '/', homeEq, 1))

    // Every page from pages.json (hubs, contact, landing and info pages).
    for (const slug of getPageSlugs(locale)) {
      if (!isIndexable(locale, slug)) continue
      out.push(entry(locale, `/${slug}`, pageEquivalents(locale, slug), 0.8))
    }

    // Villa detail pages — the commercial core, so ranked above articles.
    for (const item of getVillaSlugs(locale)) {
      const eq = itemEquivalents(locale, item, 'villas')
      const self = eq[locale]
      if (self) out.push(entry(locale, self, eq, 0.9))
    }

    // Article detail pages.
    for (const item of getBlogSlugs(locale)) {
      const eq = itemEquivalents(locale, item, 'blogs')
      const self = eq[locale]
      if (self) out.push(entry(locale, self, eq, 0.6))
    }
  }

  // In per-domain mode the same route is served by both domains; de-duplicate by URL so a repeated
  // build or a shared entry can never emit the same <loc> twice (a sitemap validation error).
  const seen = new Set<string>()
  return out.filter((e) => {
    if (seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })
}

/** Pre-render the sitemap at build time — it depends only on content files, never on the request. */
export const dynamic = 'force-static'
