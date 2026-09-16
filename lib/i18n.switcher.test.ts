import assert from 'node:assert/strict'
import { test } from 'node:test'

import { activeLocales, switcherLocales } from './i18n'

/**
 * The live site runs per-domain locale mode (nl on .nl, de on .de). The switcher must still be
 * OFFERED in that mode (it links across domains via crossDomainOrigins), so switcherLocales() must
 * return every active locale whenever the site is multi-language — not an empty list.
 */
test('switcherLocales offers all active locales on a multi-language site', () => {
  const active = activeLocales()
  if (active.length >= 2) {
    assert.deepEqual(switcherLocales(), active)
  } else {
    // Single-language site: nothing to switch.
    assert.deepEqual(switcherLocales(), [])
  }
})
