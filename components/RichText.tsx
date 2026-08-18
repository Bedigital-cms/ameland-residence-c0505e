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

/**
 * Blokelementen die de CMS-export oplevert. Staat er zo'n tag vooraan, dan brengt de tekst zijn
 * eigen blokopmaak mee (een lijst, een kop) en moet er geen <p> omheen.
 */
const BLOCK_START = /^\s*<\s*(?:ul|ol|h[1-6]|p|div|table|blockquote)\b/i
/** Een lege regel — twee enters achter elkaar — scheidt alinea's; losse enters zijn regelafbrekingen. */
const PARAGRAPH_SPLIT = /(?:\r?\n\s*){2,}|(?:<br\s*\/?>\s*){2,}/i
const LINE_BREAK = /\r?\n/g

/**
 * Zet losse tekst om in echte alinea's.
 *
 * De CMS-export levert de body van een pagina aan als een lijst losse strings zonder <p> eromheen:
 * de alinea-indeling zit in de opsplitsing zelf, en binnen één string in lege regels. Zonder <p>
 * grijpt de `p { margin: 0 0 1.05em }` uit de stylesheet nergens op aan, en plakken alle alinea's
 * aan elkaar tot één blok tekst — precies wat er op /over-ameland en de villapagina's gebeurde.
 *
 * Draagt de string zijn eigen blokopmaak (een <ul>, een <h3>), dan blijft hij ongemoeid: die
 * elementen mogen niet in een <p> staan, en de browser breekt de alinea daar anders zelf open.
 */
function toParagraphs(html: string): string {
  const trimmed = html.trim()
  if (!trimmed || BLOCK_START.test(trimmed)) return trimmed
  return trimmed
    .split(PARAGRAPH_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean)
    // Enkele enters binnen een alinea zijn regelafbrekingen, geen nieuwe alinea.
    .map((part) => `<p>${part.replace(LINE_BREAK, '<br />')}</p>`)
    .join('')
}

export function RichText({ html, className }: { html: string; className?: string }) {
  const { locale, defaultLocale, hideDefaultPrefix } = useLocaleConfig()
  const localised = toParagraphs(html).replace(/href="(\/[^"]*)"/g, (_m, url: string) => `href="${localeHref(locale, url, { defaultLocale, hideDefaultPrefix })}"`)
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
