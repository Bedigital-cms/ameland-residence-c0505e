# AI-gids — Ameland Residence

Lees dit eerst. Het beschrijft **exact** hoe deze website in elkaar zit: welke URL door welk
content-bestand wordt aangestuurd en welke renderer dat doet. Houd deze gids gelijk met de repo —
verandert er een route of een collectie, pas dan ook dit bestand aan.

## Kern in vijf regels

1. **Alle tekst, afbeeldingen en lijsten staan in `content/<taal>/*.json`.** Nooit hardcoden in `.tsx`.
2. Er zijn maar **drie routes**: de homepage, de `[slug]`-route voor pagina's en de geneste
   `[slug]/[item]`-route voor detailpagina's. Een nieuwe pagina is een **nieuwe sleutel in JSON** —
   nooit een nieuwe map in `app/`.
3. **URL's zijn exact die van de vorige site.** Detailpagina's hangen onder hun hub:
   `/villa-s/villa-zee` (de: `/ferienhauser/villa-zee`), `/blogs/fietsen-op-ameland`. Alle overige
   pagina's zijn vlak: `/contact`, `/over-ons`, `/zoek-boek`. Daarom is `content/redirects.json`
   leeg — er is geen enkele URL veranderd, dus valt er niks om te leiden.
4. Elke taal heeft **eigen slugs**: `/villa-s` (nl) ↔ `/ferienhauser` (de), `/contact` ↔ `/kontakt`.
   Daarom staat het gedrag van een pagina in het veld `kind`, niet in een mapnaam.
5. **Per-domein taal**: `ameland-residence.nl` toont Nederlands, `ameland-residence.de` Duits, allebei
   op schone URL's zonder `/nl` of `/de`. Er is dus geen taalwisselaar in de header.

## Routes → content

