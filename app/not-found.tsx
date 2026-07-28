import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LocaleLink, LocaleProvider } from '@/components/LocaleLink'
import { findPageSlugByKind } from '@/content/pages'
import { getSite } from '@/content/site'
import { defaultLocale, hideDefaultPrefix } from '@/lib/i18n'
import { localeDir } from '@/lib/locales'

/** Copy per language — the 404 is served outside the [locale] segment, so it can't read content
 *  for the visitor's language; it falls back to the site's default locale. */
const COPY: Record<string, { title: string; text: string; home: string; villas: string }> = {
  nl: {
    title: 'Pagina niet gevonden',
    text: 'De pagina die u zoekt bestaat niet (meer). Ga terug naar de homepage of bekijk onze villa’s.',
    home: 'Naar de homepage',
    villas: 'Bekijk onze villa’s',
  },
  de: {
    title: 'Seite nicht gefunden',
    text: 'Die gesuchte Seite existiert nicht (mehr). Zurück zur Startseite oder entdecken Sie unsere Ferienhäuser.',
    home: 'Zur Startseite',
    villas: 'Unsere Ferienhäuser',
  },
}

export default function NotFound() {
  const locale = defaultLocale()
  const site = getSite(locale)
  const copy = COPY[locale] || COPY.nl
  const villaHub = findPageSlugByKind(locale, 'villas-hub')

  return (
    <html lang={locale} dir={localeDir(locale)}>
      <body>
        <LocaleProvider locale={locale} defaultLocale={locale} hideDefaultPrefix={hideDefaultPrefix()}>
          <Header site={site} locale={locale} />
          <main>
            <section className="section pagehero">
              <div className="container container--narrow">
                <span className="eyebrow">404</span>
                <h1>{copy.title}</h1>
                <p>{copy.text}</p>
                <div className="pagehero-actions">
                  <LocaleLink className="btn btn-primary" href="/">{copy.home}</LocaleLink>
                  {villaHub && <LocaleLink className="btn btn-light" href={`/${villaHub}`}>{copy.villas}</LocaleLink>}
                </div>
              </div>
            </section>
          </main>
          <Footer site={site} />
        </LocaleProvider>
      </body>
    </html>
  )
}
