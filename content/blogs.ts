import type { BlogCollection, BlogContent } from '@/lib/types'

import { loadContent } from './load'

/** slug → article, for one language. */
export function getBlogs(locale: string): BlogCollection {
  return loadContent<BlogCollection>('blogs', locale)
}

/** Every article slug in this language — feeds `generateStaticParams` and the blog overview. */
export function getBlogSlugs(locale: string): string[] {
  return Object.keys(getBlogs(locale))
}

export function getBlog(locale: string, slug: string): BlogContent | undefined {
  return getBlogs(locale)[slug]
}
