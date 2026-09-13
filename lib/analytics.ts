/**
 * Consent-gated GTM/GA4 config for the Ameland marketing site.
 *
 * Env (all optional except CookieFirst when you actually want tags to fire):
 *   NEXT_PUBLIC_GTM_ID_NL          default GTM-TVK2FFG
 *   NEXT_PUBLIC_GTM_ID_DE          default GTM-PFWTV8T
 *   NEXT_PUBLIC_GA4_ID_NL          default G-MYRQZX0ZRB  (loaded via the NL GTM container; not a 2nd tag)
 *   NEXT_PUBLIC_GA4_ID_DE          no default — DE GA4 is unknown; set only if a separate property exists
 *   NEXT_PUBLIC_COOKIEFIRST_ID     CookieFirst site id / API key. UNSET = fail-closed (no CMP ⇒ no tags)
 *   NEXT_PUBLIC_ANALYTICS_ENABLED  `1` force-on (incl. preview/dev) · `0` force-off · unset = auto
 *
 * Auto-on only when NODE_ENV=production AND Vercel env is `production`. Preview (`*.vercel.app`),
 * `next dev`, and a local `next build` stay silent so they cannot pollute production GA4.
 */

export type AnalyticsLanguage = 'nl' | 'de'

export type AnalyticsConfig = {
  locale: string
  language: AnalyticsLanguage
  gtmId: string
  /** Documented / configurable; GTM owns the hit. Empty when a locale has no known property. */
  ga4Id: string
  cookieFirstId: string
  /** `NEXT_PUBLIC_ANALYTICS_ENABLED=1` — bypass the preview/dev host guard. */
  explicitEnable: boolean
}

const DEFAULT_GTM_NL = 'GTM-TVK2FFG'
const DEFAULT_GTM_DE = 'GTM-PFWTV8T'
const DEFAULT_GA4_NL = 'G-MYRQZX0ZRB'

