import type { CSSProperties } from 'react'

import type {
  BannersSection,
  BlogCollection,
  BlogContent,
  Card,
  CardsSection,
  ColumnBlock,
  ColumnsSection,
  ReviewsSection,
  FeaturesSection,
  GallerySection,
  HeroSection,
  PageCollection,
  Section,
  SiteContent,
  TextImageSection,
  TextSection,
  VillaCollection,
  VillaContent,
} from '@/lib/types'

import Form, { type FormDef } from './Form'
import { AlbumSlider } from './AlbumSlider'
import { Gallery } from './Gallery'
import { HeroSlider } from './HeroSlider'
import { Icon } from './icons'
import { LocaleLink } from './LocaleLink'
import { Media } from './Media'
import { ReadMore } from './ReadMore'
import { ReviewCard } from './ReviewCard'
import { RichText } from './RichText'
import { TommyWidget } from './TommyWidget'
import { VideoEmbed } from './VideoEmbed'

/**
 * Every renderer this template has. All 130+ pages are composed from these — a page is a list of
 * sections in JSON, so adding a page never means adding markup. Villa and article pages have a
 * fixed layout on top (`VillaPage` / `BlogPage`) but reuse the same section vocabulary below it.
 */

/** What a section needs beyond its own data: collections for `collection` sections, plus the site
 *  config the booking widget and the contact form depend on. */
export type RenderCtx = {
  locale: string
  site: SiteContent
  villas: VillaCollection
  blogs: BlogCollection
  pages: PageCollection
  /** Hub path the villa detail pages hang under — "/villa-s" (nl), "/ferienhauser" (de). */
  villaBase: string
  /** Hub path the articles hang under — "/blogs" in both languages. */
  blogBase: string
  /** Localised contact-form definition (loadForm('contact', locale)). */
  contactForm: FormDef | null
  /** Absolute URL Tommy redirects to after a booking. */
  bookingSuccessUrl: string
}

/* ------------------------------------------------------------------ pieces */

export function SectionTitle({ title, subtitle }: { title?: string; subtitle?: string }) {
  if (!title && !subtitle) return null
  return (
    <header className="section-head">
      {title && <h2>{title}</h2>}
      {subtitle && <p className="section-sub">{subtitle}</p>}
    </header>
  )
}

function Cta({ label, url, variant = 'primary' }: { label?: string; url?: string; variant?: 'primary' | 'light' | 'ghost' }) {
  if (!label || !url) return null
  return (
    <LocaleLink className={`btn btn-${variant}`} href={url}>
      {label}
      <Icon name="arrow" size={16} />
    </LocaleLink>
  )
}

/**
 * De twee kaartvormen van de bestaande site:
 *  - `overlay` — titel als sage labelblok ONDERIN de foto, eronder alleen de link (villa's, banners)
 *  - `panel`   — titel en samenvatting in een zachtgroen tekstvlak onder de foto (artikelen)
 */
type CardVariant = 'overlay' | 'panel'

function CardTile({ card, variant }: { card: Card; variant: CardVariant }) {
  const inner = (
    <>
      <div className="card-media">
        <Media src={card.image} alt={card.title} shape="card" label="Foto" />
        {/* Blijft een kop, ook al ziet het uit als een label — anders verdwijnt de titel uit de
            documentstructuur en hoort een schermlezer alleen "meer informatie". */}
        {variant === 'overlay' && card.title && <h3 className="card-label">{card.title}</h3>}
      </div>
      {/* Artikelkaart: de titel staat in een sage balk over de volle kaartbreedte, direct onder de
          foto — daar is dat een eigen wrapper binnen `.title-holder` met `background: #94a7a8`. De
          samenvatting staat eronder op wit, in het handschriftfont. */}
      {variant === 'panel' && card.title && (
        <div className="card-titlebar"><h3>{card.title}</h3></div>
      )}
      <div className="card-body">
        {variant === 'panel' && card.text && <p>{card.text}</p>}
        {card.linkLabel && <span className="card-link">{card.linkLabel}<Icon name="arrow" size={15} /></span>}
      </div>
    </>
  )
  const className = `card card--${variant}`
  return card.url ? (
    <LocaleLink className={className} href={card.url}>{inner}</LocaleLink>
  ) : (
    <div className={className}>{inner}</div>
  )
}

