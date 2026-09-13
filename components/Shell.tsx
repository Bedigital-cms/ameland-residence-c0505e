import type { ReactNode } from 'react'

import { getSite } from '@/content/site'
import { defaultLocale, hideDefaultPrefix } from '@/lib/i18n'

import { CmsEditRuntime } from './CmsEditRuntime'
import { Footer } from './Footer'
import { Header } from './Header'
import { LocaleProvider } from './LocaleLink'

/**
 * The page frame every route uses: sticky header + content + footer. The LocaleProvider makes the
 * locale and routing config available to every LocaleLink/RichText below, so nav, footer and
 * in-body links all get the right prefix (or none, for a language served on clean URLs).
 *
 * `editMode` is true only when the request has `?cms-edit=1` (same derivation as `buildCtx`). The
 * Visual Editor runtime is mounted in that case and nowhere else — public visitors never load it.
 */
export function Shell({
  locale,
  children,
  editMode = false,
  cmsFile,
}: {
  locale: string
  children: ReactNode
  editMode?: boolean
  cmsFile?: string
}) {
  const site = getSite(locale)
  return (
    <LocaleProvider locale={locale} defaultLocale={defaultLocale()} hideDefaultPrefix={hideDefaultPrefix()}>
      {editMode ? <CmsEditRuntime locale={locale} file={cmsFile} /> : null}
      <Header site={site} locale={locale} />
      <main>{children}</main>
      <Footer site={site} />
    </LocaleProvider>
  )
}
