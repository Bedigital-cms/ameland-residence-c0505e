import { Suspense, type CSSProperties, type ReactNode } from 'react'

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

import { featureText } from '@/lib/features'
import { relatedArticles } from '@/lib/related'
import { t } from '@/lib/ui-text'
import { villaFacts } from '@/lib/villa-facts'

import Form, { type FormDef } from './Form'
import { RelatedArticles } from './RelatedArticles'
import { VillaFilterState } from './VillaFilterState'
import { VillaKeyFacts } from './VillaKeyFacts'
import { VILLA_SECTIONS, VillaNav, villaNavItems } from './VillaNav'
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

/**
 * A section's own heading. Renders an <h2> by default.
 *
 * `suppressTitle` drops the heading text but keeps the subtitle: used when this section's title has
 * been promoted to the page's <h1> in the hero (see `lib/page-heading.ts`), so the same words are not
 * printed twice on the page.
 */
export function SectionTitle({
  title,
  subtitle,
  suppressTitle = false,
  headingLevel = 2,
}: {
  title?: string
  subtitle?: string
  suppressTitle?: boolean
  /** 1 makes this section's title the page <h1> — for pages with no hero to host it. Default 2. */
  headingLevel?: 1 | 2
}) {
  const showTitle = !!title && !suppressTitle
  if (!showTitle && !subtitle) return null
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <header className="section-head">
      {showTitle && <H>{title}</H>}
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

/** A short, icon-led fact shown on a villa card. Derived from the villa's own text — never invented. */
export type CardFact = { icon: string; label: string }

/**
 * `level` is the heading level for the card title. It is <h3> when the section above the grid has its
 * own <h2>, but <h2> when that section title was promoted to the page <h1> (villa hub, blog hub) —
 * otherwise the cards would jump h1 -> h3 and skip a level.
 */
function CardTile({
  card,
  variant,
  level = 3,
  facts,
}: {
  card: Card
  variant: CardVariant
  level?: 2 | 3
  /** Scannable attributes for a villa card (sauna, pets, EV, location). */
  facts?: CardFact[]
}) {
  const H = level === 2 ? 'h2' : 'h3'
  const inner = (
    <>
      <div className="card-media">
        <Media src={card.image} alt={card.title} shape="card" label="Foto" sizes="(max-width: 700px) 100vw, (max-width: 900px) 50vw, 33vw" />
        {/* Blijft een kop, ook al ziet het uit als een label — anders verdwijnt de titel uit de
            documentstructuur en hoort een schermlezer alleen "meer informatie". */}
        {variant === 'overlay' && card.title && <H className="card-label">{card.title}</H>}
      </div>
      {/* Artikelkaart: de titel staat in een sage balk over de volle kaartbreedte, direct onder de
          foto — daar is dat een eigen wrapper binnen `.title-holder` met `background: #94a7a8`. De
          samenvatting staat eronder op wit, in het handschriftfont. */}
      {variant === 'panel' && card.title && (
        <div className="card-titlebar"><H>{card.title}</H></div>
      )}
      <div className="card-body">
        {variant === 'panel' && card.text && <p>{card.text}</p>}
        {/*
          Villakaarten: een compacte feitenrij zodat de kaarten te scannen zijn zonder ze te openen —
          de opdracht vraagt hier expliciet om. Alleen feiten die de villapagina zelf noemt.
          `aria-hidden` op de iconen; het label is de tekst.
        */}
        {facts && facts.length > 0 && (
          <ul className="card-facts">
            {facts.map((f) => (
              <li key={f.label}>
                <Icon name={f.icon} size={14} />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        )}
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

export function CardGrid({
  items,
  columns = 3,
  variant = 'panel',
  level,
  facts,
}: {
  items: Card[]
  columns?: number
  variant?: CardVariant
  level?: 2 | 3
  /** Per-card facts, keyed by the card's url — villa grids pass these, other grids do not. */
  facts?: Record<string, CardFact[]>
}) {
  if (!items?.length) return null
  return (
    <div className={`cardgrid cardgrid--${columns}`}>
      {items.map((c, i) => (
        <CardTile
          key={(c.url || c.title || 'card') + i}
          card={c}
          variant={variant}
          level={level}
          facts={facts?.[c.url]}
        />
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
function CardMarquee({
  items,
  variant,
  level,
  facts,
}: {
  items: Card[]
  variant: CardVariant
  level?: 2 | 3
  facts?: Record<string, CardFact[]>
}) {
  const set = items.map((c, i) => (
    <CardTile key={(c.url || c.title || 'card') + i} card={c} variant={variant} level={level} facts={facts?.[c.url]} />
  ))
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

/**
 * Full-bleed hero.
 *
 * `heading` turns the overlay title into the page's real <h1> (instead of the decorative <p> this
 * component used for every hero). Pass it on exactly ONE hero per page — the page routes derive it
 * from existing content via `lib/page-heading.ts`, so no new copy is written and no page ends up with
 * two H1s. Without `heading` the title stays a <p>, which is right for a hero further down a page
 * that already has its H1 elsewhere.
 *
 * `crumbs` renders the breadcrumb trail over the image, above the H1 — the placement the task
 * document asks for on subpages.
 */
function HeroBlock({
  data,
  heading,
  crumbs,
}: {
  data: HeroSection
  /** Render the title as this page's <h1>. */
  heading?: boolean
  /** Breadcrumb trail placed above the title, inside the overlay. */
  crumbs?: ReactNode
}) {
  const hasMedia = !!(data.video || data.images.length || data.mobileImages.length)
  if (!hasMedia && !data.title && !crumbs) return null
  const Title = heading ? 'h1' : 'p'
  return (
    <section className={`hero${data.video ? ' hero--video' : ''}`}>
      {data.video ? (
        <video className="hero-video" autoPlay muted loop playsInline poster={data.images[0] || undefined}>
          <source src={data.video} type="video/mp4" />
        </video>
      ) : (
        <HeroSlider images={data.images} mobileImages={data.mobileImages} alt={data.title || 'Ameland Residence'} />
      )}
      {(data.title || data.subtitle || data.ctaLabel || crumbs) && (
        <div className={`hero-overlay${data.align === 'center' ? ' hero-overlay--center' : ''}`}>
          <div className="container">
            {crumbs}
            {data.title && <Title className="hero-title">{data.title}</Title>}
            {data.subtitle && <p className="hero-sub">{data.subtitle}</p>}
            {/* `.hero-overlay .btn` geeft de knop hier zijn eigen doorschijnende stijl. */}
            <Cta label={data.ctaLabel} url={data.ctaUrl} />
          </div>
        </div>
      )}
    </section>
  )
}

function TextBlock({ data, suppressTitle, headingLevel }: { data: TextSection; suppressTitle?: boolean; headingLevel?: 1 | 2 }) {
  return (
    <section className="section section-text">
      <div className="container container--narrow">
        <SectionTitle title={data.title} subtitle={data.subtitle} suppressTitle={suppressTitle} headingLevel={headingLevel} />
        {data.paragraphs.map((html, i) => (
          <RichText key={i} html={html} className="prose" />
        ))}
        <Cta label={data.ctaLabel} url={data.ctaUrl} />
      </div>
    </section>
  )
}

function TextImageBlock({ data, suppressTitle, headingLevel }: { data: TextImageSection; suppressTitle?: boolean; headingLevel?: 1 | 2 }) {
  return (
    <section className={`section section-split${data.reverse ? ' is-reverse' : ''}`}>
      <div className="container split">
        <div className="split-text">
          <SectionTitle title={data.title} subtitle={data.subtitle} suppressTitle={suppressTitle} headingLevel={headingLevel} />
          {data.paragraphs.map((html, i) => (
            <RichText key={i} html={html} className="prose" />
          ))}
          <Cta label={data.ctaLabel} url={data.ctaUrl} />
        </div>
        <div className="split-media">
          <Media src={data.image} alt={data.title} shape="portrait" label="Foto" sizes="(max-width: 900px) 100vw, 50vw" />
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
              <img className="col-list-icon-img" src={it.icon} alt="" width={compact ? 20 : 32} height={compact ? 20 : 32} loading="lazy" decoding="async" />
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
    return <VideoEmbed videoId={block.videoId} poster={block.poster} title="Ameland Residence" playLabel={t(locale, 'playVideo')} />
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
function ReviewsBlock({ data, locale, suppressTitle, headingLevel }: { data: ReviewsSection; locale: string; suppressTitle?: boolean; headingLevel?: 1 | 2 }) {
  const labels = REVIEW_LABELS[locale] || REVIEW_LABELS.nl
  return (
    <section className="section section-reviews">
      <div className="container">
        <SectionTitle title={data.title} subtitle={data.subtitle} suppressTitle={suppressTitle} headingLevel={headingLevel} />
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

function CardsBlock({ data, suppressTitle, headingLevel }: { data: CardsSection; suppressTitle?: boolean; headingLevel?: 1 | 2 }) {
  // Zonder eigen kop boven het raster zijn de kaarttitels de eerste koppen na de <h1>: dan <h2>.
  const cardLevel: 2 | 3 = suppressTitle || !data.title ? 2 : 3
  return (
    <section className="section section-cards">
      <div className="container">
        <SectionTitle title={data.title} suppressTitle={suppressTitle} headingLevel={headingLevel} />
        {/* Deze banners staan er op de bestaande site met het labelblok in de foto, net als de
            villakaarten — titel op het beeld, alleen de link eronder. */}
        <CardGrid items={data.items} columns={Math.min(data.items.length, 3)} variant="overlay" level={cardLevel} />
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
    <Media key={b.image + i} src={b.image} alt="" shape="portrait" label="Sfeerbeeld" sizes="(max-width: 700px) 60vw, 25vw" />
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
function CollectionBlock({
  source,
  title,
  linkLabel,
  marquee,
  ctx,
  suppressTitle,
  headingLevel,
  filterable,
}: {
  source: 'villas' | 'blogs'
  title: string
  linkLabel: string
  marquee?: boolean
  ctx: RenderCtx
  /** This section's title became the page <h1>, so the cards move up to <h2>. */
  suppressTitle?: boolean
  /** Render this section's own title as the page <h1> (hub page without a hero). */
  headingLevel?: 1 | 2
  /** Villa hub: render the filter row above the grid. */
  filterable?: boolean
}) {
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
  /**
   * Scannable facts on the villa cards.
   *
   * The brief asks for cards that can be scanned "using existing, verified information". `villaFacts`
   * only reports what a villa's own page states, so the row differs per villa and is omitted where the
   * content is silent — no guessed occupancy, no invented amenities.
   *
   * Guests and bedrooms are deliberately NOT shown here even where available: capacity is stated on only
   * one of the ten villa pages, so a card row containing it would look broken next to nine cards without
   * it. Sauna / pets / EV / location are stated on all of them, which is what makes them usable as a
   * consistent card row (and as filters later, once the CMS gains real numeric fields).
   */
  const cardFacts: Record<string, CardFact[]> | undefined =
    source === 'villas'
      ? Object.fromEntries(
          Object.entries(ctx.villas).map(([slug, v]) => {
            const f = villaFacts(v)
            const row: CardFact[] = []
            if (f.locality) row.push({ icon: 'pin', label: f.locality })
            if (f.sauna) row.push({ icon: 'sauna', label: t(ctx.locale, 'sauna') })
            if (f.petsAllowed === true) row.push({ icon: 'paw', label: t(ctx.locale, 'petsAllowed') })
            if (f.evCharging) row.push({ icon: 'plug', label: t(ctx.locale, 'evCharging') })
            return [`${ctx.villaBase}/${slug}`, row]
          }),
        )
      : undefined

  // Villa's krijgen het labelblok in de foto, artikelen het zachtgroene tekstvlak — zoals daar.
  const variant: CardVariant = source === 'villas' ? 'overlay' : 'panel'
  // Onder de vier kaartbreedtes valt er niets te schuiven; dan is een raster netter dan een band
  // die halfleeg heen en weer kruipt.
  const asMarquee = marquee && items.length >= 4

  // Zonder eigen kop boven het raster zijn de kaarttitels de eerste koppen na de <h1>: dan <h2>.
  // Is de kop hier juist de <h1> (hub-pagina zonder hero), dan blijven de kaarten <h2>.
  const cardLevel: 2 | 3 = suppressTitle || !title || headingLevel === 1 ? 2 : 3

  return (
    <section className="section section-cards">
      {title && !suppressTitle && (
        <div className="container">
          <SectionTitle title={title} headingLevel={headingLevel} />
        </div>
      )}
      {/* De band loopt van rand tot rand, zodat de volgende kaart aangesneden in beeld staat. */}
      {asMarquee ? <CardMarquee items={items} variant={variant} level={cardLevel} facts={cardFacts} /> : (
        <div className="container">
          {/*
            Op de villa-hub komt er een filterrij boven het raster. Die staat in een client-component,
            met het VOLLEDIGE raster als Suspense-fallback: zo staat elke villa met zijn link in de
            statische HTML (eis uit de opdracht), en filtert JS daarna dezelfde lijst.
          */}
          {filterable && source === 'villas' ? (
            <Suspense
              fallback={<CardGrid items={items} columns={3} variant={variant} level={cardLevel} facts={cardFacts} />}
            >
              <VillaFilterState
                locale={ctx.locale}
                villas={ctx.villas}
                base={ctx.villaBase}
                cards={Object.fromEntries(Object.keys(ctx.villas).map((slug, i) => [slug, items[i]]))}
                cardFacts={cardFacts ?? {}}
                cardLevel={cardLevel}
              />
            </Suspense>
          ) : (
            <CardGrid items={items} columns={3} variant={variant} level={cardLevel} facts={cardFacts} />
          )}
        </div>
      )}
    </section>
  )
}

/**
 * `alt` names what the gallery is OF, so tile labels read "Villa Zee — foto 3" instead of "Foto — foto 3".
 * The lightbox controls are localised; previously they announced Dutch on German pages.
 */
function GalleryBlock({ data, locale, alt }: { data: GallerySection; locale: string; alt?: string }) {
  return (
    <section className="section section-gallery">
      <div className="container">
        <Gallery
          images={data.images}
          alt={alt || t(locale, 'photos')}
          labels={{
            close: t(locale, 'close'),
            prev: t(locale, 'previous'),
            next: t(locale, 'next'),
            photo: t(locale, 'photo'),
          }}
        />
      </div>
    </section>
  )
}

/**
 * The room-by-room checklist.
 *
 * `heading` adds an <h2> above the groups. Without it the group headings are <h3>s with no <h2> before
 * them — a skipped level, and the brief asks for scannable facilities under a clear heading. Villa pages
 * pass one; a `features` section used standalone in page content does not, and keeps its old shape.
 *
 * Long checklists (the villas run to 18 items in one group) are laid out in columns by the CSS rather
 * than as one tall list, which is what makes them scannable.
 */
export function FeaturesBlock({ data, heading }: { data: FeaturesSection; heading?: string }) {
  return (
    <section className="section section-features">
      <div className="container">
        {heading && <h2 className="features-title">{heading}</h2>}
        <div className="features">
          {data.groups.map((g) => (
            // 10+ items reads as a long sliver in one column; the CSS splits those into two.
            <div className={`feature-group${g.items.length >= 10 ? ' feature-group--long' : ''}`} key={g.heading}>
              <h3>{g.heading}</h3>
              <ul>
                {g.items.map((item) => {
                  // Both storage forms render identically — see lib/features.ts.
                  const text = featureText(item)
                  return (
                    <li key={text}>
                      <Icon name="check" size={15} />
                      <span>{text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BookingBlock({ widget, accommodationId, ctx }: { widget: string; accommodationId: string; ctx: RenderCtx }) {
  return (
    // The id is the shared anchor constant, not a literal: the villa nav bar and the "check
    // availability" button both link to it, and a rename here would break both silently.
    <section className="section section-booking" id={VILLA_SECTIONS.booking}>
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
            {/* <h2>, niet <h3>: dit zijn de eerste koppen ná de <h1> van de pagina, dus een <h3>
                sloeg een niveau over. De opmaak blijft gelijk (zie `.sitemap-grid h2` in de CSS). */}
            <h2>{g.heading}</h2>
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

/** Per-section render options set by the page route, not by the content. */
export type SectionOpts = {
  /** Render this hero's title as the page <h1> (exactly one section per page). */
  heading?: boolean
  /** Breadcrumb trail to place inside this hero's overlay. */
  crumbs?: ReactNode
  /** Hide this section's own <h2> because its text was promoted to the page <h1>. */
  suppressTitle?: boolean
  /** Render this section's own title as <h1> — for pages with no hero to host the heading. */
  headingLevel?: 1 | 2
  /** Villa hub: show the filter row above the villa grid. */
  filterable?: boolean
}

export function SectionView({ section, ctx, opts }: { section: Section; ctx: RenderCtx; opts?: SectionOpts }) {
  switch (section.type) {
    case 'hero': return <HeroBlock data={section} heading={opts?.heading} crumbs={opts?.crumbs} />
    case 'text': return <TextBlock data={section} suppressTitle={opts?.suppressTitle} headingLevel={opts?.headingLevel} />
    case 'textImage': return <TextImageBlock data={section} suppressTitle={opts?.suppressTitle} headingLevel={opts?.headingLevel} />
    case 'columns': return <ColumnsBlock data={section} locale={ctx.locale} />
    case 'cards': return <CardsBlock data={section} suppressTitle={opts?.suppressTitle} headingLevel={opts?.headingLevel} />
    case 'reviews': return <ReviewsBlock data={section} locale={ctx.locale} suppressTitle={opts?.suppressTitle} headingLevel={opts?.headingLevel} />
    case 'banners': return <BannersBlock data={section} />
    case 'collection': return <CollectionBlock source={section.source} title={section.title} linkLabel={section.linkLabel} marquee={section.marquee} ctx={ctx} suppressTitle={opts?.suppressTitle} headingLevel={opts?.headingLevel} filterable={opts?.filterable} />
    case 'gallery': return <GalleryBlock data={section} locale={ctx.locale} />
    case 'features': return <FeaturesBlock data={section} />
    case 'booking': return <BookingBlock widget={section.widget} accommodationId={section.accommodationId} ctx={ctx} />
    case 'form': return <FormBlock slug={section.slug} intro={section.intro} ctx={ctx} />
    case 'sitemap': return <SitemapBlock ctx={ctx} />
    default: return null
  }
}

/**
 * Render a page's section list. `opts` maps a section INDEX to render options, which is how the page
 * routes place the <h1> and the breadcrumbs without the content having to know about either.
 */
export function Sections({
  sections,
  ctx,
  opts,
}: {
  sections: Section[]
  ctx: RenderCtx
  opts?: Record<number, SectionOpts>
}) {
  return (
    <>
      {sections.map((s, i) => (
        <SectionView key={`${s.type}-${i}`} section={s} ctx={ctx} opts={opts?.[i]} />
      ))}
    </>
  )
}

/* ----------------------------------------------------------- page layouts */

/** Villa detail: hero → USP strip → intro + highlights → gallery → indeling → booking → extras. */
export function VillaPage({ villa, ctx, crumbs }: { villa: VillaContent; ctx: RenderCtx; crumbs?: ReactNode }) {
  const { locale } = ctx

  /**
   * Page order was changed so a visitor reaches the decision-making information sooner:
   *
   *   before: hero → usps → intro+highlights → gallery → layout → booking → extra sections (incl. FAQ)
   *   after:  hero → usps → KEY FACTS → ANCHOR NAV → intro+highlights → gallery → layout →
   *           extra sections → FAQ → booking
   *
   * Two deliberate moves:
   *  · The key-facts strip and the anchor bar come before the prose, so "how many bedrooms, is there a
   *    sauna, are dogs allowed" is answerable without reading anything.
   *  · Booking moves to LAST and the FAQ before it. Previously the widget sat between the checklist and
   *    the descriptive sections, so the page continued after the call to action; now the page builds to
   *    it. The `#boeken` anchor still works from the highlights button and the nav bar.
   *
   * The FAQ is separated out of `extraSections` for that reordering. It is identified structurally (a
   * `columns` section whose only block is `kind: 'faq'`), not by matching its heading text, so it keeps
   * working in both languages and if the wording changes.
   */
  const faqSections = villa.extraSections.filter(
    (s) => s.type === 'columns' && s.columns.length > 0 && s.columns.every((c) => c.kind === 'faq'),
  )
  const otherSections = villa.extraSections.filter((s) => !faqSections.includes(s))

  const facts = villaFacts(villa)
  const nav = villaNavItems(locale, {
    gallery: villa.gallery.length > 0,
    layout: villa.features.length > 0,
    features: otherSections.length > 0,
    faq: faqSections.length > 0,
    booking: !!villa.tommyId,
  })

  return (
    <>
      <HeroBlock
        data={{ type: 'hero', title: '', ctaLabel: '', ctaUrl: '', video: '', mobileVideo: '', images: villa.hero.images, mobileImages: villa.hero.mobileImages }}
        crumbs={crumbs}
      />

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

      <VillaKeyFacts locale={locale} facts={facts} />
      <VillaNav locale={locale} items={nav} />

      <section className="section section-villa-intro" id={VILLA_SECTIONS.about}>
        <div className="container villa-intro">
          <div className="villa-intro-text">
            <h1>{villa.title}</h1>
            {villa.paragraphs.map((html, i) => (
              <RichText key={i} html={html} className="prose" />
            ))}
            {villa.moreParagraphs.length > 0 && (
              <ReadMore moreLabel={t(locale, 'readMore')} lessLabel={t(locale, 'readLess')}>
                {villa.moreParagraphs.map((html, i) => (
                  <RichText key={i} html={html} className="prose" />
                ))}
              </ReadMore>
            )}
          </div>
          {villa.highlights.length > 0 && (
            <aside className="villa-highlights">
              <h2>{t(locale, 'goodToKnow')}</h2>
              <ul>
                {villa.highlights.map((h) => (
                  <li key={h}><Icon name="check" size={15} /><span>{h}</span></li>
                ))}
              </ul>
              <a className="btn btn-primary" href={`#${VILLA_SECTIONS.booking}`}>
                {t(locale, 'checkAvailability')}
                <Icon name="calendar" size={16} />
              </a>
            </aside>
          )}
        </div>
      </section>

      {villa.gallery.length > 0 && (
        <div id={VILLA_SECTIONS.gallery}>
          {/* Name the gallery after the villa, so a tile reads "Villa Zee — foto 3". */}
          <GalleryBlock data={{ type: 'gallery', images: villa.gallery }} locale={locale} alt={villa.title} />
        </div>
      )}
      {villa.features.length > 0 && (
        <div id={VILLA_SECTIONS.layout}>
          <FeaturesBlock data={{ type: 'features', groups: villa.features }} heading={t(locale, 'navLayout')} />
        </div>
      )}
      {otherSections.length > 0 && (
        <div id={VILLA_SECTIONS.features}>
          <Sections sections={otherSections} ctx={ctx} />
        </div>
      )}
      {faqSections.length > 0 && (
        <div id={VILLA_SECTIONS.faq}>
          <Sections sections={faqSections} ctx={ctx} />
        </div>
      )}
      {/* Villa -> article links: the one direction the link audit found missing (0/5 in both languages). */}
      <RelatedArticles locale={locale} items={relatedArticles(locale, villa, ctx.blogs)} blogBase={ctx.blogBase} />
      {villa.tommyId && <BookingBlock widget="boeken" accommodationId={villa.tommyId} ctx={ctx} />}
    </>
  )
}

/** Blog article: image + title + heading/paragraph body, then a villa grid as the conversion step. */
export function BlogPage({ blog, ctx, crumbs }: { blog: BlogContent; ctx: RenderCtx; crumbs?: ReactNode }) {
  const { locale } = ctx
  return (
    <>
      <article className="section article">
        <div className="container container--narrow">
          {/* Geen hero-afbeelding op een artikel: het kruimelpad staat op de lichte achtergrond. */}
          {crumbs && <div className="crumbs--standalone">{crumbs}</div>}
          <h1>{blog.title}</h1>
          {blog.excerpt && <p className="article-lead">{blog.excerpt}</p>}
          {blog.image && (
            <div className="article-figure">
              <Media src={blog.image} alt={blog.title} shape="wide" label="Foto" priority sizes="(max-width: 900px) 100vw, 880px" />
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
      <CollectionBlock source="villas" title={t(locale, 'ourVillas')} linkLabel={t(locale, 'moreInfo')} ctx={ctx} />
    </>
  )
}