export function CardGrid({ items, columns = 3, variant = 'panel' }: { items: Card[]; columns?: number; variant?: CardVariant }) {
  if (!items?.length) return null
  return (
    <div className={`cardgrid cardgrid--${columns}`}>
      {items.map((c, i) => (
        <CardTile key={(c.url || c.title || 'card') + i} card={c} variant={variant} />
      ))}
    </div>
  )
}

/**
 * Doorlopende band, van rechts naar links. Twee identieke reeksen staan achter elkaar; de animatie
 * schuift precies één reeks op (-50% van het spoor), dus het moment dat hij terugspringt valt samen
 * met een identiek beeld en is onzichtbaar. Puur CSS — geen sliderbibliotheek, geen JS.
 *
 * De duur volgt de bestaande site: hun swiper doet 5,5s per kaart, dus één ronde is
 * `aantal kaarten * 5,5s`. De tweede reeks is `aria-hidden`, anders staan alle links dubbel in de
 * toegankelijkheidsboom.
 */
function CardMarquee({ items, variant }: { items: Card[]; variant: CardVariant }) {
  const set = items.map((c, i) => <CardTile key={(c.url || c.title || 'card') + i} card={c} variant={variant} />)
  return (
    <div className="marquee" style={{ '--marquee-duration': `${items.length * 5.5}s` } as CSSProperties}>
      <div className="marquee-track">
        <div className="marquee-set">{set}</div>
        <div className="marquee-set" aria-hidden="true">{set}</div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- sections */

function HeroBlock({ data }: { data: HeroSection }) {
  const hasMedia = !!(data.video || data.images.length || data.mobileImages.length)
  if (!hasMedia && !data.title) return null
  return (
    <section className={`hero${data.video ? ' hero--video' : ''}`}>
      {data.video ? (
        <video className="hero-video" autoPlay muted loop playsInline poster={data.images[0] || undefined}>
          <source src={data.video} type="video/mp4" />
        </video>
      ) : (
        <HeroSlider images={data.images} mobileImages={data.mobileImages} alt={data.title || 'Ameland Residence'} />
      )}
      {(data.title || data.subtitle || data.ctaLabel) && (
        <div className={`hero-overlay${data.align === 'center' ? ' hero-overlay--center' : ''}`}>
          <div className="container">
            {data.title && <p className="hero-title">{data.title}</p>}
            {data.subtitle && <p className="hero-sub">{data.subtitle}</p>}
            {/* `.hero-overlay .btn` geeft de knop hier zijn eigen doorschijnende stijl. */}
            <Cta label={data.ctaLabel} url={data.ctaUrl} />
          </div>
        </div>
      )}
    </section>
  )
}

function TextBlock({ data }: { data: TextSection }) {
  return (
    <section className="section section-text">
      <div className="container container--narrow">
        <SectionTitle title={data.title} subtitle={data.subtitle} />
        {data.paragraphs.map((html, i) => (
          <RichText key={i} html={html} className="prose" />
        ))}
        <Cta label={data.ctaLabel} url={data.ctaUrl} />
      </div>
    </section>
  )
}

function TextImageBlock({ data }: { data: TextImageSection }) {
  return (
    <section className={`section section-split${data.reverse ? ' is-reverse' : ''}`}>
      <div className="container split">
        <div className="split-text">
          <SectionTitle title={data.title} subtitle={data.subtitle} />
          {data.paragraphs.map((html, i) => (
            <RichText key={i} html={html} className="prose" />
          ))}
          <Cta label={data.ctaLabel} url={data.ctaUrl} />
        </div>
        <div className="split-media">
          <Media src={data.image} alt={data.title} shape="portrait" label="Foto" />
        </div>
      </div>
    </section>
  )
}

function ColumnBlockView({ block, locale }: { block: ColumnBlock; locale: string }) {
  if (block.kind === 'text') {
    return (
      <div className="col-text">
        {block.title && <h2>{block.title}</h2>}
        {block.lead && <p className="col-lead">{block.lead}</p>}
        {block.paragraphs.map((html, i) => (
          <RichText key={i} html={html} className="prose" />
        ))}
        <Cta label={block.ctaLabel} url={block.ctaUrl} variant="light" />
      </div>
    )
  }
  if (block.kind === 'list') {
    // Geen enkel item met tweede regel = een checklist ("Sauna", "Solarium"): kleiner vinkje en een
    // kleiner label, precies zoals de bestaande site die twee varianten uit elkaar houdt.
    const compact = block.items.every((it) => !it.text)
    return (
      <ul className={`col-list${compact ? ' col-list--compact' : ''}`}>
        {block.items.map((it, i) => (
          <li key={it.label + i}>
            {/* Het eigen USP-icoon uit de mediabibliotheek (32x32 lijntekening, zoals op de bestaande
                site). Staat er geen pad in de content, dan valt het terug op het vinkje. */}
            {it.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="col-list-icon-img" src={it.icon} alt="" width={compact ? 20 : 32} height={compact ? 20 : 32} />
            ) : (
              <span className="col-list-icon"><Icon name="check" size={16} /></span>
            )}
            <span>
              <strong>{it.label}</strong>
              {it.text && <em>{it.text}</em>}
            </span>
          </li>
        ))}
      </ul>
    )
  }
  if (block.kind === 'gallery') {
    // Meerdere foto's = de automatische crossfade-slider van de bestaande site; één foto blijft
    // gewoon staan. Een leeg pad valt terug op de <Media>-placeholder in plaats van een kapot beeld.
    if (block.images.filter(Boolean).length === 0) {
      return <Media src="" alt="" shape="card" label="Foto" />
    }
    return <AlbumSlider images={block.images} alt="" locale={locale} />
  }
  if (block.kind === 'video') {
    return <VideoEmbed videoId={block.videoId} poster={block.poster} title="Ameland Residence" />
  }
  if (block.kind === 'faq') {
    return (
      <div className="faq">
        {block.items.map((item, i) => (
          <details className="faq-item" key={item.q + i}>
            <summary>
              {item.q}
              <span className="faq-caret" aria-hidden="true" />
            </summary>
            <div className="faq-answer">
              {item.a.map((html, j) => (
                <RichText key={j} html={html} className="prose" />
              ))}
            </div>
          </details>
        ))}
      </div>
    )
  }
  return (
    <div className="col-group">
      {block.blocks.map((b, i) => (
        <ColumnBlockView key={i} block={b} locale={locale} />
      ))}
    </div>
  )
}

function ColumnsBlock({ data, locale }: { data: ColumnsSection; locale: string }) {
  // Tekst + USP-lijst ernaast is op de bestaande site 70/30, niet half-half — dat leest een stuk
  // beter, want de lijst is smal en de lopende tekst niet.
  const textWithList = data.columns.length === 2 && data.columns[0].kind === 'text' && data.columns[1].kind === 'list'
  // Van rand tot rand: 40% beeld tegen de linkerrand, 60% tekst. Buiten `.container`, want die zou
  // de foto juist van de rand af trekken.
  // `stack` zet alles onder elkaar; dan is er geen kolomverdeling om te kiezen.
  const grid = data.bleed
    ? 'cols cols--4060'
    : `container cols ${data.stack ? 'cols--1' : textWithList ? 'cols--7030' : `cols--${Math.min(data.columns.length, 4)}`}`
  // Expliciete verhoudingen en ruimte uit de content winnen van de standaarden hierboven.
  // Bij `stack` liggen de kolommen vast op één per rij — een opgegeven verdeling zou dat weer breken.
  // De verdeling gaat als CUSTOM PROPERTY mee, niet als `grid-template-columns` zelf: een inline
  // eigenschap verslaat elke media query, waardoor deze sectie op een telefoon in drie kolommen
  // bleef staan (en de tekst tot ~150px versmalde). Nu vult de variabele alleen de standaardwaarde
  // in en kan de responsive regel in globals.css de kolommen alsnog laten stapelen.
  const gridStyle: CSSProperties =
    !data.stack && data.widths?.length === data.columns.length
      ? ({ '--cols-template': data.widths.map((w) => `${w}fr`).join(' ') } as CSSProperties)
      : {}
  if (data.space?.gap !== undefined) gridStyle.gap = `${data.space.gap}px`
  // Smallere, gecentreerde baan (hun videopagina staat op 800px). `width` erbij, anders houdt
  // `.container` zijn eigen breedte en doet de max-width niets.
  if (data.maxWidth !== undefined) {
    gridStyle.maxWidth = `${data.maxWidth}px`
    gridStyle.width = '100%'
    gridStyle.marginInline = 'auto'
  }

  const sectionStyle: CSSProperties = {}
  if (data.space?.top !== undefined) sectionStyle.paddingTop = `${data.space.top}px`
  if (data.space?.bottom !== undefined) sectionStyle.paddingBottom = `${data.space.bottom}px`
  return (
    <section
      className={[
        'section section-columns',
        data.background ? `section-columns--${data.background}` : '',
        data.bleed ? 'section-columns--bleed' : '',
        data.stack ? 'section-columns--stack' : '',
      ].filter(Boolean).join(' ')}
      style={sectionStyle}
    >
      <div className={grid} style={gridStyle}>
        {data.columns.map((block, i) => (
          <div className="col" key={i}>
            <ColumnBlockView block={block} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Labels voor de in-/uitklapknop van een review. Alleen nl en de zijn actief. */
const REVIEW_LABELS: Record<string, { more: string; less: string }> = {
  nl: { more: 'Lees meer', less: 'Lees minder' },
  de: { more: 'Mehr lesen', less: 'Weniger lesen' },
}

/** Beoordelingen uit de content, in een raster dat van vier naar één kolom zakt. Geen horizontale
 *  scrollbalk dus, ook niet met meer dan vier reviews — die schuiven simpelweg naar de volgende rij. */
function ReviewsBlock({ data, locale }: { data: ReviewsSection; locale: string }) {
  const labels = REVIEW_LABELS[locale] || REVIEW_LABELS.nl
  return (
    <section className="section section-reviews">
      <div className="container">
        <SectionTitle title={data.title} subtitle={data.subtitle} />
        {data.items.length > 0 && (
          <div className="reviewgrid">
            {data.items.map((review, i) => (
              <ReviewCard key={review.author + i} review={review} moreLabel={labels.more} lessLabel={labels.less} />
            ))}
          </div>
        )}
        <Cta label={data.ctaLabel} url={data.ctaUrl} variant="light" />
      </div>
    </section>
  )
}

function CardsBlock({ data }: { data: CardsSection }) {
  return (
    <section className="section section-cards">
      <div className="container">
        <SectionTitle title={data.title} />
        {/* Deze banners staan er op de bestaande site met het labelblok in de foto, net als de
            villakaarten — titel op het beeld, alleen de link eronder. */}
        <CardGrid items={data.items} columns={Math.min(data.items.length, 3)} variant="overlay" />
      </div>
    </section>
  )
}

/**
 * Sfeerband onder de villa's: één doorlopende rij foto's die van rechts naar links schuift, zoals
 * hun swiper op dit blok. Zelfde opzet als `CardMarquee` — twee identieke reeksen achter elkaar en
 * de animatie schuift precies één reeks op, dus de terugsprong valt samen met een identiek beeld.
 *
 * Met minder dan twee foto's valt hij terug op een stilstaande rij: dupliceren en animeren van één
 * beeld levert alleen een zichtbare sprong op.
 */
function BannersBlock({ data }: { data: BannersSection }) {
  const strip = data.items.map((b, i) => (
    <Media key={b.image + i} src={b.image} alt="" shape="portrait" label="Sfeerbeeld" />
  ))
  const animate = data.items.length > 1

  return (
    <section className="section section-banners">
      <SectionTitle title={data.title} />
      {animate ? (
        <div
          className="bannerstrip marquee"
          style={{ '--marquee-duration': `${data.items.length * 5.5}s` } as CSSProperties}
        >
          <div className="marquee-track">
            <div className="marquee-set bannerstrip-set">{strip}</div>
            <div className="marquee-set bannerstrip-set" aria-hidden="true">{strip}</div>
          </div>
        </div>
      ) : (
        <div className="bannerstrip">
          <div className="bannerstrip-set">{strip}</div>
        </div>
      )}
    </section>
  )
}

/** Villa/blog cards straight from the collection file — new key in JSON, new card here. Detail URLs
 *  are nested under the hub (`ctx.villaBase`/`ctx.blogBase`), which differs per language. */
function CollectionBlock({ source, title, linkLabel, marquee, ctx }: { source: 'villas' | 'blogs'; title: string; linkLabel: string; marquee?: boolean; ctx: RenderCtx }) {
  const items: Card[] =
    source === 'villas'
      ? Object.entries(ctx.villas).map(([slug, v]) => ({
          title: v.title,
          text: v.subtitle || '',
          image: v.cardImage,
          url: `${ctx.villaBase}/${slug}`,
          linkLabel: v.linkLabel || linkLabel,
        }))
      : Object.entries(ctx.blogs).map(([slug, b]) => ({
          title: b.title,
          text: b.excerpt,
          image: b.cardImage || b.image,
          url: `${ctx.blogBase}/${slug}`,
          linkLabel: b.linkLabel || linkLabel,
        }))
  // Villa's krijgen het labelblok in de foto, artikelen het zachtgroene tekstvlak — zoals daar.
  const variant: CardVariant = source === 'villas' ? 'overlay' : 'panel'
  // Onder de vier kaartbreedtes valt er niets te schuiven; dan is een raster netter dan een band
  // die halfleeg heen en weer kruipt.
  const asMarquee = marquee && items.length >= 4

  return (
    <section className="section section-cards">
      {title && (
        <div className="container">
          <SectionTitle title={title} />
        </div>
      )}
      {/* De band loopt van rand tot rand, zodat de volgende kaart aangesneden in beeld staat. */}
      {asMarquee ? <CardMarquee items={items} variant={variant} /> : (
        <div className="container">
          <CardGrid items={items} columns={3} variant={variant} />
        </div>
      )}
    </section>
  )
}

function GalleryBlock({ data }: { data: GallerySection }) {
  return (
    <section className="section section-gallery">
      <div className="container">
        <Gallery images={data.images} alt="Foto" />
      </div>
    </section>
  )
}

export function FeaturesBlock({ data }: { data: FeaturesSection }) {
  return (
    <section className="section section-features">
      <div className="container features">
        {data.groups.map((g) => (
          <div className="feature-group" key={g.heading}>
            <h3>{g.heading}</h3>
            <ul>
              {g.items.map((item) => (
                <li key={item}>
                  <Icon name="check" size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function BookingBlock({ widget, accommodationId, ctx }: { widget: string; accommodationId: string; ctx: RenderCtx }) {
  return (
    <section className="section section-booking" id="boeken">
      <div className="container">
        <TommyWidget
          widget={widget}
          accommodationId={accommodationId}
          booking={ctx.site.booking}
          successUrl={ctx.bookingSuccessUrl}
        />
      </div>
    </section>
  )
}

function FormBlock({ slug, intro, ctx }: { slug: string; intro?: TextSection; ctx: RenderCtx }) {
  const f = ctx.site.footer
  return (
    <section className="section section-contact" id="contact">
      <div className="container contact-grid">
        <div className="contact-info">
          {/* The page's own contact copy when it has some — otherwise the address from site.json.
              Printing both would repeat the same address twice on the page. */}
          {intro ? (
            <>
              <SectionTitle title={intro.title} subtitle={intro.subtitle} />
              {intro.paragraphs.map((html, i) => (
                <RichText key={i} html={html} className="prose" />
              ))}
            </>
          ) : (
            <>
              <h2>{f.addressTitle}</h2>
              <ul className="contact-list">
                {f.address.length > 0 && (
                  <li>
                    <span className="contact-list-label"><Icon name="pin" size={16} /></span>
                    <span>{f.address.join(', ')}</span>
                  </li>
                )}
                {f.phone && (
                  <li>
                    <span className="contact-list-label"><Icon name="phone" size={16} /></span>
                    <a href={`tel:${f.phone.replace(/[\s-]/g, '')}`}>{f.phone}</a>
                  </li>
                )}
                {f.email && (
                  <li>
                    <span className="contact-list-label"><Icon name="mail" size={16} /></span>
                    <a href={`mailto:${f.email}`}>{f.email}</a>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
        <div className="contact-form">
          <Form slug={slug} def={ctx.contactForm} />
        </div>
      </div>
    </section>
  )
}

/** Generated HTML sitemap — always in sync because it reads the collections, not a copied list. */
function SitemapBlock({ ctx }: { ctx: RenderCtx }) {
  const groups: { heading: string; links: { label: string; url: string }[] }[] = [
    {
      heading: ctx.site.brandName,
      links: Object.entries(ctx.pages)
        .filter(([, p]) => p.kind !== 'sitemap')
        .map(([slug, p]) => ({ label: p.title || slug, url: `/${slug}` })),
    },
    { heading: 'Villa’s', links: Object.entries(ctx.villas).map(([slug, v]) => ({ label: v.title, url: `${ctx.villaBase}/${slug}` })) },
    { heading: 'Blogs', links: Object.entries(ctx.blogs).map(([slug, b]) => ({ label: b.title, url: `${ctx.blogBase}/${slug}` })) },
  ]
  return (
    <section className="section section-sitemap">
      <div className="container sitemap-grid">
        {groups.map((g) => (
          <div key={g.heading}>
            <h3>{g.heading}</h3>
            <ul>
              {g.links.map((l) => (
                <li key={l.url}><LocaleLink href={l.url}>{l.label}</LocaleLink></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- dispatch */

export function SectionView({ section, ctx }: { section: Section; ctx: RenderCtx }) {
  switch (section.type) {
    case 'hero': return <HeroBlock data={section} />
    case 'text': return <TextBlock data={section} />
    case 'textImage': return <TextImageBlock data={section} />
    case 'columns': return <ColumnsBlock data={section} locale={ctx.locale} />
    case 'cards': return <CardsBlock data={section} />
    case 'reviews': return <ReviewsBlock data={section} locale={ctx.locale} />
    case 'banners': return <BannersBlock data={section} />
    case 'collection': return <CollectionBlock source={section.source} title={section.title} linkLabel={section.linkLabel} marquee={section.marquee} ctx={ctx} />
    case 'gallery': return <GalleryBlock data={section} />
    case 'features': return <FeaturesBlock data={section} />
    case 'booking': return <BookingBlock widget={section.widget} accommodationId={section.accommodationId} ctx={ctx} />
    case 'form': return <FormBlock slug={section.slug} intro={section.intro} ctx={ctx} />
    case 'sitemap': return <SitemapBlock ctx={ctx} />
    default: return null
  }
}

export function Sections({ sections, ctx }: { sections: Section[]; ctx: RenderCtx }) {
  return (
    <>
      {sections.map((s, i) => (
        <SectionView key={`${s.type}-${i}`} section={s} ctx={ctx} />
      ))}
    </>
  )
}

/* ----------------------------------------------------------- page layouts */

/** Villa detail: hero → USP strip → intro + highlights → gallery → indeling → booking → extras. */
export function VillaPage({ villa, ctx }: { villa: VillaContent; ctx: RenderCtx }) {
  return (
    <>
      <HeroBlock data={{ type: 'hero', title: '', ctaLabel: '', ctaUrl: '', video: '', mobileVideo: '', images: villa.hero.images, mobileImages: villa.hero.mobileImages }} />

      {villa.usps.length > 0 && (
        <section className="uspbar">
          <div className="container">
            {villa.usps.map((u) => (
              <div className="usp" key={u.label}>
                <Icon name="check" size={18} />
                <span>{u.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section section-villa-intro">
        <div className="container villa-intro">
          <div className="villa-intro-text">
            <h1>{villa.title}</h1>
            {villa.paragraphs.map((html, i) => (
              <RichText key={i} html={html} className="prose" />
            ))}
            {villa.moreParagraphs.length > 0 && (
              <ReadMore moreLabel="Lees meer" lessLabel="Lees minder">
                {villa.moreParagraphs.map((html, i) => (
                  <RichText key={i} html={html} className="prose" />
                ))}
              </ReadMore>
            )}
          </div>
          {villa.highlights.length > 0 && (
            <aside className="villa-highlights">
              <h3>Goed om te weten</h3>
              <ul>
                {villa.highlights.map((h) => (
                  <li key={h}><Icon name="check" size={15} /><span>{h}</span></li>
                ))}
              </ul>
              <a className="btn btn-primary" href="#boeken">
                Bekijk beschikbaarheid
                <Icon name="calendar" size={16} />
              </a>
            </aside>
          )}
        </div>
      </section>

      {villa.gallery.length > 0 && <GalleryBlock data={{ type: 'gallery', images: villa.gallery }} />}
      {villa.features.length > 0 && <FeaturesBlock data={{ type: 'features', groups: villa.features }} />}
      {villa.tommyId && <BookingBlock widget="boeken" accommodationId={villa.tommyId} ctx={ctx} />}
      <Sections sections={villa.extraSections} ctx={ctx} />
    </>
  )
}

/** Blog article: image + title + heading/paragraph body, then a villa grid as the conversion step. */
export function BlogPage({ blog, ctx }: { blog: BlogContent; ctx: RenderCtx }) {
  return (
    <>
      <article className="section article">
        <div className="container container--narrow">
          <h1>{blog.title}</h1>
          {blog.excerpt && <p className="article-lead">{blog.excerpt}</p>}
          {blog.image && (
            <div className="article-figure">
              <Media src={blog.image} alt={blog.title} shape="wide" label="Foto" />
            </div>
          )}
          {blog.blocks.map((b, i) => (
            <section key={i}>
              {b.heading && <h2>{b.heading}</h2>}
              {b.paragraphs.map((html, j) => (
                <RichText key={j} html={html} className="prose" />
              ))}
            </section>
          ))}
        </div>
      </article>
      <CollectionBlock source="villas" title="Onze villa's" linkLabel="Meer informatie" ctx={ctx} />
    </>
  )
}
