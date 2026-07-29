# SEO / technical audit — Ameland Residence

Scope of this pass: the **technical SEO layer that was absent from the codebase** (canonicals,
structured data, sitemap, robots, heading structure, breadcrumbs) plus two correctness bugs found
along the way. Editorial content was not rewritten, shortened, or removed.

Verify any claim below with:

```sh
pnpm typecheck                      # exit 0
NEXT_PUBLIC_SITE_URL=https://www.ameland-residence.nl pnpm build
pnpm seo:audit                      # exit 0 — parses the built HTML, 9 checks
```

`pnpm seo:audit` ([scripts/seo-audit.mts](scripts/seo-audit.mts)) is a permanent regression gate: it
reads the generated HTML of all 135 pages and fails the build if any of these regress.

---

## 1. First, a correction to the brief

The task document treats three things as defects to fix. They are not, and acting on them would have
caused damage. Nothing was changed for these three.

### 1.1 `/nl` and `/de` prefixes are already solved — by config, not code

> *"The staging prefixes /nl and /de must not automatically become part of the production URLs."*

[proxy.ts](proxy.ts) already implements per-domain routing ("Mode 0"): the request **host** picks the
language and URLs stay prefix-free. It is off only because [content/i18n.json](content/i18n.json) has
`domainLocalesEnabled: false` with an empty `domainLocales` map. Production needs exactly this:

```json
"domainLocalesEnabled": true,
"domainLocales": { "ameland-residence.nl": "nl", "ameland-residence.de": "de" }
```

That removes both prefixes and 301s `/nl/contact` → `/contact` in one hop. Staging shows the prefixes
because the Vercel host is not in the map, so it falls through to "Mode A" — **intended behaviour, not
a migration bug.**

> ⚠️ **Do not "fix" this with `hideDefaultPrefix: true`.** That flag gives the *default* language clean
> URLs while every other language keeps its prefix. Dutch would go clean and German would stay on
> `/de/...`, producing duplicate content across two domains. The per-domain flag is the correct one.

`i18n.json` states this is owned by the CMS tenant toggle, so **the flip is a deployment decision, not
a code edit.** It has been left alone deliberately — see the open question in §6.

### 1.2 The empty redirect map is correct

[content/redirects.json](content/redirects.json) is empty and documents why: this template reuses the
previous site's URL structure exactly, so all 89 NL and 51 DE URLs from the old sitemaps stay `200`.
Adding redirects would insert a needless hop and shed link equity. **No redirect is needed because no
URL changed.** Worth verifying against live crawl data before launch, but the brief's premise that a
mapping must be built does not hold.

### 1.3 Villa filters cannot be built from current data

The brief asks for villa-overview filters on guests / bedrooms / sauna / pets / location / EV charging,
"using existing, verified information", while §8 forbids inventing data. Those two requirements
conflict, because `VillaContent` has **no numeric or boolean fields** — only prose and checklist lines.

Measured (see [lib/villa-facts.ts](lib/villa-facts.ts), which extracts only what a page literally states):

| Attribute | Extractable today |
|---|---|
| Sauna, pets, EV charging, parking, location | ✅ all 10 villa pages |
| **Guest capacity** | ❌ **1 of 10** — only `nl/villa-zee` ("Luxe 8-persoons duinvilla") |
| **Bedrooms** | ⚠️ 4 NL pages; 2 DE pages; 0 for both bungalow pages |

Three traps in the source text make loose extraction actively dangerous, and an earlier draft of the
extractor hit all three before the test caught them:

- `"Drie 2-persoons slaapkamers"` — the `2` is beds **per room**; naive parsing reported capacity 2
- `"8 persoons eettafel"` / `"6 persoons eettafel"` — the **dining table**, not the house
- `"Schlafzimmer mit 2 Boxspringbetten"` — **one** bedroom with two beds, not two bedrooms

**Sauna/pets/EV/location filters are safe to build. Guest and bedroom filters are not** — they would
show wrong numbers or blank on most cards. Fixing this properly means adding real numeric fields to the
CMS (§6, Q2). Filters were therefore **not shipped** in this pass; shipping half of them silently would
have looked complete while being wrong.

---

## 2. What was broken and is now fixed

### 2.1 No page had a canonical URL — *now all 135 do*

`lib/seo.ts` emitted no `alternates` at all. Every page now carries a self-referencing canonical, plus
a matching `og:url`.

