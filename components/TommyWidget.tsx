'use client'

import { useEffect, useRef, useState } from 'react'

import type { BookingConfig } from '@/lib/types'

/**
 * Tommy Booking Support — the availability search and the per-accommodation booking calendar.
 *
 * Tommy ships a single external script that scans the page for a `#TommyBookingSupport` element and
 * renders itself into it. We therefore mount the target div ourselves and load the script once per
 * page; on client-side navigation the previous instance is torn down so the widget re-initialises
 * against the new accommodation instead of showing the old one.
 *
 * Account + API key come from the environment (per tenant), never from content:
 *   NEXT_PUBLIC_TOMMY_ACCOUNT   e.g. AmelandResidence
 *   NEXT_PUBLIC_TOMMY_APIKEY    the public widget key
 * The rest (language, country, success URL) is editable content in site.json.
 */
const SCRIPT_SRC = 'https://api.tommybookingsupport.com/widgets/js/widget.js'

export function TommyWidget({
  widget,
  accommodationId,
  booking,
  successUrl,
}: {
  /** "zoeken" = search all accommodations, "boeken" = calendar for one accommodation. */
  widget: string
  accommodationId?: string
  booking: BookingConfig
  /** Absolute URL Tommy redirects to after a completed booking. */
  successUrl: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  const account = process.env.NEXT_PUBLIC_TOMMY_ACCOUNT || booking.account
  const apiKey = process.env.NEXT_PUBLIC_TOMMY_APIKEY || ''

  useEffect(() => {
    if (!ref.current || !apiKey) return
    const host = ref.current

    // Tommy renders into an element with this exact id; recreate it on every mount so a re-render
    // (or a client-side route change) always hands the script a clean target.
    const target = document.createElement('div')
    target.id = 'TommyBookingSupport'
    target.dataset.widget = widget
    target.dataset.apikey = apiKey
    target.dataset.account = account
    target.dataset.language = booking.language
    target.dataset.country = booking.country
    target.dataset.scroll = '0'
    target.dataset.urlSuccess = successUrl
    if (accommodationId) target.dataset.accommodatie = accommodationId
    host.appendChild(target)

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onerror = () => setFailed(true)
    host.appendChild(script)

    return () => {
      host.innerHTML = ''
    }
  }, [widget, accommodationId, account, apiKey, booking.language, booking.country, successUrl])

  // No key configured (local dev, or before onboarding) → show the placeholder instead of an empty gap.
  if (!apiKey) {
    return (
      <div className="tommy tommy--placeholder">
        <p className="tommy-ph-title">{booking.searchTitle}</p>
        <p className="tommy-ph-text">
          Boekingsmodule niet geconfigureerd — zet <code>NEXT_PUBLIC_TOMMY_APIKEY</code> in de omgeving.
        </p>
      </div>
    )
  }

  return (
    <div className="tommy">
      <div ref={ref} />
      {failed && <p className="tommy-ph-text">De boekingsmodule kon niet geladen worden. Probeer het later opnieuw.</p>}
    </div>
  )
}
