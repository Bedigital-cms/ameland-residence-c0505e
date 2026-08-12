'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { LocaleLink } from './LocaleLink'
import { Media } from './Media'
import type { ResultVilla } from './VillaResultCard'

/**
 * The `kaart` view: the villas of the current result set, pinned on a map.
 *
 * Deliberately built from plain OpenStreetMap raster tiles rather than a mapping library — the page
 * needs pins on a slippy map, not routing or vector styling, and this keeps it to a handful of
 * <img> tags with no third-party script, no API key and nothing to keep in sync. Tiles come from
 * openstreetmap.org, whose attribution is required and shown bottom-right.
 *
 * The frame fills whatever width the results column gives it and is dragged with the pointer, so
 * the map behaves like the slippy maps guests expect rather than a fixed picture.
 *
 * Villas without coordinates never reach this component; the caller lists those separately.
 */

const COPY = {
  nl: { zoomIn: 'inzoomen', zoomOut: 'uitzoomen', close: 'sluiten', more: 'meer info' },
  de: { zoomIn: 'vergrößern', zoomOut: 'verkleinern', close: 'schließen', more: 'mehr Infos' },
} as const

const TILE = 256
/** Frame height. The width comes from the container, so only this is fixed. */
const HEIGHT = 512
/** Width to assume for the first paint, before the container has been measured. */
const FALLBACK_WIDTH = 768

const MIN_ZOOM = 10
const MAX_ZOOM = 16

/** Popup width, mirrored in `.vmap-card`; needed here to keep it inside the frame. */
const CARD_W = 210

/* Web Mercator, the projection the tiles are cut on. Coordinates go to fractional tile numbers;
 * the whole-number part picks the tile, the fraction is the position inside it. */
function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 2 ** zoom
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom
}

