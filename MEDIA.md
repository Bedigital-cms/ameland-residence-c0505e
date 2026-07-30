# Media — migratie en beheer

## Hoe media werkt

De site slaat zelf geen bestanden op. Content verwijst altijd naar `/media/<bestandsnaam>`; de route
`app/media/[filename]/route.ts` stuurt dat door (302) naar het publieke, tenant-scoped media-endpoint
van het CMS, dat het bestand streamt (lokaal) of doorstuurt naar R2 (productie).

Twee omgevingsvariabelen zijn verplicht, anders krijg je 404's en dus gebroken afbeeldingen:

```
MEDIA_PUBLIC_BASE=http://localhost:3000/media   # prod: https://cms.bedigital.nl/media
MEDIA_TENANT_SLUG=ameland-residence
```

## De gemigreerde bestanden (eenmalig)

Bij de migratie zijn **248 bestanden (± 153 MB)** van de bestaande sites gehaald: villafoto's,
blogafbeeldingen, sfeerbanners, de twee headervideo's, het merklogo, het keurmerk-label, het
footerpatroon, de achtergrondvorm en de USP-/social-iconen. Ze staan in:

```
_import/ameland-residence/
```

### Bestanden die het ontwerp nodig heeft

Deze worden niet uit een contentveld geraden maar staan vast in het template — zonder import valt de
site terug op een tekstalternatief of een vlakke kleur (nooit een gebroken plaatje):

| Bestand (oorspronkelijke naam) | Waar | Zonder import |
|---|---|---|
| `logo-ameland-residence-donker01.svg` | `site.json` → `logo` (header + footer) | tekstwoordmerk "Ameland Residence" |
| `ameland-residence-label.png` | `site.json` → `footer.badge` | lege plek in de footer |
| `bg-patroon-donker-transparant01.svg` | `.footer` in `globals.css` | footer blijft vlak `--stone` |
| `bg-effect02.svg` | kolomsectie met `background: "effect"` | die sectie blijft zonder band |
| `usp-icoon-*.svg` (4×) | `columns` → `list` → `icon` | terugval op een vinkje in een cirkel |

Let op: sinds de naamgevingsconventie (zie hieronder) heten deze bestanden op schijf anders. De volledige
lijst oud → nieuw staat in [`reports/media-rename-map.csv`](reports/media-rename-map.csv); bijvoorbeeld
`logo-ameland-residence-donker01.svg` → `ameland-residence-20260730-3c8850-logo-ameland-residence-donker01.svg`.

## Naamgevingsconventie

Alle media volgt één vast patroon, zodat elk bestand tenant-herkenbaar en botsingsvrij is:

```
{tenantSlug}-{YYYYMMDD}-{id}-{slug-van-originele-naam}.{extensie}

ameland-residence-20260730-c9ddb5-villa-zee-ameland.jpg
```

| Segment | Waarde hier | Waarom |
|---|---|---|
| `tenantSlug` | `ameland-residence` | gelijk aan `MEDIA_TENANT_SLUG` en de importmap |
| `YYYYMMDD` | `20260730`, **vast** | een datum die per run verandert zou bij elke rebuild andere namen geven |
| `id` | `sha256(originele bestandsnaam)[0:6]` | **deterministisch**, geen `Math.random()` — zie hieronder |
| `slug` | geslugificeerde originele naam | houdt het bestand met het oog herkenbaar en levert de CMS bruikbare alt-tekst |

**Waarom de id een hash is en niet willekeurig.** `_import/` is gitignored en wordt op een verse clone
opnieuw opgebouwd met `pnpm media:fetch`. Bij een écht willekeurige id zou die rebuild ándere namen
opleveren dan de namen die al in het CMS staan — en dan geeft elk contentpad een 404. Met een hash van de
originele naam levert dezelfde invoer altijd dezelfde uitvoer, dus:

```sh
pnpm media:rename --dry   # tweede keer: "All 247 files already use the convention — nothing to do."
```

Omzetten (eenmalig al gedaan) gaat met:

```sh
pnpm media:rename --dry     # laat de volledige mapping zien, verandert niets
pnpm media:rename           # hernoemt de bestanden ÉN herschrijft alle 795 verwijzingen
```

Het script hernoemt de bestanden en past in dezelfde run `content/**/*.json`, `app/globals.css` en dit
document aan. Dat moet samen gebeuren: `app/media/[filename]/route.ts` geeft de bestandsnaam
onveranderd door aan het CMS, dus de opgeslagen naam en het contentpad moeten altijd gelijk zijn.
Het weigert te draaien bij een botsing (ook alleen-hoofdletters), bij een naam die
`encodeURIComponent` niet overleeft, of als de map half hernoemd is.

**Het CMS hoeft niets aan te passen**: de importer maakt per bestand een DB-record op basis van de
bestandsnaam die hij in de map vindt, dus het importeren van de hernoemde map is voldoende.

Deze map staat **bewust in `.gitignore`**. Het is een eenmalig afleveringsartefact: 149 MB hoort niet
mee te reizen met elke tenant-kopie van deze repo.

