import type { FormDef } from '@/components/Form'
import type { RenderCtx } from '@/components/sections'
import { getAvailability, parseRange, type DateRange } from '@/lib/availability'
import { domainLocaleMap } from '@/lib/i18n'

import { getBlogs } from './blogs'
import { loadForm } from './load'
import { findPageSlugByKind, getPages, hubBase } from './pages'
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

/** Next hands query values as string | string[] (repeated keys); only the first is meaningful here. */
export type SearchParams = Record<string, string | string[] | undefined>

function first(params: SearchParams | undefined, key: string): string | undefined {
  const raw = params?.[key]
  return Array.isArray(raw) ? raw[0] : raw
}

function readRange(params: SearchParams | undefined): DateRange | null {
  return parseRange(first(params, 'range'))
}

/** `?personen=` — 0 when absent or nonsense, which reads as "no party filter". */
function readPersons(params: SearchParams | undefined): number {
  const n = Number(first(params, 'personen'))
  return Number.isInteger(n) && n > 0 ? n : 0
}

/**
 * Everything the section renderers need for one language, loaded once per page render.
 *
 * Async because availability is the one part that is not local JSON — it comes from Tommy, keyed on
 * each villa's `tommyId`. It is fetched here rather than in the components so the calendar is part
 * of the server-rendered page (and shares one revalidating cache entry) instead of a load-time
 * request from every visitor's browser.
 */
export async function buildCtx(locale: string, searchParams?: SearchParams): Promise<RenderCtx> {
  const site = getSite(locale)
  const villas = getVillas(locale)
  const searchSlug = findPageSlugByKind(locale, 'booking')
  return {
    locale,
    site,
    villas,
    blogs: getBlogs(locale),
    pages: getPages(locale),
    villaBase: hubBase(locale, 'villas-hub'),
    blogBase: hubBase(locale, 'blogs-hub'),
    contactForm: loadForm<FormDef>('contact', locale),
    bookingSuccessUrl: bookingSuccessUrl(locale, site.booking.successUrl),
    availability: await getAvailability(Object.values(villas).map((v) => v.tommyId)),
    searchPath: searchSlug ? `/${searchSlug}` : '',
    searchRange: readRange(searchParams),
    searchPersons: readPersons(searchParams),
  }
}
