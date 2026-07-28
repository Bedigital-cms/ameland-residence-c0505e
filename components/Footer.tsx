import type { SiteContent } from '@/lib/types'

import { Icon } from './icons'
import { LocaleLink } from './LocaleLink'
import { Media } from './Media'

/** Footer link: internal ("/...") routes localise via LocaleLink; external URLs open in a new tab.
 *  LocaleLink already renders external URLs as a plain <a>, but we add target/rel here. */
function FooterLink({ url, label }: { url: string; label: string }) {
  return url.startsWith('/') ? (
    <LocaleLink href={url}>{label}</LocaleLink>
  ) : (
    <a href={url} target="_blank" rel="noreferrer">{label}</a>
  )
}

/** Map a social URL to an icon name, falling back to a generic share glyph. */
function socialIcon(url: string): string {
  const m = url.match(/(facebook|instagram|youtube|linkedin|tiktok|pinterest)/i)
  return m ? m[1].toLowerCase() : 'social'
}

/**
 * Footer in dezelfde opbouw als de bestaande site:
 *
 *   grijs blok (#edebeb + merkpatroon)
 *     rij 1:  logo links  ·  slogan + social rechts
 *     rij 2:  Contactgegevens · Ga direct naar · Extra info · keurmerk (onderaan uitgelijnd)
 *   strook eronder, BUITEN het grijs: de kleine links (Blogs, Voorwaarden, …)
 *
 * Alle teksten, links, iconen en het keurmerk komen uit `site.json → footer`.
 */
export function Footer({ site }: { site: SiteContent }) {
  const f = site.footer
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="container">
          {/* Rij 1 — daar staat dit op `justify-content: space-between` met de tweede kolom op 60%
              en zijn inhoud rechts uitgelijnd. */}
          <div className="footer-top">
            <div className="footer-col footer-brand">
              <div>
                {site.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="footer-logo" src={site.logo} alt={site.brandName} />
                ) : (
                  <div className="footer-brand-name">
                    <span>Ameland</span>
                    <em>Residence</em>
                  </div>
                )}
              </div>
            </div>

            <div className="footer-col footer-tagline">
              <div>
                <p className="footer-slogan">{f.about}</p>
                <div className="footer-socials">
                  {f.socials.map((s) => (
                    <a key={s.label} href={s.url} aria-label={s.label} target="_blank" rel="noreferrer">
                      {/* Het icoon uit de mediabibliotheek brengt zijn eigen sage cirkel mee
                          (social-icoon-facebook03.svg) — daarom geen rondje in de CSS. Zonder pad valt
                          het terug op het ingebouwde glyph in een randje. */}
                      {s.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="footer-social-icon" src={s.icon} alt="" width={40} height={40} />
                      ) : (
                        <span className="footer-social-fallback"><Icon name={socialIcon(s.url)} size={18} /></span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rij 2 — DRIE kolommen, precies zoals daar: adres, één kolom die de twee linklijsten
              náást elkaar zet (hun `.footer--links` is zelf een `inline-flex` rij), en het
              keurmerk onderaan uitgelijnd. */}
          <div className="footer-cols">
            <div className="footer-col">
              <div>
                <h4>{f.addressTitle}</h4>
                <address className="footer-address">
                  {f.address.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  {f.phone && <span><a href={`tel:${f.phone.replace(/[\s-]/g, '')}`}>{f.phone}</a></span>}
                  {f.email && <span><a href={`mailto:${f.email}`}>{f.email}</a></span>}
                </address>
              </div>
            </div>

            <div className="footer-col">
              <div className="footer-linkcols">
                {f.columns.map((col) => (
                  <div key={col.heading}>
                    <h4>{col.heading}</h4>
                    <ul>
                      {col.links.map((l) => (
                        <li key={l.label}><FooterLink url={l.url} label={l.label} /></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {f.badge && (
              <div className="footer-col footer-badge">
                <div>
                  <LocaleLink href={site.ctaUrl} aria-label={site.ctaLabel}>
                    <Media src={f.badge} alt={site.brandName} shape="square" label="Label" />
                  </LocaleLink>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onderste strook: alleen de kleine links, gecentreerd. Op de bestaande site staat hier geen
          copyrightregel; vult de klant `rightsText` toch in, dan komt die ervoor te staan. */}
      <div className="footer-links">
        <div className="container footer-links-inner">
          {f.rightsText && <span>{f.rightsText}</span>}
          <div className="footer-bottom-links">
            {f.bottomLinks.map((l) => (
              <FooterLink key={l.label} url={l.url} label={l.label} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
