import type { HomeContent } from '@/lib/types'

import { loadContent } from './load'

/** The homepage's section list + SEO. */
export function getHome(locale: string): HomeContent {
  return loadContent<HomeContent>('home', locale)
}
