'use client'

import { useState, type ReactNode } from 'react'

import { Icon } from './icons'

/** Collapsible extra copy — villa pages carry long "Inrichting / Ligging" sections that would
 *  otherwise push the gallery and the booking calendar far below the fold. */
export function ReadMore({ children, moreLabel, lessLabel }: { children: ReactNode; moreLabel: string; lessLabel: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`readmore${open ? ' is-open' : ''}`}>
      <div className="readmore-body" hidden={!open}>{children}</div>
      <button type="button" className="readmore-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? lessLabel : moreLabel}
        <Icon name="arrow" size={15} />
      </button>
    </div>
  )
}