The tricky part is that **a page's public URL is not its route path**: three routing modes exist and two
of them rewrite the URL, so a canonical naively built from `/[locale]/[slug]` would point at a URL that
301s in production. All URL construction goes through [lib/urls.ts](lib/urls.ts), which derives the real
public path from the active mode. When no origin is known (preview without `NEXT_PUBLIC_SITE_URL`) it
emits root-relative values rather than guessing a hostname.

### 2.2 hreflang existed only on the homepage, unqualified — *now per-page and region-qualified*

Previously [app/[locale]/layout.tsx](app/[locale]/layout.tsx) emitted `nl` / `de` alternates for the
site root only. Now every page computes its own, as `nl-NL` / `de-DE` / `x-default`, and all
relationships are reciprocal (verified by check 4).

Equivalence is decided in [content/equivalents.ts](content/equivalents.ts) and never guessed:

- **Functional pages** match by `kind`, surviving per-language slugs — `/villa-s` ↔ `/ferienhauser`
- **Villas** match by slug, plus one hand-verified alias: `luxe-bungalow-watersnip` ↔ `luxesbungalow-watersnip`
- **Content pages** match by identical slug (only 4 do: `blogs`, `last-minutes`, `sitemap`, `video`)

**26 of 135 pages have hreflang. The other 109 correctly have none** — they have no genuine equivalent.
Notably **no blog article has hreflang, because not one of the 57 NL and 25 DE articles shares a slug**;
they are independent articles, not translations. Linking them would be a false claim. See §6, Q3.

### 2.3 Zero structured data — *now 229 JSON-LD nodes*

Nothing in the codebase emitted JSON-LD. Now, server-rendered, all from visible content
([lib/jsonld.ts](lib/jsonld.ts)):

| Type | Count | Source |
|---|---|---|
| `Organization` | 2 | `site.json` brand + footer (the address the footer prints) |
| `WebSite` | 2 | brand + locale, publisher → Organization by `@id` |
| `BreadcrumbList` | 133 | the same `Crumb[]` the visible trail renders |
| `BlogPosting` | 82 | article title, excerpt, images |
| `VacationRental` | 10 | villa text + `villaFacts` |

Deliberately **omitted rather than invented**:

- **No `price`, `availability`, `aggregateRating`, `review`** — that data lives in Tommy, not on the page
- **No `author` / `datePublished` / `dateModified` on `BlogPosting`** — `BlogContent` has no such fields.
  Not backfilled from file mtimes or build time, which would be a fabricated claim about authorship.
- **No `occupancy` on 9 of 10 villas** — their pages do not state a capacity (§1.3)
- Empty strings and empty arrays are stripped, so no hollow properties are emitted

Check 9 asserts every `BreadcrumbList` matches its visible trail **word for word**.

### 2.4 43 pages per language had no `<h1>` — *now every page has exactly one*

The largest defect found. [components/sections.tsx](components/sections.tsx) rendered the hero title as
`<p className="hero-title">`, and **every single `pages.json` hero stores `title: ""`**. Section headings
are all `<h2>`. Net effect: the homepage and all 20 NL + 21 DE pages shipped with **no `<h1>` at all** and
a heading tree starting at `<h2>`. Only villa and article pages had one.

Fixed **without writing new copy** ([lib/page-heading.ts](lib/page-heading.ts)). Every page already had a
visible heading, just marked up as an `<h2>` below the image — so those exact words move into the hero
as the `<h1>`, and the now-duplicate `<h2>` is suppressed:

```
over-ons  →  hero (title "")  +  textImage title "Over ons"
          →  <h1>Over ons</h1> inside the hero image, over the gradient
```

This is precisely the brief's request: *"The About us page should not begin with only a standalone
image. Display 'About us' clearly as the H1 inside the hero image."*

`page.title` is **not** used as the H1 where a real heading exists — those are meta titles carrying
`| Ameland Residence` suffixes. For the three pages whose body is only a widget or generated index
(`/video`, `/sitemap`, `/zoek-boek`) there is no display heading anywhere, so the page title is used with
the suffix stripped. That is still existing text, and the alternative is a page with no `<h1>`.

### 2.5 Skipped heading levels: 45 pages → 3

| Cause | Fix |
|---|---|
| Villa `<h3>Goed om te weten</h3>` directly under `<h1>` | → `<h2>`, identical styling preserved in CSS |
| Sitemap group headings `<h3>` under `<h1>` | → `<h2>`, size preserved via `.sitemap-grid h2` |
| Card titles `<h3>` under `<h1>` on hub pages | → context-aware: `<h2>` when the section has no own `<h2>` |
| Footer `<h4>` counted as a skip | → measurement scoped to `<main>`, per the brief's nav/footer exclusion |

