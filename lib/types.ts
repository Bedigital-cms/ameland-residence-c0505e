/**
 * Content model for the Ameland Residence template.
 *
 * Every page on this site is built from the SAME small set of sections (hero, text, columns,
 * card grid, gallery, booking widget…), which is why one renderer can serve all 130+ pages in both
 * languages. Pages that only differ in data live in keyed collections (`villas.json`, `blogs.json`,
 * `pages.json`) — adding a page means adding a JSON key, never a new route.
 *
 * Shapes are deliberately flat and descriptive so the CMS Content Editor can build a form for them
 * automatically, and language-neutral so `content/nl/*` and `content/de/*` have identical structure.
 */

/* ------------------------------------------------------------------ shared */

/** Per-page SEO, mirrored from the old site so rankings carry over. */
export type Seo = {
  title: string
  description: string
  keywords: string
  /** Social share image, as a `/media/<file>` path. */
  ogImage: string
  /** e.g. "index, follow" — set to "noindex, follow" for thank-you pages. */
  robots: string
}

/** A link with a prefix-free internal URL ("/villa-zee") or an absolute external one. */
export type Link = { label: string; url: string }

/** Rich text: HTML strings limited to <strong>/<em>/<a>/<br>/<ul>/<h3>. Rendered via <RichText>. */
export type Html = string

/* ---------------------------------------------------------------- sections */

/** Full-bleed image/video slider at the top of a page, with an optional overlay title + button. */
export type HeroSection = {
  type: 'hero'
  title: string
  /** Tweede regel onder de titel, in het handschriftfont — zoals "in een vakantiehuis van Ameland
   *  Residence" op de homepage. Weglaten als de hero alleen een titel heeft. */
  subtitle?: string
  /**
   * Waar de tekst in de hero staat. `center` is de homepage-behandeling van de bestaande site
   * (midden, gecentreerd, Jost + handschrift); zonder dit veld staat de titel linksonder, zoals bij
   * de gewone pagina's. De klant kan dit per hero in de CMS zetten.
   */
  align?: 'center' | 'bottom'
  ctaLabel: string
  ctaUrl: string
  /** `/media/<file>.mp4`; when set it replaces the image slider. */
  video: string
  mobileVideo: string
  images: string[]
  mobileImages: string[]
}

/** A heading + rich text block, optionally with a button and a third-party embed. */
export type TextSection = {
  type: 'text'
  title: string
  subtitle: string
  paragraphs: Html[]
  ctaLabel: string
  ctaUrl: string
}

/**
 * Eén beoordeling, met de hand ingevoerd in de CMS Content Editor. De klant kopieert de tekst uit
 * Google; er praat dus niets met een externe widget mee (geen script, geen cookies van derden).
 */
export type Review = {
  /** Naam zoals hij onder de review staat. De eerste letter wordt de gekleurde rondje-avatar. */
  author: string
  /** "1 maand geleden", "3 jaar geleden" — vrije tekst, want het is een momentopname. */
  date: string
  /** Waar de review vandaan komt, bijvoorbeeld "Google". */
  source: string
  /** Logo van die bron uit de mediabibliotheek (`/media/…`); leeg = alleen de naam als tekst. */
  sourceLogo: string
  /** 1 t/m 5 sterren. */
  rating: number
  /** De volledige review. Boven de drie regels wordt hij ingeklapt achter "Lees meer". */
  text: string
  /** Vinkje achter de naam, zoals Google dat bij een bevestigde recensent zet. */
  verified: boolean
}

/** Beoordelingen in kaarten, met een knop eronder om er zelf een achter te laten. */
export type ReviewsSection = {
  type: 'reviews'
  title: string
  subtitle: string
  ctaLabel: string
  ctaUrl: string
  items: Review[]
}

/** Text on one side, an image on the other. `reverse` puts the image on the left. */
export type TextImageSection = {
  type: 'textImage'
  title: string
  subtitle: string
  paragraphs: Html[]
  ctaLabel: string
  ctaUrl: string
  image: string
  reverse: boolean
}

/** One block inside a `columns` section. */
export type ColumnBlock =
  | { kind: 'text'; title: string; lead: string; paragraphs: Html[]; ctaLabel: string; ctaUrl: string }
  | { kind: 'list'; items: { icon: string; label: string; text: string }[] }
  | { kind: 'gallery'; images: string[] }
  /** An embedded video. Only the id is stored, so no third-party script loads until a visitor
   *  clicks play (the poster is shown until then). */
  | { kind: 'video'; provider: 'youtube'; videoId: string; poster: string }
  /** Accordion — used for the "wat te doen op Ameland" lists on the landing pages. */
  | { kind: 'faq'; items: { q: string; a: Html[] }[] }
  /** A stacked pair/trio of blocks that share one grid cell. */
  | { kind: 'group'; blocks: ColumnBlock[] }

