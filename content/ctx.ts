import type { FormDef } from '@/components/Form'
import type { RenderCtx } from '@/components/sections'
import { domainLocaleMap } from '@/lib/i18n'

import { getBlogs } from './blogs'
import { loadForm } from './load'
import { getPages, hubBase } from './pages'
import { getSite } from './site'
import { getVillas } from './villas'

/**
 * Absolute URL Tommy redirects to after a completed booking.
 *
 * Tommy is a third-party widget on its own origin, so it needs a fully-qualified URL — a path won't
 * do. In per-domain mode the language already implies the domain (nl → .nl, de → .de), which is
 * exactly the host the guest must come back to. `NEXT_PUBLIC_SITE_URL` overrides for preview
 * deployments; without either we fall back to the path and Tommy resolves it against the referrer.
 */
function bookingSuccessUrl(locale: string, path: string): string {
  const override = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
  if (override) return override + path
  const host = Object.entries(domainLocaleMap()).find(([, loc]) => loc === locale)?.[0]
  return host ? `https://${host}${path}` : path
}

/** Everything the section renderers need for one language, loaded once per page render. */
export function buildCtx(locale: string): RenderCtx {
  const site = getSite(locale)
  return {
    locale,
    site,
    villas: getVillas(locale),
    blogs: getBlogs(locale),
    pages: getPages(locale),
    villaBase: hubBase(locale, 'villas-hub'),
    blogBase: hubBase(locale, 'blogs-hub'),
    contactForm: loadForm<FormDef>('contact', locale),
    bookingSuccessUrl: bookingSuccessUrl(locale, site.booking.successUrl),
  }
}
