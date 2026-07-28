# Ameland Residence — website template

Luxe vakantieverhuur op Ameland. Next.js 16 (App Router), volledig content-gedreven, tweetalig
(Nederlands + Duits) via **per-domein taal**: `ameland-residence.nl` serveert Nederlands en
`ameland-residence.de` Duits, allebei op schone URL's zonder taalvoorvoegsel.

## Aan de slag

```sh
pnpm install
cp .env.example .env.local     # vul MEDIA_* en NEXT_PUBLIC_TOMMY_APIKEY in
pnpm dev                       # http://localhost:3000
pnpm typecheck && pnpm build   # allebei exit 0 — dit draait het platform ook
```

## Structuur

```
app/
  layout.tsx                 thin pass-through (globals.css)
  not-found.tsx              404 met eigen <html>
  globals.css                het volledige design system
  media/[filename]/route.ts  /media/<bestand> → CMS-media-endpoint
  [locale]/
    layout.tsx               <html lang dir>, fonts, hreflang, metadataBase
    page.tsx                 homepage
    [slug]/page.tsx          ⭐ élke pagina uit pages.json (hubs, contact, landingspagina's)
    [slug]/[item]/page.tsx   ⭐ villa- en artikeldetail onder hun hub (/villa-s/…, /blogs/…)
components/                  Header, Footer, MobileMenu, Shell, sections.tsx, TommyWidget, …
content/
  i18n.json                  taal-config (per-domein)
  editable.json              wat het CMS mag bewerken
  forms.json                 canonieke formulierstructuur
  redirects.json             301-regels (leeg: de URL's zijn gelijk aan de oude site)
  load.ts / *.ts             taalbewuste loaders
  nl/ · de/                  site · home · villas · blogs · pages · forms
lib/                         types, i18n, locales, href, seo
_import/ameland-residence/   gemigreerde media (gitignored — zie MEDIA.md)
```

## Content

| Bestand | Inhoud | nl | de |
|---|---|---|---|
| `site.json` | merk, navigatie, footer, Tommy-instellingen | ✓ | ✓ |
| `home.json` | de homepage als sectielijst | ✓ | ✓ |
| `villas.json` | de vakantiehuizen | 5 | 5 |
| `blogs.json` | de artikelen | 57 | 25 |
| `pages.json` | overzichten, SEO-landings, info, voorwaarden | 20 | 21 |

Alles bij elkaar **133 pagina's**, gerenderd door twee routes. Een nieuwe pagina is een nieuwe sleutel
in JSON — zie [`ai-guide.md`](./ai-guide.md) voor het volledige recept.

## Omgeving

| Variabele | Waarvoor |
|---|---|
| `NEXT_PUBLIC_FORMS_ENDPOINT` | waar het contactformulier naartoe POST (CMS-origin) |
| `MEDIA_PUBLIC_BASE` / `MEDIA_TENANT_SLUG` | media serveren, zie [`MEDIA.md`](./MEDIA.md) |
| `NEXT_PUBLIC_TOMMY_ACCOUNT` / `NEXT_PUBLIC_TOMMY_APIKEY` | de boekingsmodule |
| `NEXT_PUBLIC_SITE_URL` | alleen op previews (absolute success-URL voor Tommy) |

## Deploy

Eén repo, één Vercel-project, twee domeinen. Koppel `ameland-residence.nl` en `ameland-residence.de`
allebei aan het project; `content/i18n.json` → `domainLocales` bepaalt welke taal welk domein krijgt.
# ameland-residence
