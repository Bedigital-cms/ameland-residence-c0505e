/**
 * Consent-ready GTM config for the Ameland marketing site.
 *
 * GTM id resolution (first match wins):
 *   1. `content/integrations.json` → `tracking` — the BE Digital CMS "Tracking" tab. A present block
 *      is authoritative: enabled + a valid GTM id ⇒ that single container for every locale; disabled
 *      or an invalid id ⇒ no GTM (explicit off).
 *   2. env / built-in defaults (per locale) — used only when the CMS has written no tracking block,
 *      so a site wired the old way keeps working untouched.
 *
 * Env (all optional):
 *   NEXT_PUBLIC_GTM_ID_NL          default GTM-TVK2FFG
 *   NEXT_PUBLIC_GTM_ID_DE          default GTM-PFWTV8T
 *   NEXT_PUBLIC_GA4_ID_NL          default G-MYRQZX0ZRB (loaded via the NL GTM container; not a 2nd tag)
 *   NEXT_PUBLIC_GA4_ID_DE          no default — DE GA4 is unknown; set only if a separate property exists
 *   NEXT_PUBLIC_COOKIEFIRST_ID     optional. When set the site loads CookieFirst directly; when unset,
 *                                  the CMP is expected to be managed inside GTM (Consent Mode stays
 *                                  denied-by-default either way, so tags never fire before consent).
 *   NEXT_PUBLIC_ANALYTICS_ENABLED  `1` force-on (incl. preview/dev) · `0` force-off · unset = auto
 *
 * Auto-on only when NODE_ENV=production AND Vercel env is `production`. Preview (`*.vercel.app`),
 * `next dev`, and a local `next build` stay silent so they cannot pollute production analytics.
 */
import { isGtmId, siteTracking } from './tracking'

export type AnalyticsLanguage = 'nl' | 'de'

export type AnalyticsConfig = {
  locale: string
  language: AnalyticsLanguage
  gtmId: string
  /** Documented / configurable; GTM owns the hit. Empty when a locale has no known property. */
  ga4Id: string
  /** Optional CookieFirst site id. Empty ⇒ the site loads no CMP (managed via GTM instead). */
  cookieFirstId: string
  /** Tenant slug for dataLayer context (best-effort; empty when unknown). */
  tenant: string
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

/** True when this runtime is allowed to emit marketing tags. */
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

/** Per-locale GTM id from env/defaults — the fallback when the CMS has written no tracking block. */
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

export function cookieFirstScriptSrc(id: string): string {
  if (id.startsWith('https://consent.cookiefirst.com/')) return id
  return `https://consent.cookiefirst.com/banner.js?cookiefirst-key=${encodeURIComponent(id)}`
}

/**
 * The GTM container id to inject for `locale`, or `null` when nothing may load.
 *
 * A CMS tracking block is authoritative (enabled+valid ⇒ its id; otherwise off). Without a block we
 * fall back to the per-locale env/default id. Returns `null` for an unusable result so callers can
 * simply skip injection.
 */
export function resolveGtmId(locale: string): string | null {
  const tracking = siteTracking()
  if (tracking) {
    if (!tracking.enabled) return null
    return isGtmId(tracking.gtmId) ? tracking.gtmId.trim() : null
  }
  const envId = gtmIdForLocale(locale)
  return isGtmId(envId) ? envId : null
}

/**
 * Resolve the active-locale analytics config, or `null` when nothing may load.
 *
 * Fail-safe on the runtime guard (preview/dev stay silent) and on a missing/disabled GTM id. Unlike
 * before, a CookieFirst id is NO LONGER required for GTM to load: Consent Mode defaults to denied, so
 * tags stay gated until a CMP (loaded directly or via GTM) grants consent.
 */
export function resolveAnalytics(locale: string): AnalyticsConfig | null {
  if (!isAnalyticsEnabled()) return null
  const gtmId = resolveGtmId(locale)
  if (!gtmId) return null
  const cookieFirstIdRaw = readEnv('NEXT_PUBLIC_COOKIEFIRST_ID')
  const cookieFirstId = isUsableCookieFirstId(cookieFirstIdRaw) ? cookieFirstIdRaw : ''
  const language = languageForLocale(locale)
  return {
    locale,
    language,
    gtmId,
    ga4Id: ga4IdForLocale(locale),
    cookieFirstId,
    tenant: siteTracking()?.tenant || '',
    explicitEnable: analyticsFlag() === 'on',
  }
}

/**
 * One inline bootstrap, in order:
 *   1. skip preview/dev hosts unless explicitly enabled
 *   2. Consent Mode v2 defaults = denied (privacy: nothing fires before consent)
 *   3. seed dataLayer with tenant + locale context (no PII, no pageview event)
 *   4. CookieFirst — only when a site id is configured (else the CMP is managed inside GTM)
 *   5. current-locale GTM only (GA4 lives inside that container — never a 2nd tag, never both locales)
 *
 * dataLayer only receives consent commands, baseline context and the standard `gtm.js` event.
 */
export function analyticsBootstrapScript(cfg: AnalyticsConfig): string {
  const gtmId = JSON.stringify(cfg.gtmId)
  const cookieFirstId = JSON.stringify(cfg.cookieFirstId)
  const cookieFirstSrc = JSON.stringify(cfg.cookieFirstId ? cookieFirstScriptSrc(cfg.cookieFirstId) : '')
  const language = JSON.stringify(cfg.language)
  const tenant = JSON.stringify(cfg.tenant)
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

  window.dataLayer.push({tenant:${tenant},locale:${language},page_path:location.pathname});

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

  if(${cookieFirstSrc}){
    var s=document.createElement('script');
    s.src=${cookieFirstSrc};
    s.async=true;
    s.setAttribute('data-cookiefirst-key',${cookieFirstId});
    s.setAttribute('data-language',${language});
    document.head.appendChild(s);
  }

  window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
  var j=document.createElement('script');
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(${gtmId});
  document.head.appendChild(j);
})();`
}
