/**
 * Central locale registry for the i18n system.
 *
 * SUPPORTED_LOCALES is the full catalogue the platform can offer; a given site only *activates*
 * a subset of these (see `content/i18n.json` + `lib/i18n.ts`). Adding a language to a site is a
 * data change (edit i18n.json + add a content/<code>/ folder) — never a code change here, unless
 * the platform wants to offer a brand-new language that isn't in this catalogue yet.
 */
export type LocaleMeta = {
  /** BCP-47-ish code used in URLs and content folder names (e.g. "nl", "zh-CN"). */
  code: string
  /** Native language name shown in the language switcher. */
  label: string
  /** ISO 3166-1 alpha-2 country code (lowercase) for the flag-icons SVG (class `fi fi-<country>`).
   *  A convention mapping each language to a representative country, not a nationality claim. */
  country: string
  /** Emoji flag — kept only as a last-resort fallback (Windows/Chrome don't render these). */
  flag: string
  /** Text direction; "rtl" for Arabic/Hebrew so the layout can flip. */
  dir?: 'rtl'
}

/** The full catalogue of languages a site may activate. Order = display order in pickers.
 *  `country` drives an SVG flag (renders identically on every OS, unlike emoji flags). */
export const SUPPORTED_LOCALES: readonly LocaleMeta[] = [
  { code: 'en', label: 'English', country: 'gb', flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', country: 'nl', flag: '🇳🇱' },
  { code: 'de', label: 'Deutsch', country: 'de', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', country: 'fr', flag: '🇫🇷' },
  { code: 'es', label: 'Español', country: 'es', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', country: 'it', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', country: 'pt', flag: '🇵🇹' },
  { code: 'pl', label: 'Polski', country: 'pl', flag: '🇵🇱' },
  { code: 'da', label: 'Dansk', country: 'dk', flag: '🇩🇰' },
  { code: 'sv', label: 'Svenska', country: 'se', flag: '🇸🇪' },
  { code: 'no', label: 'Norsk', country: 'no', flag: '🇳🇴' },
  { code: 'fi', label: 'Suomi', country: 'fi', flag: '🇫🇮' },
  { code: 'cs', label: 'Čeština', country: 'cz', flag: '🇨🇿' },
  { code: 'hu', label: 'Magyar', country: 'hu', flag: '🇭🇺' },
  { code: 'ro', label: 'Română', country: 'ro', flag: '🇷🇴' },
  { code: 'el', label: 'Ελληνικά', country: 'gr', flag: '🇬🇷' },
  { code: 'tr', label: 'Türkçe', country: 'tr', flag: '🇹🇷' },
  { code: 'ru', label: 'Русский', country: 'ru', flag: '🇷🇺' },
  { code: 'uk', label: 'Українська', country: 'ua', flag: '🇺🇦' },
  { code: 'ar', label: 'العربية', country: 'sa', flag: '🇸🇦', dir: 'rtl' },
  { code: 'he', label: 'עברית', country: 'il', flag: '🇮🇱', dir: 'rtl' },
  { code: 'hi', label: 'हिन्दी', country: 'in', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', country: 'bd', flag: '🇧🇩' },
  { code: 'zh-CN', label: '简体中文', country: 'cn', flag: '🇨🇳' },
  { code: 'zh-TW', label: '繁體中文', country: 'tw', flag: '🇹🇼' },
  { code: 'ja', label: '日本語', country: 'jp', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', country: 'kr', flag: '🇰🇷' },
] as const

const BY_CODE = new Map(SUPPORTED_LOCALES.map((l) => [l.code, l]))

/** Look up a locale's metadata by code, or undefined if the code isn't in the catalogue. */
export function localeMeta(code: string): LocaleMeta | undefined {
  return BY_CODE.get(code)
}

/** Whether a locale code exists in the catalogue at all (not whether a site activated it). */
export function isSupportedLocale(code: string): boolean {
  return BY_CODE.has(code)
}

/** Text direction for a locale ("ltr" default, "rtl" for Arabic/Hebrew). */
export function localeDir(code: string): 'ltr' | 'rtl' {
  return BY_CODE.get(code)?.dir === 'rtl' ? 'rtl' : 'ltr'
}
