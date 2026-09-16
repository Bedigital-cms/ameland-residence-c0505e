import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import {
  analyticsBootstrapScript,
  resolveAnalytics,
  resolveGtmId,
  type AnalyticsConfig,
} from './analytics'
import { __resetTrackingCacheForTests } from './tracking'

const ENV_KEYS = [
  'NEXT_PUBLIC_ANALYTICS_ENABLED',
  'NEXT_PUBLIC_GTM_ID_NL',
  'NEXT_PUBLIC_GTM_ID_DE',
  'NEXT_PUBLIC_COOKIEFIRST_ID',
  'NEXT_PUBLIC_VERCEL_ENV',
  'VERCEL_ENV',
]
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  // Force-on so tests don't depend on NODE_ENV / Vercel host gating.
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = '1'
  delete process.env.NEXT_PUBLIC_COOKIEFIRST_ID
  __resetTrackingCacheForTests()
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  __resetTrackingCacheForTests()
})

/** Point cwd at a temp repo whose content/integrations.json is `json` (or none) for `fn`. */
function withIntegrations(json: string | null, fn: () => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'ameland-an-'))
  mkdirSync(path.join(dir, 'content'), { recursive: true })
  if (json !== null) writeFileSync(path.join(dir, 'content', 'integrations.json'), json)
  const prev = process.cwd()
  process.chdir(dir)
  __resetTrackingCacheForTests()
  try {
    fn()
  } finally {
    process.chdir(prev)
    __resetTrackingCacheForTests()
    rmSync(dir, { recursive: true, force: true })
  }
}

const cfg = (over: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  locale: 'nl',
  language: 'nl',
  gtmId: 'GTM-ABC123',
  ga4Id: '',
  cookieFirstId: '',
  tenant: 'ameland',
  explicitEnable: true,
  ...over,
})

test('disabled runtime → resolveAnalytics is null (no GTM markup)', () => {
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = '0'
  withIntegrations(null, () => assert.equal(resolveAnalytics('nl'), null))
})

test('CMS tracking block: enabled + valid id is authoritative for every locale', () => {
  withIntegrations(JSON.stringify({ tracking: { enabled: true, gtmId: 'GTM-TENANT1' } }), () => {
    assert.equal(resolveGtmId('nl'), 'GTM-TENANT1')
    assert.equal(resolveGtmId('de'), 'GTM-TENANT1')
  })
})

test('CMS tracking block: disabled → no GTM (explicit off)', () => {
  withIntegrations(JSON.stringify({ tracking: { enabled: false, gtmId: 'GTM-TENANT1' } }), () => {
    assert.equal(resolveGtmId('nl'), null)
    assert.equal(resolveAnalytics('nl'), null)
  })
})

test('CMS tracking block: invalid id is ignored (rejected, not injected)', () => {
  withIntegrations(JSON.stringify({ tracking: { enabled: true, gtmId: 'not-a-gtm-id' } }), () => {
    assert.equal(resolveGtmId('nl'), null)
    assert.equal(resolveAnalytics('nl'), null)
  })
})

test('no CMS block → per-locale env id is used (tenant isolation via env)', () => {
  process.env.NEXT_PUBLIC_GTM_ID_NL = 'GTM-ENVNL'
  process.env.NEXT_PUBLIC_GTM_ID_DE = 'GTM-ENVDE'
  withIntegrations(JSON.stringify({ providers: [] }), () => {
    assert.equal(resolveGtmId('nl'), 'GTM-ENVNL')
    assert.equal(resolveGtmId('de'), 'GTM-ENVDE')
    const c = resolveAnalytics('de')
    assert.ok(c)
    assert.equal(c?.gtmId, 'GTM-ENVDE')
  })
})

test('bootstrap injects exactly one GTM loader for the resolved id', () => {
  const script = analyticsBootstrapScript(cfg({ gtmId: 'GTM-ONCE1' }))
  const loaders = script.match(/googletagmanager\.com\/gtm\.js\?id=/g) || []
  assert.equal(loaders.length, 1, 'exactly one gtm.js loader (no duplicate injection)')
  assert.match(script, /encodeURIComponent\("GTM-ONCE1"\)/)
})

test('bootstrap keeps Consent Mode v2 denied-by-default and redacts ads data', () => {
  const script = analyticsBootstrapScript(cfg())
  assert.match(script, /consent','default'/)
  assert.match(script, /ad_storage:'denied'/)
  assert.match(script, /analytics_storage:'denied'/)
  assert.match(script, /ads_data_redaction',true/)
})

test('bootstrap seeds a minimal dataLayer context (tenant + locale, no PII)', () => {
  const script = analyticsBootstrapScript(cfg({ tenant: 'ameland', language: 'de' }))
  assert.match(script, /tenant:"ameland"/)
  assert.match(script, /locale:"de"/)
  assert.match(script, /page_path:location\.pathname/)
})

test('CookieFirst loader is only present when a site id is configured', () => {
  const without = analyticsBootstrapScript(cfg({ cookieFirstId: '' }))
  assert.doesNotMatch(without, /consent\.cookiefirst\.com/)

  const withId = analyticsBootstrapScript(cfg({ cookieFirstId: 'abc-123-key' }))
  assert.match(withId, /consent\.cookiefirst\.com\/banner\.js/)
})