export function VillaMap({ villas, locale }: { villas: ResultVilla[]; locale: string }) {
  const copy = COPY[locale === 'de' ? 'de' : 'nl']
  const [zoom, setZoom] = useState(0)
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  // True while a drag is in flight. A ref, not state: the pointer handlers read it on the very next
  // event, which can arrive before React has re-rendered.
  const active = useRef(false)
  // How far the guest has dragged the map away from the framing the result set computed, in pixels
  // at the current zoom. Reset whenever that framing changes, so a new search re-centres.
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // The frame is as wide as the results column, so it has to be measured rather than assumed —
  // a ResizeObserver keeps it right through sidebar collapses and window resizes alike.
  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return
    const apply = () => setWidth(el.clientWidth || FALLBACK_WIDTH)
    apply()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Frame the whole set: centre on the middle of its bounding box, then pick the closest zoom that
  // still fits every pin. Recomputed per result set, so filtering re-frames the map automatically.
  const view = useMemo(() => {
    const lats = villas.map((v) => v.latitude!)
    const lngs = villas.map((v) => v.longitude!)
    return {
      centerLat: (Math.min(...lats) + Math.max(...lats)) / 2,
      centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [villas])

  // The zoom that fits every pin. Kept apart from `view` because it depends on the measured width:
  // folding it in would make the framing — and with it the pan reset below — churn on every resize.
  const fitZoom = useMemo(() => {
    const lats = villas.map((v) => v.latitude!)
    const lngs = villas.map((v) => v.longitude!)
    for (let zl = MAX_ZOOM; zl > MIN_ZOOM; zl--) {
      const xs = lngs.map((l) => lngToTileX(l, zl) * TILE)
      const ys = lats.map((l) => latToTileY(l, zl) * TILE)
      // Leave a margin so pins never sit against the frame edge.
      if (Math.max(...xs) - Math.min(...xs) < width - 96 && Math.max(...ys) - Math.min(...ys) < HEIGHT - 96) {
        return zl
      }
    }
    return MIN_ZOOM
  }, [villas, width])

  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom + zoom))

  // Zooming and re-framing both invalidate a drag: the offset was measured in pixels at the old
  // zoom, so keeping it would throw the map off by a growing distance. A resize can change the
  // fitted zoom too, so the reset is skipped while a drag is in flight — otherwise a scrollbar
  // appearing mid-gesture would snap the map back under the guest's hand.
  useEffect(() => {
    if (active.current) return
    setPan({ x: 0, y: 0 })
  }, [z, view])

  // The centre in pixel space, and the top-left corner of the frame around it. Dragging moves the
  // map under a fixed frame, so the pan offset is subtracted from the origin.
  const centerX = lngToTileX(view.centerLng, z) * TILE
  const centerY = latToTileY(view.centerLat, z) * TILE
  const originX = centerX - width / 2 - pan.x
  const originY = centerY - HEIGHT / 2 - pan.y

  // Which tiles cover the frame, and where each one sits inside it.
  const tiles: { key: string; src: string; left: number; top: number }[] = []
  const firstCol = Math.floor(originX / TILE)
  const firstRow = Math.floor(originY / TILE)
  const max = 2 ** z
  for (let col = firstCol; col <= Math.floor((originX + width) / TILE); col++) {
    for (let row = firstRow; row <= Math.floor((originY + HEIGHT) / TILE); row++) {
      // Wrap horizontally at the date line; vertically there is nothing beyond the poles.
      if (row < 0 || row >= max) continue
      const x = ((col % max) + max) % max
      tiles.push({
        key: `${z}-${col}-${row}`,
        src: `https://tile.openstreetmap.org/${z}/${x}/${row}.png`,
        left: col * TILE - originX,
        top: row * TILE - originY,
      })
    }
  }

  const pins = villas.map((v) => ({
    villa: v,
    left: lngToTileX(v.longitude!, z) * TILE - originX,
    top: latToTileY(v.latitude!, z) * TILE - originY,
  }))

  const open = pins.find((p) => p.villa.slug === openSlug)

  /* Drag to pan.
   *
   * Pointer events cover mouse, touch and pen in one path, and capturing the pointer means a drag
   * that leaves the frame still tracks until release. The gesture is committed on move rather than
   * on down, so a plain click on a pin is never swallowed by the drag handler.
   */
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const draggedRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only the primary button drags; right-click keeps the browser's own menu.
    if (e.button !== 0) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    active.current = false
    draggedRef.current = false
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!active.current) {
      // A few pixels of slop, so a click with a shaky hand still reads as a click. The origin stays
      // put until the gate opens, so the movement that crosses it is not lost.
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
      active.current = true
      draggedRef.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    drag.current = { id: d.id, x: e.clientX, y: e.clientY }
    // The map follows the hand: dragging right moves the content right, which means looking at a
    // point further WEST — so the pan offset grows with the pointer delta and is subtracted from
    // the frame origin below.
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }, [])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      drag.current = null
    }
    active.current = false
    setDragging(false)
  }, [])

  // A drag that ends over a pin still fires that pin's click. Swallowing the click in the capture
  // phase — only when a drag actually happened — keeps releasing the mouse from opening a card the
  // guest never meant to tap.
  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggedRef.current) return
    draggedRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return (
    <div className="vmap">
      <div
        ref={frameRef}
        className={`vmap-frame${dragging ? ' vmap-frame--dragging' : ''}`}
        style={{ height: HEIGHT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={t.src} alt="" className="vmap-tile" style={{ left: t.left, top: t.top }} loading="lazy" />
        ))}

        {pins.map((p) => (
          <button
            key={p.villa.slug}
            type="button"
            className={`vmap-pin${openSlug === p.villa.slug ? ' vmap-pin--on' : ''}`}
            style={{ left: p.left, top: p.top }}
            title={p.villa.title}
            aria-label={p.villa.title}
            onClick={() => setOpenSlug(openSlug === p.villa.slug ? null : p.villa.slug)}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
              <path
                d="M12 22s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
                fill="currentColor"
                stroke="#fff"
                strokeWidth="1.4"
              />
              <circle cx="12" cy="11" r="2.6" fill="#fff" />
            </svg>
          </button>
        ))}

        {/* The card for the pin the guest tapped, kept inside the frame: a pin near an edge would
            otherwise push its card half out of view. */}
        {open && (
          <div
            className="vmap-card"
            style={{ left: Math.min(Math.max(open.left, CARD_W / 2 + 8), width - CARD_W / 2 - 8), top: open.top }}
          >
            <button type="button" className="vmap-card-close" aria-label={copy.close} onClick={() => setOpenSlug(null)}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
            </button>
            <LocaleLink href={open.villa.url} className="vmap-card-media">
              <Media src={open.villa.image} alt={open.villa.title} shape="card" />
            </LocaleLink>
            <div className="vmap-card-body">
              <LocaleLink href={open.villa.url} className="vmap-card-title">
                {open.villa.title}
              </LocaleLink>
              {(open.villa.priceFrom || open.villa.priceTo) && (
                <p className="vmap-card-price">
                  € {open.villa.priceFrom || open.villa.priceTo}
                  {open.villa.priceTo && open.villa.priceFrom ? ` - ${open.villa.priceTo}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="vmap-zoom">
          <button type="button" aria-label={copy.zoomIn} onClick={() => setZoom((v) => v + 1)} disabled={z >= MAX_ZOOM}>
            +
          </button>
          <button type="button" aria-label={copy.zoomOut} onClick={() => setZoom((v) => v - 1)} disabled={z <= MIN_ZOOM}>
            −
          </button>
        </div>

        {/* Required by the OpenStreetMap tile usage policy. */}
        <a className="vmap-attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </div>
    </div>
  )
}
