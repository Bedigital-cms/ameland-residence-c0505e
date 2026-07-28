import * as Flags from 'country-flag-icons/react/3x2'

/**
 * SVG country flag via `country-flag-icons` (renders identically on every OS — emoji flags don't
 * render on Windows/Chrome). `country` is an ISO 3166-1 alpha-2 code (e.g. "nl", "gb"); unknown
 * codes render nothing rather than a broken box.
 */
export function Flag({ country, className }: { country?: string; className?: string }) {
  if (!country) return null
  const Comp = (Flags as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[country.toUpperCase()]
  if (!Comp) return null
  return <Comp className={className} />
}