### De map opnieuw opbouwen (na een verse clone)

Omdat de map gitignored is, heeft een verse clone géén media. Herstel hem volledig uit de oude live
sites — er wordt niets geraden, elke bron-URL komt uit een gecrawlde pagina:

```sh
pnpm audit:crawl-old     # cache de oude sites in .crawl/ (eenmalig, ± 2 min)
pnpm media:check         # rapport: welke referentie hoort bij welke bron-URL
pnpm media:fetch         # download alles naar _import/ameland-residence/
pnpm media:validate      # controleer dat het écht afbeeldingen zijn
```

`media:check` schrijft ook `.crawl/media-map.csv` — per contentpad de gevonden bron-URL, handig om
steekproeven te doen.

**Waarom `media:validate` bestaat.** De oude CMS antwoordt op een ontbrekend bestand met HTTP 404 maar
een HTML-foutpagina van ± 50 KB als body. Een controle op statuscode of bestandsgrootte alleen keurt die
dus goed. Daarom leest dit script de **magic bytes** van elk bestand en vergelijkt het formaat met de
extensie. Het controleert bovendien drie dingen die op Windows onmogelijk zichtbaar zijn maar in
productie wél stukgaan:

| Controle | Waarom het lokaal niet opvalt |
|---|---|
| verschil in **hoofdletters** tussen content en bestandsnaam | Windows is case-insensitive, R2/Linux niet → 404 na deploy |
| bestandsnamen die **alleen in hoofdletters** verschillen | bestaan naast elkaar op Linux, overschrijven elkaar bij het kopiëren op Windows |
| tekens die de media-route (`encodeURIComponent`) niet overleeft | `%`, `#`, `?`, `&`, spaties, niet-NFC-unicode |

Huidige stand: **247 bestanden, 153,3 MB, 0 corrupt, 0 hoofdletterproblemen, 0 onveilige namen** —
247 van de 248 contentreferenties opgelost. De ene die overblijft is `Nova-buitenkant-2.jpg`, zie
hieronder.

`_download-report.json` in die map is het logbestand van de oorspronkelijke migratie (het legt vast dat
`Nova-buitenkant-2.jpg` toen al `bytes: 0, error: true` gaf). Het is geen media; `media:validate` slaat
het over maar laat het staan als bewijsstuk.

### Importeren

```
1.  Kopieer de inhoud naar:   <cms>/media/_import/ameland-residence/
    (die map bestaat nog niet bij een nieuwe tenant — zelf aanmaken)
2.  CMS → Media → "Importeren"
3.  De import maakt per bestand een DB-record aan (tenant-gekoppeld) én verplaatst het bestand;
    de staging-kopie wordt daarna opgeruimd.
```

Let op: een bestand zonder DB-record geeft 404, en een DB-record zonder bestand ook — de import doet
allebei. Handmatig bestanden in `<cms>/media/` zetten werkt dus **niet**. Import is superadmin-only.

De alt-tekst wordt afgeleid uit de bestandsnaam, daarom zijn alle namen bij de migratie genormaliseerd
(`Bungalow%20Ameland%20blogpost.jpg` → `Bungalow-Ameland-blogpost.jpg`). De oude site serveerde
sommige URL's dubbel-encoded, waardoor dezelfde foto onder twee namen bestond; die duplicaten zijn
samengevoegd (279 → 233 unieke assets).

### Één bestand ontbrak — opgelost

`Nova - buitenkant 2.jpg` → in de content `Nova-buitenkant-2.jpg`. De bron is kapot: ook op de live site
geeft die 404, óók op het pad dat hun eigen pagina's gebruiken
(`/media/372/NL/Afbeeldingen/1920x1080xfit@70/Nova%20-%20buitenkant%202.jpg`). Er valt dus niets te
downloaden — de oude site toont daar zelf een gebroken afbeelding. Het `_download-report.json` van de
oorspronkelijke migratie legt dat ook vast (`bytes: 0, error: true`).

De vier verwijzingen zijn daarom omgezet naar een bestaande Villa Nova-foto,
`overzicht-villa-nova-01.jpg` (800×600, dezelfde 4:3-verhouding die de secties croppen):

| Bestand | Pagina | Veld |
|---|---|---|
| `content/nl/pages.json` | `weekendje-ameland` | `sections[1].columns[0].images[0]` |
| `content/de/pages.json` | `wochenende-auf-ameland` | `sections[1].columns[0].images[0]` |
| `content/de/pages.json` | `ferienhaus-auf-ameland-mieten` | `sections[2].image` |
| `content/de/pages.json` | `last-minutes` | `sections[2].image` |

Alle vier de secties gaan over het exterieur en de ligging van de villa, dus een algemene buitenfoto
past inhoudelijk. Wil de klant liever een andere (of een nieuwe) foto: upload hem via CMS → Media en
wijs deze vier velden aan — er is verder niets nodig.

## Nieuwe media daarna

Gewoon via CMS → Media uploaden en in de Content Editor selecteren. De editor schrijft het relatieve
pad `/media/<bestand>` in de content-JSON; verder is er niets nodig.