function readEnv(name: string): string {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function analyticsFlag(): 'on' | 'off' | 'auto' {
  const raw = readEnv('NEXT_PUBLIC_ANALYTICS_ENABLED').toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return 'off'
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return 'on'
  return 'auto'
}

/** True when this runtime is allowed to emit marketing tags (still requires a CookieFirst id). */
export function isAnalyticsEnabled(): boolean {
  const flag = analyticsFlag()
  if (flag === 'off') return false
  if (flag === 'on') return true
  if (process.env.NODE_ENV !== 'production') return false
  const vercelEnv = (readEnv('NEXT_PUBLIC_VERCEL_ENV') || readEnv('VERCEL_ENV')).toLowerCase()
  // Vercel preview/dev builds also have NODE_ENV=production.
  if (vercelEnv === 'preview' || vercelEnv === 'development') return false
  if (vercelEnv === 'production') return true
  return false
}

export function languageForLocale(locale: string): AnalyticsLanguage {
  return locale.toLowerCase() === 'de' ? 'de' : 'nl'
}

export function gtmIdForLocale(locale: string): string {
  const language = languageForLocale(locale)
  if (language === 'de') return readEnv('NEXT_PUBLIC_GTM_ID_DE') || DEFAULT_GTM_DE
  return readEnv('NEXT_PUBLIC_GTM_ID_NL') || DEFAULT_GTM_NL
}

/** DE has no documented GA4 property — env only, never invented. */
export function ga4IdForLocale(locale: string): string {
  const language = languageForLocale(locale)
  if (language === 'de') return readEnv('NEXT_PUBLIC_GA4_ID_DE')
  return readEnv('NEXT_PUBLIC_GA4_ID_NL') || DEFAULT_GA4_NL
}

function isUsableCookieFirstId(id: string): boolean {
  if (!id || id.length > 512) return false
  if (id.startsWith('https://consent.cookiefirst.com/')) return !/[<>"']/.test(id)
  // UUID, dashboard key, or domain-hash id (dots/colons/hyphens).
  return /^[A-Za-z0-9._:-]+$/.test(id)
}

function isGtmId(id: string): boolean {
  return /^GTM-[A-Z0-9]+$/i.test(id)
}

export function cookieFirstScriptSrc(id: string): string {
  if (id.startsWith('https://consent.cookiefirst.com/')) return id
  return `https://consent.cookiefirst.com/banner.js?cookiefirst-key=${encodeURIComponent(id)}`
}

/**
 * Resolve the active-locale analytics config, or `null` when nothing may load.
 * Fail-closed: no CookieFirst id ⇒ no GTM/GA4, even if IDs are known.
 */
export function resolveAnalytics(locale: string): AnalyticsConfig | null {
  if (!isAnalyticsEnabled()) return null
  const cookieFirstId = readEnv('NEXT_PUBLIC_COOKIEFIRST_ID')
  if (!isUsableCookieFirstId(cookieFirstId)) return null
  const gtmId = gtmIdForLocale(locale)
  if (!isGtmId(gtmId)) return null
  const language = languageForLocale(locale)
  return {
    locale,
    language,
    gtmId,
    ga4Id: ga4IdForLocale(locale),
    cookieFirstId,
    explicitEnable: analyticsFlag() === 'on',
  }
}

/**
 * One inline bootstrap, in order:
 *   1. skip preview/dev hosts unless explicitly enabled
 *   2. Consent Mode v2 defaults = denied
 *   3. CookieFirst (updates Consent Mode on choice)
 *   4. current-locale GTM only (GA4 lives inside that container — never a 2nd tag, never both locales)
 *
 * dataLayer only receives consent commands and the standard `gtm.js` event. No PII.
 */
export function analyticsBootstrapScript(cfg: AnalyticsConfig): string {
  const gtmId = JSON.stringify(cfg.gtmId)
  const cookieFirstId = JSON.stringify(cfg.cookieFirstId)
  const cookieFirstSrc = JSON.stringify(cookieFirstScriptSrc(cfg.cookieFirstId))
  const language = JSON.stringify(cfg.language)
  const explicit = cfg.explicitEnable ? 'true' : 'false'
  return `(function(){
  var explicit=${explicit};
  var host=(location.hostname||'').toLowerCase();
  if(!explicit&&(host==='localhost'||host==='127.0.0.1'||host==='[::1]'||host==='::1'||/\\.vercel\\.app$/.test(host)||/\\.now\\.sh$/.test(host)))return;

  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag=window.gtag||gtag;
  gtag('consent','default',{
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied',
    analytics_storage:'denied',
    functionality_storage:'denied',
    personalization_storage:'denied',
    security_storage:'granted',
    wait_for_update:2000
  });
  gtag('set','ads_data_redaction',true);

  function granted(v){return v?'granted':'denied';}
  function apply(c){
    if(!c||typeof c!=='object')return;
    var cats=c.categories&&typeof c.categories==='object'?c.categories:c;
    var ads=!!(cats.advertising||cats.ad||cats.marketing);
    var perf=!!(cats.performance||cats.analytics||cats.statistic);
    var func=!!(cats.functional||cats.functionality);
    gtag('consent','update',{
      analytics_storage:granted(perf),
      functionality_storage:granted(func),
      personalization_storage:granted(func),
      ad_storage:granted(ads),
      ad_user_data:granted(ads),
      ad_personalization:granted(ads),
      security_storage:'granted'
    });
  }
  function fromCf(){
    try{var cf=window.CookieFirst;if(cf&&cf.consent)apply(cf.consent);}catch(e){}
  }
  function onCf(ev){
    var d=ev&&ev.detail;if(d)apply(d);
    fromCf();
  }
  window.addEventListener('cf_consent',onCf);
  window.addEventListener('cf_consent_loaded',onCf);
  window.addEventListener('cf_init',fromCf);

  var s=document.createElement('script');
  s.src=${cookieFirstSrc};
  s.async=true;
  s.setAttribute('data-cookiefirst-key',${cookieFirstId});
  s.setAttribute('data-language',${language});
  document.head.appendChild(s);

  window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
  var j=document.createElement('script');
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(${gtmId});
  document.head.appendChild(j);
})();`
}