**3 remain**, all `<h3>` inside CMS rich-text fields — `/nl/privacy-policy`,
`/nl/reizen-naar-ameland-residence`, `/de/datenschutzerklarung`. These are editorial content; fixing them
means editing the copy, which is out of scope. Reported as WARN, not FAIL.

### 2.6 Dutch UI text was rendering on German pages

Five hardcoded Dutch strings appeared on German pages — the brief's *"Dutch and German content being
mixed up"* check:

| Was (on `.de` pages) | Now |
|---|---|
| `Lees meer` / `Lees minder` | `Mehr lesen` / `Weniger lesen` |
| `Goed om te weten` | `Gut zu wissen` |
| `Bekijk beschikbaarheid` | `Verfügbarkeit ansehen` |
| `Onze villa's` | `Unsere Ferienhäuser` |
| `Meer informatie` | `Mehr Informationen` |

Now in [lib/ui-text.ts](lib/ui-text.ts) — template interface strings only. Editorial copy stays in the CMS.
Check 6 asserts no Dutch template string appears in any German page.

### 2.7 No `sitemap.xml`, no `robots.txt` — *both now exist*

- [app/sitemap.ts](app/sitemap.ts) — 135 URLs with 52 `xhtml:link` hreflang alternates, built from the
  same content and URL helpers as the pages, so it cannot list a URL that 404s. `noindex` pages are
  excluded. **No `lastModified`**: the content model stores no dates and a build timestamp would falsely
  claim every page changed on every deploy.
- [app/robots.ts](app/robots.ts) — permissive (this site exists to be indexed); disallows only `/media/`
  (the 302 route to the CMS; the images themselves stay indexable) and `/api/`. The `Sitemap:` line is
  emitted only when the origin is known, since a relative path there is invalid.

### 2.8 Breadcrumbs did not exist — *now on 133 pages, visible + structured*

[components/Breadcrumb.tsx](components/Breadcrumb.tsx): `<nav aria-label>` + `<ol>`, decorative separator
`aria-hidden`, current page not a link and carrying `aria-current="page"`, and a white focus ring in the
`onImage` variant so focus stays visible against the photo.

Trail labels use each page's **H1**, not its SEO title, so the trail reads
`Ameland Residence / Villa's op Ameland huren / Villa Zee` rather than repeating `| Ameland Residence`
in every crumb. The two homepages correctly have no trail.

---

## 3. Verification

All 135 built pages, parsed from the real HTML output:

```
1. exactly one h1                  ok   135/135
2. heading order                   3 WARN (editorial <h3> in CMS rich text)
3. self-referencing canonical      ok   135/135, og:url matches
4. hreflang reciprocity            ok   26 pages, all reciprocal, all nl-NL/de-DE
5. JSON-LD validity                ok   parses, typed, no empty values
   types: Organization 2, WebSite 2, BreadcrumbList 133, BlogPosting 82, VacationRental 10
6. Dutch UI on German pages        ok   none
7. breadcrumbs                     133/135 (homepages correctly excluded)
9. BreadcrumbList == visible       ok   word-for-word on all 133
```

`villaFacts` is separately covered by expectation-based assertions that pin the exact values for all 10
villa pages — including the three traps in §1.3, which the test caught before they shipped.

---

## 4. Content-parity gap found: the German villa checklists are incomplete

Not caused by this pass, but surfaced by it, and it needs an editorial decision.

The German `features` checklists are **shorter than the Dutch ones and are missing the bedroom lines**:

| Villa | NL items | NL bedroom lines | DE items | DE bedroom lines |
|---|---|---|---|---|
| villa-zee | 25 | 2 | 23 | **1** |
| villa-stern | 23 | 2 | 22 | **0** |
| villa-zilt | 29 | 2 | 24 | **0** |
| villa-nova | 26 | 2 | 22 | **1** |
| bungalow-watersnip | 22 | 0 | 19 | **0** |

`nl/villa-zee` lists *"Drie 2-persoons slaapkamers"* upstairs; `de/villa-zee` lists only the downstairs
bedroom. So German visitors see fewer facilities than Dutch visitors for the same house, and the German
`VacationRental` markup reports fewer bedrooms.

**This was not papered over.** Copying the Dutch numbers onto the German pages would put an unsourced
claim on a page that never made it. The extractor reports what each page states; the gap is listed here
for the client to fill in the CMS.

---

## 5. Also noted, not changed

