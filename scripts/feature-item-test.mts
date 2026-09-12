/**
 * The two checklist storage forms must be indistinguishable to the site.
 *
 * `features[].items` accepts a plain string ("Campingbedjes (2)") or a structured item
 * ({ label: "Campingbedjes", qty: 2 }). The conversion will happen gradually, group by group, over ~250
 * lines in two languages. That is only safe if converting one line provably changes nothing a visitor or
 * a crawler can see.
 *
 * So this takes the REAL content, converts every checklist line to the structured form, and asserts that
 * the derived facts come out identical. The risky one is bedrooms: `roomsOnLine()` reads a trailing "(3)"
 * as a room count, so if the structured form did not render its qty back into the text, every restored
 * room count would quietly collapse to 1 — a wrong number in the JSON-LD, on a page that still looked
 * right. This is exactly the failure the union type could otherwise introduce.
 */
import { readFileSync } from 'node:fs'

import { featureText } from '../lib/features.js'
import type { FeatureItem, VillaContent } from '../lib/types.js'
import { villaFacts } from '../lib/villa-facts.js'

/** "Campingbedjes (2)" -> { label: "Campingbedjes", qty: 2 }; anything else -> { label }. */
function toStructured(item: FeatureItem): FeatureItem {
  if (typeof item !== 'string') return item
  const m = item.match(/^(.*?)\s*\((\d+)\)\s*$/)
  return m ? { label: m[1], qty: Number(m[2]) } : { label: item }
}

function convert(v: VillaContent): VillaContent {
  return {
    ...v,
    features: (v.features ?? []).map((g) => ({ ...g, items: g.items.map(toStructured) })),
  }
}

let fail = 0
let converted = 0

console.log('\n=== string vs { label, qty }: same facts, same text ===')

for (const loc of ['nl', 'de']) {
  const villas = JSON.parse(readFileSync(`content/${loc}/villas.json`, 'utf8')) as Record<string, VillaContent>

  for (const [slug, villa] of Object.entries(villas)) {
    const structured = convert(villa)
    const a = villaFacts(villa)
    const b = villaFacts(structured)

    const diffs: string[] = []
    for (const key of ['guests', 'bedrooms', 'bathrooms', 'petsAllowed', 'locality', 'sauna', 'evCharging'] as const) {
      if (a[key] !== b[key]) diffs.push(`${key}: ${String(a[key])} -> ${String(b[key])}`)
    }
    if (a.amenities.map((x) => x.name).join('|') !== b.amenities.map((x) => x.name).join('|')) {
      diffs.push('amenities differ')
    }

    // And the rendered line itself must be byte-identical, or the visible page changed.
    const before = (villa.features ?? []).flatMap((g) => g.items).map(featureText)
    const after = (structured.features ?? []).flatMap((g) => g.items).map(featureText)
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) diffs.push(`text: "${before[i]}" -> "${after[i]}"`)
    }

    converted += before.length
    const k = `${loc}/${slug}`
    if (diffs.length > 0) {
      fail++
      console.log('FAIL', k.padEnd(30), diffs.join('; '))
    } else {
      console.log('ok  ', k.padEnd(30), `${before.length} line(s) round-trip unchanged`)
    }
  }
}

console.log(`\n${converted} checklist line(s) checked in both forms.`)
console.log(fail === 0 ? 'BOTH FORMS EQUIVALENT' : `\n${fail} VILLA(S) CHANGED WHEN CONVERTED`)
process.exit(fail === 0 ? 0 : 1)
