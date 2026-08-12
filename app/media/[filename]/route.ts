/**
 * Site-side media serving. Content references images as `/media/<filename>` (a stable, same-origin,
 * portable path). The actual bytes live in the CMS media library (admin-managed; local disk in dev,
 * Cloudflare R2 in prod) — the site never stores media, so an admin can upload/replace/delete from
 * the CMS Media section and the site reflects it without a redeploy.
 *
 * This route 302-redirects to the CMS's PUBLIC, tenant-scoped media endpoint, passing the tenant
 * slug so the CMS scopes the lookup to THIS client (the site's own host doesn't match a CMS domain).
 * The CMS endpoint streams the file (local) or redirects on to R2 (prod) — env-driven there, no
 * change needed here.
 *
 * Env (set per tenant, e.g. in .env.local / hosting env):
 *   MEDIA_PUBLIC_BASE   CMS public media base, e.g. http://localhost:3000/media  (prod: https://cms…/media)
 *   MEDIA_TENANT_SLUG   this tenant's slug: ameland-residence  (so the CMS scopes the lookup)
 */
export const dynamic = 'force-dynamic'

const BASE = (process.env.MEDIA_PUBLIC_BASE || process.env.NEXT_PUBLIC_MEDIA_BASE || '').replace(/\/+$/, '')
const TENANT_SLUG = process.env.MEDIA_TENANT_SLUG || process.env.NEXT_PUBLIC_MEDIA_TENANT_SLUG || ''

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await params
  if (!BASE || !filename) return new Response('Not found', { status: 404 })
  const q = TENANT_SLUG ? `?tenant=${encodeURIComponent(TENANT_SLUG)}` : ''
  return Response.redirect(`${BASE}/${encodeURIComponent(filename)}${q}`, 302)
}
