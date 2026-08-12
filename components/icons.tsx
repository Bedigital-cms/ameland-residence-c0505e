/** Minimal inline-SVG icon set (no external icon lib — keeps the template self-contained and
 *  React-19 safe). Add a path here and reference it by `name` from content JSON. */
import type { CSSProperties } from 'react'

const paths: Record<string, string> = {
  // island / coast
  wave: 'M2 12c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 17c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 7c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2',
  dune: 'M2 18c3-6 6-3 9-7s7-2 11 7z',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m11.4 0 1.4 1.4M4.9 4.9l1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  bike: 'M6 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm12 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM9 14.5 12 7h3M8 7h4m2.5 0 3.5 7.5',
  // villa / comfort
  home: 'M3 11 12 3l9 8M5 10v10h14V10M10 20v-6h4v6',
  sauna: 'M8 20V9a4 4 0 0 1 8 0v11M6 20h12M9 6V4m3 2V3.5M15 6V4',
  bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM7 12V6a2 2 0 0 1 4 0M6 21l-1 1m14-1 1 1',
  wifi: 'M5 12.5a10 10 0 0 1 14 0M8 16a5.5 5.5 0 0 1 8 0M12 19.5h.01M2 9a15 15 0 0 1 20 0',
  fire: 'M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 1.5.8 2.5 1.8 2.5C12.5 10 11 7 12 3z',
  car: 'M5 16h14M6.5 16V19a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-3m14 0v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3M4 16l1.6-5.2A2 2 0 0 1 7.5 9.4h9a2 2 0 0 1 1.9 1.4L20 16v0H4zm3 -2.5h.01M17 13.5h.01',
  dog: 'M10 5 8 3 6 5v4l-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6l-2-2V5l-2-2-2 2M9 13h.01M15 13h.01M10.5 17h3',
  key: 'M14 7a4 4 0 1 1-3.2 6.4L4 20H2v-2l6.6-6.8A4 4 0 0 1 14 7zm2.5 2.5h.01',
  // trust / ui
  star: 'M12 2l2.9 6.3L22 9.3l-5 4.7 1.2 6.9L12 17.6 5.8 20.9 7 14 2 9.3l7.1-1z',
  check: 'M4 12l5 5L20 6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  phone: 'M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 1-2z',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  play: 'M8 5.5v13l11-6.5z',
  close: 'M6 6l12 12M18 6L6 18',
  // socials
  facebook: 'M14 9h3V5h-3c-2.2 0-4 1.8-4 4v2H7v4h3v6h4v-6h3l1-4h-4V9a1 1 0 0 1 1-1z',
  instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm5.5-.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  youtube: 'M22 12s0-3.5-.5-5c-.3-1-1-1.7-2-2C17.8 4.5 12 4.5 12 4.5s-5.8 0-7.5.5c-1 .3-1.7 1-2 2C2 8.5 2 12 2 12s0 3.5.5 5c.3 1 1 1.7 2 2 1.7.5 7.5.5 7.5.5s5.8 0 7.5-.5c1-.3 1.7-1 2-2 .5-1.5.5-5 .5-5zM10 15V9l5 3z',
  social: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 3.5M15.4 7L8.6 10.5',
}

/** `filled` maakt er een dichte vorm van in plaats van een lijntekening — nodig voor de sterren. */
export function Icon({ name, size = 24, style, className, filled = false }: { name: string; size?: number; style?: CSSProperties; className?: string; filled?: boolean }) {
  const d = paths[name] || paths.check
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