| Publieke URL | Route-bestand | Content | Renderer |
|---|---|---|---|
| `/` | `app/[locale]/page.tsx` | `content/<taal>/home.json` | `Sections` |
| `/<slug>` (pagina's + hubs) | `app/[locale]/[slug]/page.tsx` | `content/<taal>/pages.json` → `[slug]` | `Sections` + `kind` |
| `/villa-s/<slug>` · de `/ferienhauser/<slug>` | `app/[locale]/[slug]/[item]/page.tsx` | `content/<taal>/villas.json` → `[item]` | `VillaPage` |
| `/blogs/<slug>` | `app/[locale]/[slug]/[item]/page.tsx` | `content/<taal>/blogs.json` → `[item]` | `BlogPage` |
| `/media/<bestand>` | `app/media/[filename]/route.ts` | — | 302 naar het CMS-media-endpoint |
| 404 | `app/not-found.tsx` | `site.json` | — |

Het eerste segment van de geneste route staat **niet** als map in `app/`, want het heet per taal
anders (`villa-s` ↔ `ferienhauser`). Het is de `pages.json`-sleutel met `kind: villas-hub` /
`blogs-hub`; de route valideert `[slug]` daartegen (`collectionFor`) en `content/pages.ts → hubBase`
bouwt er elke villa-/artikellink mee. **Hernoem je de hub in de CMS, dan verhuizen de detailpagina's
automatisch mee.** Slugs hoeven daarom alleen binnen hun eigen collectie uniek te zijn; pagina-slugs
mogen niet botsen met een vaste route (`media`, `nl`, `de`) — build-guards in `generateStaticParams`
laten de build falen met een duidelijke melding.

## Keyed collections

Alle drie zijn `{ "<slug>": { … } }`. **Een nieuwe sleutel = een nieuwe pagina**: in `pages.json` op
`/<slug>`, in `villas.json` op `/villa-s/<slug>` (de: `/ferienhauser/<slug>`) en in `blogs.json` op
`/blogs/<slug>`. Je hoeft geen `.tsx` te maken.

| Bestand | Type (`lib/types.ts`) | Aantal (nl / de) | Wat het is |
|---|---|---|---|
| `villas.json` | `VillaCollection` / `VillaContent` | 5 / 5 | De vakantiehuizen |
| `blogs.json` | `BlogCollection` / `BlogContent` | 57 / 25 | De artikelen |
| `pages.json` | `PageCollection` / `PageContent` | 20 / 21 | Overzichten, SEO-landingspagina's, info, voorwaarden |

De volgorde van de sleutels **is** de volgorde op de site (villakaarten, blogoverzicht). Wil de klant
een andere volgorde, verplaats dan de sleutel in het JSON-bestand.

### `pages.json` — het veld `kind`

Elke pagina heeft een `kind` dat bepaalt wat de renderer er extra bij zet:

| `kind` | Wat er gebeurt | nl | de |
|---|---|---|---|
| `page` | Alleen de eigen `sections` (verreweg het meeste) | — | — |
| `villas-hub` | Voegt een **live** villagrid toe uit `villas.json` | `/villa-s` | `/ferienhauser` |
| `blogs-hub` | Voegt een **live** artikelgrid toe uit `blogs.json` | `/blogs` | `/blogs` |
| `booking` | Voegt de Tommy-zoekmodule toe | `/zoek-boek` | `/suchen-buchen` |
| `lastminutes` | Idem, voor het last-minute-aanbod | `/last-minutes` | `/last-minutes` |
| `contact` | Voegt het contactformulier toe; de eigen tekst schuift in de linkerkolom | `/contact` | `/kontakt` |
| `sitemap` | Genereert de HTML-sitemap uit alle collecties | `/sitemap` | `/sitemap` |

Zet je een villa of artikel erbij, dan verschijnt die **automatisch** op de overzichtspagina én overal
waar een `collection`-sectie staat. Nooit handmatig kaarten bijhouden.

## Secties (`components/sections.tsx`)

Elke pagina is een lijst `sections`. Dit zijn alle beschikbare types — gebruik deze en verzin geen
nieuwe renderer:

| `type` | Waarvoor |
|---|---|
| `hero` | Full-bleed slider of video bovenaan. Optioneel `title`, `subtitle` (tweede regel in het handschriftfont) en `ctaLabel`/`ctaUrl`. `align: "center"` zet de tekst midden in het beeld zoals op de homepage; zonder dat veld staat de titel linksonder. De hero's van de gewone pagina's hebben geen tekst — alleen beeld, net als op de bestaande site |
| `text` | Kop + subkop + rijke tekst + knop |
| `textImage` | Tekst naast een afbeelding (`reverse: true` = beeld links) |
| `columns` | Rij blokken — zie de tabel hieronder. `background: "effect" \| "mint"` legt een band achter de sectie; `bleed: true` laat hem van rand tot rand lopen (40% beeld tegen de linkerrand, 60% tekst); `widths: [324, 400, 572]` zet de kolomverhouding (één getal per kolom, relatief — de pixelmaten van het ontwerp mag je zo overnemen); `space: { top, bottom, gap }` zet de ruimte in pixels per sectie, want de bestaande site doet dat daar ook per sectie (groene band 64/64 met gap 16, eerste kolomsectie 64/80 met 30, full-bleed 80/112 met 30) |
| `cards` | Handmatig samengestelde kaartenrij (kruislinks), met het labelblok in de foto |
| `collection` | **Live** kaartenrij uit `villas.json` of `blogs.json` (`source`). Villa's krijgen het labelblok in de foto, artikelen een zachtgroen tekstvlak met samenvatting. `marquee: true` maakt er een doorlopende band van (rechts → links, pauzeert bij hover; onder vier kaarten valt hij terug op een raster) — zo staat de villastrook op de homepage, terwijl de hubs een raster blijven |
| `reviews` | Beoordelingskaarten uit `items`, **met de hand ingevuld in de CMS** (geen externe widget, dus geen cookies van derden). Per review: `author`, `date` ("3 jaar geleden"), `source` ("Google"), `sourceLogo` (leeg = alleen de naam als tekst), `rating` 1–5, `text`, `verified`. De avatarkleur volgt uit de naam; boven ±150 tekens klapt de tekst in achter "Lees meer". Vier kolommen, zakt naar twee en één — nooit een horizontale scrollbalk |
| `banners` | Sfeerbeeldenstrook, zonder titels of links |
| `gallery` | Fotogrid met lightbox |
| `features` | Checklistgroepen ("Indeling benedenverdieping") |
| `booking` | Tommy-widget: `widget: "zoeken"` of `"boeken"` + `accommodationId` |
| `form` | Contactformulier uit `content/forms.json` |
| `sitemap` | Gegenereerde sitemap |

### Blokken binnen een `columns`-sectie (`kind`)

| `kind` | Waarvoor |
|---|---|
| `text` | Kop + lead + rijke tekst + knop |
| `list` | Opsomming met eigen icoon uit de media (`icon`): `label` + optionele `text`. Hebben ALLE items alleen een `label`, dan rendert het als compacte checklist (vinkje 20px, kleiner label); met `text` erbij als USP-blok (icoon 32px) |
| `gallery` | Fotoslider: wisselt automatisch met een crossfade (2,5s per foto) en heeft pijltjes. Eén foto = stilstaand beeld |
| `video` | YouTube-embed; alleen `videoId` + `poster`. Laadt pas bij klikken (geen cookies bij paginaweergave) |
| `faq` | Accordeon: `items: [{ q, a: [] }]` — gebruikt op de landingspagina's ("wat te doen op Ameland") |
| `group` | Gestapelde blokken in één kolomcel |

Rijke tekst is HTML-string met alleen `<strong> <em> <a> <br> <ul> <li> <h3>`. Interne links schrijf je
**zonder taalvoorvoegsel maar mét het hubsegment** (`/villa-s/villa-zee`, `/blogs/fietsen-op-ameland`,
`/contact`); `<RichText>` zet het taalvoorvoegsel er bij het renderen op.

## Afbeeldingen

- Altijd `/media/<bestandsnaam>` in content — nooit een CMS-admin-URL, nooit een pad met map.
- Render content-afbeeldingen via `<Media>`; die toont een nette placeholder als het pad leeg is.
- Nieuwe bestanden gaan via de CMS Media-bibliotheek (upload), of in bulk via
  `<cms>/media/_import/ameland-residence/` + CMS → Media → "Importeren". Zie `MEDIA.md`.

## Boekingsmodule (Tommy)

`components/TommyWidget.tsx` laadt de externe Tommy-widget. Account en API-key komen uit de omgeving
(`NEXT_PUBLIC_TOMMY_ACCOUNT`, `NEXT_PUBLIC_TOMMY_APIKEY`) — **nooit in content zetten**. Taal, land en
de success-URL staan wél in `site.json` (`site.booking`). Per villa staat het Tommy-nummer in
`villas.json` → `tommyId`:

| Villa | `tommyId` |
|---|---|
| Villa Zee | 52147 |
| Villa Stern | 52150 |
| Villa Zilt | 52153 |
| Villa Nova | 52156 |
| Luxe Bungalow Watersnip | 52159 |

Zonder API-key toont de site een duidelijke placeholder in plaats van een lege sectie.

## Een pagina toevoegen — het recept

1. Kies de juiste collectie (`villas.json` / `blogs.json` / `pages.json`) in **elke taal die de klant wil**.
2. Voeg een sleutel toe. De sleutel is het **laatste** URL-segment: `"wadlopen-ameland"` in
   `blogs.json` → `/blogs/wadlopen-ameland`, in `pages.json` → `/wadlopen-ameland`.
3. Zorg dat de sleutel binnen zijn eigen collectie uniek is; een pagina-slug mag geen vaste route
   zijn (`media`, `nl`, `de`) — anders faalt de build met `[pages] slug … botst`.
4. Vul `seo` in (`title`, `description`, `keywords`, `ogImage`, `robots`) — dit stuurt de metadata aan.
5. Wil je hem in het menu? Voeg een item toe aan `site.json` → `nav`. Boven zeven items schuift de
   header de rest automatisch in een "Meer"-menu.
6. `editable.json` hoeft **niet** aangepast: alle drie de collecties staan er al in met
   `itemsArePages: true` en de juiste `itemBase`.

## Wat je NIET moet doen

- Geen map maken in `app/[locale]/` voor een gewone pagina — gebruik `pages.json` + `kind`.
- Géén hubnaam hardcoden in een link (`/villa-s/x`) in `.tsx`: die heet per taal anders, gebruik
  `ctx.villaBase` / `ctx.blogBase` (of `hubBase()`). In content-JSON schrijf je de URL wél volledig uit.
- Geen `<Link>` of kale `<a href="/…">` voor interne links — gebruik `<LocaleLink>` (of `<RichText>` in
  lopende tekst), anders klopt het taalvoorvoegsel niet.
- Geen tekst in componenten. Geen `/nl/` of `/de/` in content-URL's.
- `forms.json`, `redirects.json` en `i18n.json` niet in `editable.json` zetten; die hebben hun eigen
  editor in het CMS.
- Per-taal `content/<taal>/forms.json` niet met de hand herstructureren: de veldnamen zijn taal-neutraal
  en staan in de platte `content/forms.json`; alleen de weergavetekst is vertaalbaar.
