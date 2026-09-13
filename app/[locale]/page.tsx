import type { Metadata } from 'next'

import { Sections } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { buildCtx, type SearchParams } from '@/content/ctx'
import { getHome } from '@/content/home'
import { getSite } from '@/content/site'
import { metadataFrom } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const site = getSite(locale)
  return metadataFrom(getHome(locale).seo, `${site.brandName} — ${site.tagline}`)
}

/** Homepage. Like every other page it is just a list of sections from content/<locale>/home.json. */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale } = await params
  const home = getHome(locale)
  return (
    <Shell locale={locale}>
      <Sections sections={home.sections} ctx={await buildCtx(locale, await searchParams, 'home.json')} />
    </Shell>
  )
}