/**
 * A responsive row of blocks (text, icon-list, image slider).
 *
 * `background` legt een band achter de sectie, net zoals de bestaande site dat per sectie doet:
 *  - `effect` — het lichte vormpje `bg-effect02.svg`, bovenaan gecentreerd (hun eerste kolomsectie)
 *  - `mint`   — vlak `#edf4ea` (hun derde kolomsectie)
 * Weglaten = geen band.
 *
 * `bleed: true` laat de sectie van rand tot rand lopen in plaats van binnen de contentbreedte: de
 * foto zit tegen de linkerrand en de tekst krijgt rechts een ruime marge (40/60). Zo staat de
 * "Vakantiehuis op Ameland"-sectie op de bestaande site — hun `.sc` staat daar op `width: 100%`.
 */
export type ColumnsSection = {
  type: 'columns'
  columns: ColumnBlock[]
  background?: 'effect' | 'mint'
  bleed?: boolean
  /**
   * Verhoudingen van de kolommen, één getal per kolom — bijvoorbeeld `[324, 400, 572]`, de breedtes
   * die de bestaande site voor de groene band gebruikt. De getallen zijn relatief (het worden `fr`),
   * dus je mag de pixelmaten van het ontwerp gewoon overnemen. Weglaten = gelijke kolommen, of de
   * standaardverdeling die de renderer kiest (70/30 bij tekst+lijst, 40/60 bij `bleed`).
   */
  widths?: number[]
  /**
   * Ruimte in PIXELS, per sectie — want de bestaande site zet die daar ook per sectie:
   * de groene band staat op 4em/4em met 16px tussen de kolommen, de eerste kolomsectie op 4em/5em
   * met 30px, de full-bleed sectie op 5em/7em met 30px. Wat je weglaat volgt het ritme van het
   * template (`--section-y` en de standaard-gap).
   */
  space?: { top?: number; bottom?: number; gap?: number }
  /**
   * De kolommen ONDER elkaar in plaats van naast elkaar. De bestaande site regelt dit per kolom
   * (`.column[data-id="501"] { flex: 0 0 100% }` in de sectie-instellingen van het CMS); hier is het
   * één schakelaar voor de hele sectie, want in de praktijk gaat het altijd om "kop boven, beeld
   * eronder" — zo staat de videopagina er ook op.
   */
  stack?: boolean
  /**
   * Maximumbreedte van de sectie in PIXELS, gecentreerd op de pagina. Hun videopagina zet de baan op
   * `max-width: 800px` zodat het beeld niet over de volle contentbreedte uitrekt. Weglaten = de
   * gewone contentbreedte van het template.
   */
  maxWidth?: number
}

/** A link card in a grid. */
export type Card = { title: string; text: string; image: string; url: string; linkLabel: string }

/** A hand-curated card grid (used for cross-links between pages). */
export type CardsSection = { type: 'cards'; title: string; items: Card[] }

/** A decorative image strip (no titles, no links). */
export type BannersSection = { type: 'banners'; title: string; items: { image: string }[] }

/**
 * A LIVE card grid rendered from a collection file — not a copied list. Add a villa or a blog post
 * to its JSON and it appears here automatically, in every place a `collection` section is used.
 */
export type CollectionSection = {
  type: 'collection'
  source: 'villas' | 'blogs'
  title: string
  linkLabel: string
  /**
   * Doorlopende band die van rechts naar links schuift, zoals de villastrook op de homepage van de
   * bestaande site (hun swiper staat daar op autoplay-delay 0 met lineaire timing, wat neerkomt op
   * een marquee). Weglaten = een gewoon raster; zo staat de villa-hub er ook op de echte site.
   */
  marquee?: boolean
}

/** Photo grid / lightbox strip. */
export type GallerySection = { type: 'gallery'; images: string[] }

/** Checklist groups ("Indeling benedenverdieping", …) on a villa page. */
export type FeaturesSection = { type: 'features'; groups: { heading: string; items: string[] }[] }

/**
 * The Tommy Booking Support widget.
 *  - `widget: "zoeken"` → availability search across all accommodations (Zoek & boek, last minutes)
 *  - `widget: "boeken"` → the booking calendar for ONE accommodation (`accommodationId`)
 */
export type BookingSection = { type: 'booking'; widget: 'zoeken' | 'boeken' | string; accommodationId: string }

/** Auto-generated HTML sitemap (reads every collection + page). */
export type SitemapSection = { type: 'sitemap' }

/** The last-minute overview: the period filter plus the villas Tommy still has open. Added by the
 *  `lastminutes` page kind, so it is not something an editor places by hand. */
