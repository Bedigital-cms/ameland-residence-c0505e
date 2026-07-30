/**
 * Checks on the blog topic classifier — that it covers the whole corpus, spreads sensibly, and that
 * search actually narrows.
 *
 *     pnpm test:blog-topics
 *
 * These are properties rather than fixed expectations, because the corpus is client content that will
 * grow. What must stay true: every article is findable under at least one topic, no topic swallows
 * nearly everything (which is what killed the `seo.keywords` approach), and every topic offered as a
 * filter button actually returns results.
 */
import { readFileSync } from 'node:fs'

import type { BlogCollection } from '../lib/types.js'
import { matchesQuery, topicCounts, topicsFor, topicsOf } from '../lib/blog-topics.js'

let failures = 0
const fail = (msg: string) => {
  console.log(`  FAIL ${msg}`)
  failures++
}

for (const locale of ['nl', 'de']) {
  const blogs = JSON.parse(readFileSync(`content/${locale}/blogs.json`, 'utf8')) as BlogCollection
  const entries = Object.entries(blogs)
  const topics = topicsFor(locale)
  const counts = topicCounts(locale, blogs)

  console.log(`\n=== ${locale.toUpperCase()} — ${entries.length} articles, ${topics.length} topics ===`)

  // 1. Every article must be reachable through at least one topic, or the filter row hides content.
  const orphans = entries.filter(([, b]) => topicsOf(locale, b).length === 0).map(([s]) => s)
  if (orphans.length) fail(`${orphans.length} article(s) match no topic: ${orphans.slice(0, 5).join(', ')}`)
  else console.log(`  ok   every article matches at least one topic`)

  // 2. No topic may be a near-universal bucket — that is the failure mode of keyword-based topics.
  const tooBroad = topics.filter((t) => (counts[t.id] ?? 0) > entries.length * 0.8)
  if (tooBroad.length) fail(`too broad (>80% of articles): ${tooBroad.map((t) => t.id).join(', ')}`)
  else console.log(`  ok   no topic covers more than 80% of the corpus`)

  // 3. Every button offered must return something, or the UI shows a dead control.
  const empty = topics.filter((t) => !counts[t.id])
  if (empty.length) fail(`topic(s) with 0 articles: ${empty.map((t) => t.id).join(', ')}`)
  else console.log(`  ok   every topic has at least one article`)

  // 4. Search must narrow, not match everything.
  const term = locale === 'de' ? 'hund' : 'hond'
  const hits = entries.filter(([, b]) => matchesQuery(b, term)).length
  if (hits === 0) fail(`search "${term}" found nothing`)
  else if (hits === entries.length) fail(`search "${term}" matched every article — not narrowing`)
  else console.log(`  ok   search "${term}" -> ${hits}/${entries.length}`)

  // 5. Multi-term search is AND, so adding a term can only narrow.
  const one = entries.filter(([, b]) => matchesQuery(b, 'ameland')).length
  const two = entries.filter(([, b]) => matchesQuery(b, `ameland ${term}`)).length
  if (two > one) fail(`adding a term widened the result set (${one} -> ${two})`)
  else console.log(`  ok   multi-term search is AND (${one} -> ${two})`)

  // 6. Accent folding: the German corpus mixes "Dünen"/"Dunen" spellings.
  if (locale === 'de') {
    const a = entries.filter(([, b]) => matchesQuery(b, 'dunen')).length
    const c = entries.filter(([, b]) => matchesQuery(b, 'dünen')).length
    if (a !== c) fail(`accent folding asymmetric: "dunen"=${a} but "dünen"=${c}`)
    else console.log(`  ok   accent folding symmetric (${a} both ways)`)
  }

  console.log(
    `  spread: ` +
      topics
        .map((t) => `${t.id}:${counts[t.id] ?? 0}`)
        .join('  '),
  )
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
