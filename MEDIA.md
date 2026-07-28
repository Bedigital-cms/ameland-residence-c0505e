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

| Bestand | Waar | Zonder import |
|---|---|---|
| `logo-ameland-residence-donker01.svg` | `site.json` → `logo` (header + footer) | tekstwoordmerk "Ameland Residence" |
| `ameland-residence-label.png` | `site.json` → `footer.badge` | lege plek in de footer |
| `bg-patroon-donker-transparant01.svg` | `.footer` in `globals.css` | footer blijft vlak `--stone` |
| `bg-effect02.svg` | kolomsectie met `background: "effect"` | die sectie blijft zonder band |
| `usp-icoon-*.svg` (3×) | `columns` → `list` → `icon` | terugval op een vinkje in een cirkel |

Deze map staat **bewust in `.gitignore`**. Het is een eenmalig afleveringsartefact: 149 MB hoort niet
mee te reizen met elke tenant-kopie van deze repo.

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

### Één bestand ontbreekt

`Nova - buitenkant 2.jpg` → in de content `Nova-buitenkant-2.jpg`. De bron is kapot: ook op de live
site geeft die 404, óók op het pad dat hun eigen pagina's gebruiken
(`/media/372/NL/Afbeeldingen/1920x1080xfit@70/Nova%20-%20buitenkant%202.jpg`). Er valt dus niets te
downloaden — de oude site toont daar zelf een gebroken afbeelding.

De content verwijst er op **vier** plekken naar:

| Bestand | Pagina | Veld |
|---|---|---|
| `content/nl/pages.json` | `weekendje-ameland` | `sections[1].columns[0].images[0]` |
| `content/de/pages.json` | `wochenende-auf-ameland` | `sections[1].columns[0].images[0]` |
| `content/de/pages.json` | `ferienhaus-auf-ameland-mieten` | `sections[2].image` |
| `content/de/pages.json` | `last-minutes` | `sections[2].image` |

Oplossing: laat de klant een nieuwe foto uploaden, of zet deze vier velden op een bestaande
Villa Nova-foto (bijvoorbeeld `/media/Overzicht-Villa-Nova-01.jpg` of
`/media/ameland-villa-nova-tuin-terras.jpg`). Zolang het pad blijft staan, laat de site daar een
gebroken `<img>` zien — een leeg pad zou juist een nette placeholder geven.

## Nieuwe media daarna

Gewoon via CMS → Media uploaden en in de Content Editor selecteren. De editor schrijft het relatieve
pad `/media/<bestand>` in de content-JSON; verder is er niets nodig.
