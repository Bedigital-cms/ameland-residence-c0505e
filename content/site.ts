import type { SiteContent } from '@/lib/types'

import { loadContent } from './load'

/** Brand, navigation, footer and Tommy account settings for one language. */
export function getSite(locale: string): SiteContent {
  return loadContent<{ site: SiteContent }>('site', locale).site
}