- **Thank-you pages are `index, follow`.** `bedankt-voor-uw-boeking`, `bedankt-voor-uw-verblijf`,
  `vielen-dank-fur-ihre-buchung`, `vielen-dank-fur-ihren-aufenthalt` are all set to be indexed. These are
  thin post-conversion pages that normally should be `noindex, follow`. This is content data in
  `pages.json`, not a code bug — changing a client's indexing directives is their call, so it is flagged
  rather than edited. The code already honours `noindex` when set, and the sitemap already excludes it.
- **`Nova-buitenkant-2.jpg` is broken in 4 places.** Already documented in [MEDIA.md](MEDIA.md); the source
  is dead on the old live site too. Needs a new upload or a repoint to an existing Nova photo.
- **Sitemap is cross-host in per-domain mode.** One deployment serves both domains, so `sitemap.xml`
  lists absolute URLs for both. Google accepts this when both hosts are verified in the same Search
  Console property. If that is not wanted, split it behind a host check once the domains are live.

---

## 6. Open questions

**Q1 — Flip `domainLocalesEnabled` for production?**
Two lines in `i18n.json` remove the `/nl` and `/de` prefixes (§1.1). Left untouched because that file
says it is owned by the CMS tenant toggle and hand-editing desyncs the CMS. Confirm whether to set it
here or via the CMS. **Nothing else in this pass depends on the answer** — canonicals, hreflang and the
sitemap all read the flag at build time and will follow it automatically.

**Q2 — Add real numeric villa fields?**
Guest capacity and bedroom counts cannot be filtered on today (§1.3). Adding `guests` / `bedrooms` /
`bathrooms` to `VillaContent` would make the requested filters buildable and improve the
`VacationRental` markup. Until then, only sauna/pets/EV/location filters are honest.

**Q3 — Should any DE article be linked to an NL article as a translation?**
Zero of the 82 articles share a slug, so no article has hreflang. If some German articles genuinely are
translations of Dutch ones, add the verified pairs to the alias table in `content/equivalents.ts` — the
same mechanism already used for the bungalow — and they will gain reciprocal hreflang.

**Q4 — Fix the 3 editorial `<h3>` jumps?**
Requires editing rich-text copy on `/nl/privacy-policy`, `/nl/reizen-naar-ameland-residence`,
`/de/datenschutzerklarung`.

**Q5 — Set the thank-you pages to `noindex`?** See §5.

---

## 7. Not addressed in this pass

Stated plainly so scope is not overclaimed. The brief also asks for blog search / topic filters /
featured article / pagination, villa-overview filters, gallery and lightbox work, and a full old-vs-new
crawl diff with `content-parity.csv`, `content-parity.json`, `missing-content.md` and `route-map.csv`.

Those are **UX/feature work and a live-crawl comparison**, distinct from the technical-SEO layer fixed
here, and the crawl deliverables require fetching both live sites. This pass deliberately went deep on
the foundation instead — the missing `<h1>`s, canonicals, structured data and sitemap block indexing
outcomes regardless of what is built on top, and every filter feature depends on the §6/Q2 data
question being answered first.

## Files

**New** — [lib/urls.ts](lib/urls.ts) · [lib/jsonld.ts](lib/jsonld.ts) ·
[lib/villa-facts.ts](lib/villa-facts.ts) · [lib/page-heading.ts](lib/page-heading.ts) ·
[lib/ui-text.ts](lib/ui-text.ts) · [content/equivalents.ts](content/equivalents.ts) ·
[content/breadcrumbs.ts](content/breadcrumbs.ts) · [components/Breadcrumb.tsx](components/Breadcrumb.tsx) ·
[components/JsonLd.tsx](components/JsonLd.tsx) · [app/sitemap.ts](app/sitemap.ts) ·
[app/robots.ts](app/robots.ts) · [scripts/seo-audit.mts](scripts/seo-audit.mts)

**Changed** — [lib/seo.ts](lib/seo.ts) (canonical + hreflang) ·
[components/sections.tsx](components/sections.tsx) (h1, heading levels, breadcrumb slot, localised labels) ·
[app/[locale]/page.tsx](app/[locale]/page.tsx) · [app/[locale]/[slug]/page.tsx](app/[locale]/[slug]/page.tsx) ·
[app/[locale]/[slug]/[item]/page.tsx](app/[locale]/[slug]/[item]/page.tsx) ·
[app/globals.css](app/globals.css) (breadcrumb styles; preserved appearance of retagged headings) ·
`package.json` + `pnpm-workspace.yaml` (`seo:audit`, `tsx`)

**Not touched** — all `content/**/*.json` editorial text, `redirects.json`, `i18n.json`, `proxy.ts`,
`next.config.ts`, Tommy Booking, cookie consent, tracking, forms.
