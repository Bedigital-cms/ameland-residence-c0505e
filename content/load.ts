/**
 * Locale-aware content reader.
 *
 * Content lives at `content/<locale>/<name>.json` (e.g. content/nl/home.json, content/en/home.json).
 * This reads a given file for a given locale at build time (Server Components / generateStaticParams),
 * falling back to the site's default locale when a translation is missing — so a half-translated
 * site still renders (default-language text) instead of 404ing.
 *
 * Because loading is runtime `fs` (not a static import), activating a new language is purely a data
 * change: add a `content/<code>/` folder and list the code in `content/i18n.json`. No code edit here.
 *
 * Server-only.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { defaultLocale, resolveLocale } from '@/lib/i18n'

const CONTENT_DIR = path.join(process.cwd(), 'content')

function readJson(locale: string, name: string): unknown | null {
  try {
    return JSON.parse(readFileSync(path.join(CONTENT_DIR, locale, `${name}.json`), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Load `content/<locale>/<name>.json`. If the requested locale isn't active or the file is missing
 * there, fall back to the default locale. Throws only if the default locale's file is also missing
 * (a genuine content error the build should surface).
 */
export function loadContent<T>(name: string, locale: string): T {
  const wanted = resolveLocale(locale)
  const data = readJson(wanted, name) ?? readJson(defaultLocale(), name)
  if (data === null) {
    throw new Error(`Missing content: content/${defaultLocale()}/${name}.json`)
  }
  return data as T
}

/** Read the flat, language-neutral forms file (content/forms.json) — the canonical structure. */
function readFlatForms(): { forms?: Record<string, unknown> } | null {
  try {
    return JSON.parse(readFileSync(path.join(CONTENT_DIR, 'forms.json'), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Load a single form definition for a locale, with its DISPLAY text localized.
 *
 * Forms are language-neutral by structure (field names, types, email) but their labels/placeholders/
 * button/success text should read in the visitor's language. So the CMS generates a same-shape
 * `content/<locale>/forms.json` (translated text) alongside the canonical flat `content/forms.json`.
 * We prefer the per-locale file, fall back to the default locale's, then to the flat file — so a
 * single-language site (only the flat file) and a half-translated site both keep working. Submissions
 * always post the field `name`s (identical across languages), which the CMS validates against the flat
 * file — this only changes the on-screen wording. Server-only.
 */
export function loadForm<T = unknown>(slug: string, locale: string): T | null {
  const wanted = resolveLocale(locale)
  const file =
    (readJson(wanted, 'forms') as { forms?: Record<string, unknown> } | null) ??
    (readJson(defaultLocale(), 'forms') as { forms?: Record<string, unknown> } | null) ??
    readFlatForms()
  const form = file?.forms?.[slug]
  return (form as T) ?? null
}
