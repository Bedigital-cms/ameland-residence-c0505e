import type { VillaCollection, VillaContent } from '@/lib/types'

import { loadContent } from './load'

/** slug → villa, for one language. */
export function getVillas(locale: string): VillaCollection {
  return loadContent<VillaCollection>('villas', locale)
}

/** Every villa slug in this language — feeds `generateStaticParams` and the villa card grids. */
export function getVillaSlugs(locale: string): string[] {
  return Object.keys(getVillas(locale))
}

export function getVilla(locale: string, slug: string): VillaContent | undefined {
  return getVillas(locale)[slug]
}