export type LastMinutesSection = { type: 'lastminutes' }

/** The Zoek & boek results for the period in `?range=`. Added by the `booking` page kind. */
export type SearchResultsSection = { type: 'searchResults' }

/**
 * The contact form, rendered from content/forms.json, with an info column beside it.
 * `intro` is the page's own contact text moved into that column (so the details aren't printed
 * twice); without one the column falls back to the address from site.json.
 */
export type FormSection = { type: 'form'; slug: string; intro?: TextSection }

export type Section =
  | HeroSection
  | TextSection
  | TextImageSection
  | ColumnsSection
  | CardsSection
  | BannersSection
  | CollectionSection
  | ReviewsSection
  | GallerySection
  | FeaturesSection
  | BookingSection
  | SitemapSection
  | LastMinutesSection
  | SearchResultsSection
  | FormSection

/* -------------------------------------------------------------------- site */

export type NavItem = Link
export type FooterColumn = { heading: string; links: Link[] }

/** Tommy Booking Support account settings (the API key comes from the environment). */
export type BookingConfig = {
  account: string
  searchTitle: string
  /** Widget interface language / country, e.g. "nl" or "de". */
  language: string
  country: string
  /** Where Tommy sends the guest after a completed booking (prefix-free internal path). */
  successUrl: string
}

export type SiteContent = {
  brandName: string
  tagline: string
  /** `/media/<file>`; empty → the brand name renders as text. */
  logo: string
  nav: NavItem[]
  ctaLabel: string
  ctaUrl: string
  booking: BookingConfig
  footer: {
    about: string
    addressTitle: string
    address: string[]
    email: string
    phone: string
    badge: string
    socials: { label: string; url: string; icon: string }[]
    columns: FooterColumn[]
    bottomLinks: Link[]
    rightsText: string
  }
}

/* ---------------------------------------------------------------- collections */

/** The homepage — a plain section list, like every other page. */
export type HomeContent = { seo: Seo; sections: Section[] }

/**
 * What a page in `pages.json` DOES. Most are plain content pages; a handful are the fixed
 * "functional" pages whose slug differs per language (`/villa-s` vs `/ferienhauser`), which is why
 * the behaviour is data on the page rather than a folder name in the route tree.
 */
export type PageKind = 'page' | 'villas-hub' | 'blogs-hub' | 'booking' | 'lastminutes' | 'contact' | 'sitemap'

export type PageContent = {
  kind: PageKind
  title: string
  sections: Section[]
  seo: Seo
}

/** slug → page. A new key is a new page at `/<slug>`. */
export type PageCollection = Record<string, PageContent>

export type VillaContent = {
  title: string
  subtitle: string
  /** Tommy accommodation id — drives the booking calendar on this villa's page. */
  tommyId: string
  cardImage: string
  cardText: string
  linkLabel?: string
  /**
   * Weekly rate range shown on the result cards, e.g. 1495 - 3630 "per week".
   *
   * Editable content, not Tommy: the booking API this template talks to exposes availability and
   * capacity but no tariffs, so the range is maintained in the CMS. Leave both at 0 and the card
   * simply omits the line rather than printing a placeholder price.
   */
  priceFrom?: number
  priceTo?: number
  /** Small print behind the ⓘ next to the price. */
  priceNote?: string
  /**
   * Where this villa sits, for the map view on the result pages.
   *
   * Editable content: Tommy stores the office address on every accommodation (its lat/lng are 0),
   * so the real positions have to be maintained here. A villa without coordinates is simply left
   * off the map and stays listed underneath it — never dropped, and never pinned at a guessed spot.
   */
  latitude?: number
  longitude?: number
  hero: { images: string[]; mobileImages: string[] }
  usps: { icon: string; label: string }[]
  paragraphs: Html[]
  /** Shown behind a "lees meer" toggle. */
  moreParagraphs: Html[]
  highlights: string[]
  gallery: string[]
  features: { heading: string; items: string[] }[]
  /** Free-form sections appended below the fixed villa layout. */
  extraSections: Section[]
  seo: Seo
}

/** slug → villa. A new key is a new villa page under the villa hub (`/villa-s/<slug>` in nl,
 *  `/ferienhauser/<slug>` in de) + a card in every villa grid. */
export type VillaCollection = Record<string, VillaContent>

export type BlogContent = {
  title: string
  excerpt: string
  image: string
  cardImage: string
  linkLabel?: string
  blocks: { heading: string; paragraphs: Html[] }[]
  seo: Seo
}

/** slug → article. A new key is a new article at `/blogs/<slug>` + a card on the blog overview. */
export type BlogCollection = Record<string, BlogContent>
