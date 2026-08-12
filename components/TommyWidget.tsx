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

/** The two jQuery entry points this component touches on the widget's instance. */
type JQueryLike = {
  data?: (el: Element, key: string) => unknown
  removeData?: (el: Element, key: string) => void
}

export function TommyWidget({
  widget,
  accommodationId,
  booking,
  successUrl,
  beginDate,
  endDate,
  persons,
  adultCategoryId,
}: {
  /** "zoeken" = search all accommodations, "boeken" = calendar for one accommodation. */
  widget: string
  accommodationId?: string
  booking: BookingConfig
  /** Absolute URL Tommy redirects to after a completed booking. */
  successUrl: string
  /** Period to open on, DD-MM-YYYY. */
  beginDate?: string
  endDate?: string
  /** Party size to preselect, as adults. */
  persons?: string
  /** Tommy's id for the adult person category (per account); required to prefill `persons`. */
  adultCategoryId?: number
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

    /*
     * Prefill (period + party) travels in the PAGE QUERY STRING, not in data attributes.
     *
     * The widget reads its startup options from `$.deparam.querystring()` — the address bar — and
     * only a handful of keys are also honoured as `data-*`. Party size in particular is counted per
     * person category (`persoonscategorie[<id>]=<n>`), which has no data-attribute form at all:
     * setting `data-totaalPersonen` leaves `options.persoonscategorie` untouched, and the widget's
     * own guard then refuses with "select at least the number of people, the accommodation, and a
     * start and end date" even though the sidebar shows a party and a price.
     *
     * So the query is written onto the URL before the script boots, and removed again afterwards so
     * the address bar stays clean and the parameters cannot leak into a shared link.
     */
    const url = new URL(window.location.href)
    const original = url.search
    let touched = false
    if (beginDate) { url.searchParams.set('begindatum', beginDate); touched = true }
    if (endDate) { url.searchParams.set('einddatum', endDate); touched = true }
    if (persons && adultCategoryId) {
      url.searchParams.set(`persoonscategorie[${adultCategoryId}]`, persons)
      touched = true
    }
    if (touched) window.history.replaceState(null, '', url.pathname + url.search + url.hash)

    // The script auto-initialises exactly once, on execution, against whatever `#TommyBookingSupport`
    // exists at that moment — no retry, no observer. The browser skips re-executing a script tag it
    // has already cached, so on a client-side navigation the new target would never be picked up.
    // A per-mount query string makes it a distinct resource, forcing the auto-init to run again.
    const script = document.createElement('script')
    script.src = `${SCRIPT_SRC}?_=${widget}-${accommodationId || ''}-${beginDate || ''}-${endDate || ''}-${persons || ''}`
    script.async = true
    script.onerror = () => setFailed(true)
    host.appendChild(script)

    /*
     * Put the address bar back once the widget has finished reading it.
     *
     * Timing matters: the script fetches jQuery and its own plugins first and only then parses the
     * query, so restoring on a fixed delay can beat it to the URL and the prefill is silently lost.
     * Instead we wait for the widget instance to exist (jQuery data key set) and for it to have
     * taken the values, then clean up — with a generous cap so a failed load cannot leave the
     * parameters on screen forever.
     */
    let restored = false
    const restoreUrl = () => {
      if (restored) return
      restored = true
      window.history.replaceState(null, '', window.location.pathname + original + window.location.hash)
    }
    const started = Date.now()
    const poll = touched
      ? window.setInterval(() => {
          const jq = (window as unknown as { jQuery?: JQueryLike }).jQuery
          const instance = jq?.data?.(target, 'TommyBookingSupport') as { options?: Record<string, unknown> } | undefined
          const opts = instance?.options
          const ready = !!opts && (!persons || !!opts.persoonscategorie) && (!beginDate || !!opts.begindatum)
          if (ready || Date.now() - started > 20000) {
            window.clearInterval(poll)
            restoreUrl()
          }
        }, 250)
      : undefined

    return () => {
      if (poll) window.clearInterval(poll)
      restoreUrl()
      // The jQuery plugin bails out early while this data key is still set on the element, so drop
      // it before the target goes away or the next mount silently renders nothing.
      const jq = (window as unknown as { jQuery?: JQueryLike }).jQuery
      jq?.removeData?.(target, 'TommyBookingSupport')
      host.innerHTML = ''
    }
  }, [widget, accommodationId, account, apiKey, booking.language, booking.country, successUrl, beginDate, endDate, persons, adultCategoryId])

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
