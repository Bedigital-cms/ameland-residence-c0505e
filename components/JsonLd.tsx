/**
 * Emits one server-rendered <script type="application/ld+json"> block.
 *
 * Server Component by design: the structured data must be in the HTML the crawler receives, not
 * injected after hydration. It ships no client JavaScript.
 *
 * The JSON is already serialised by `graph()`; `</script>` sequences inside string values are escaped
 * so a stray tag in content can never break out of the script element.
 */
export function JsonLd({ json }: { json: string }) {
  if (!json) return null
  return (
    <script
      type="application/ld+json"
      // Escaping `<` covers the "</script>" break-out; JSON.stringify already handled quotes.
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, '\\u003c') }}
    />
  )
}
