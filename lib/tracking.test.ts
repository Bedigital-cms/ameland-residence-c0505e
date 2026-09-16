import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'

import { isGtmId, siteTracking, __resetTrackingCacheForTests } from './tracking'

/** Run `fn` with cwd pointed at a temp repo whose content/integrations.json is `json`. */
function withIntegrations(json: string | null, fn: () => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'ameland-track-'))
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

afterEach(() => __resetTrackingCacheForTests())

test('isGtmId accepts canonical GTM ids and rejects everything else', () => {
  assert.equal(isGtmId('GTM-XXXXXXX'), true)
  assert.equal(isGtmId('GTM-ABC123'), true)
  assert.equal(isGtmId('gtm-abc123'), true) // case-insensitive
  assert.equal(isGtmId('G-MYRQZX0ZRB'), false) // GA4, not GTM
  assert.equal(isGtmId('<script>evil</script>'), false)
  assert.equal(isGtmId(''), false)
  assert.equal(isGtmId(undefined), false)
})

test('siteTracking reads a tracking block (enabled + id + tenant)', () => {
  withIntegrations(
    JSON.stringify({ tracking: { enabled: true, gtmId: 'GTM-ABC123', tenant: 'ameland' }, providers: [] }),
    () => {
      const t = siteTracking()
      assert.deepEqual(t, { enabled: true, gtmId: 'GTM-ABC123', tenant: 'ameland' })
    },
  )
})

test('siteTracking returns null when there is no tracking block (env fallback path)', () => {
  withIntegrations(JSON.stringify({ providers: [], customScripts: [] }), () => {
    assert.equal(siteTracking(), null)
  })
})

test('siteTracking returns null on a missing/invalid file', () => {
  withIntegrations(null, () => assert.equal(siteTracking(), null))
  withIntegrations('{ not json', () => assert.equal(siteTracking(), null))
})

test('a disabled block is preserved as an explicit off', () => {
  withIntegrations(JSON.stringify({ tracking: { enabled: false, gtmId: 'GTM-ABC123' } }), () => {
    assert.deepEqual(siteTracking(), { enabled: false, gtmId: 'GTM-ABC123', tenant: '' })
  })
})
