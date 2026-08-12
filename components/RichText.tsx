'use client'

import { localeHref } from '@/lib/href'

import { useLocaleConfig } from './LocaleLink'

/**
 * Renders a content HTML string (the limited subset the CMS produces: <strong> <em> <a> <br> <ul>
 * <li> <h3>), localising every internal link on the way out.
 *
 * Content JSON stores links prefix-free ("/villa-zee") exactly like nav/footer links do, so the
 * same rule has to apply inside body text: prepend "/<locale>" unless this language is served on
 * clean URLs. Doing it here means editors never have to think about language prefixes.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const { locale, defaultLocale, hideDefaultPrefix } = useLocaleConfig()
  const localised = html.replace(/href="(\/[^"]*)"/g, (_m, url: string) => `href="${localeHref(locale, url, { defaultLocale, hideDefaultPrefix })}"`)
  return <div className={className} dangerouslySetInnerHTML={{ __html: localised }} />
}

/** Convenience: a list of paragraphs from content, each rendered through <RichText>. */
export function RichTextList({ items, className }: { items: string[]; className?: string }) {
  if (!items?.length) return null
  return (
    <div className={className}>
      {items.map((html, i) => (
        <RichText key={i} html={html} />
      ))}
    </div>
  )
}
