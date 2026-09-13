'use client'

import { useEffect } from 'react'

/**
 * Preview-only Visual Editor runtime. Mounted exclusively when `?cms-edit=1` (see Shell).
 *
 * Wire contract v1 — keep in lockstep with the parent editor:
 *   envelope: { __bd: 'bedigital-visual-editor', v: 1, type, payload }
 *   child → parent: ready | select | deselect
 *   parent → child: setValue
 *
 * Outbound postMessage uses an explicit target origin from NEXT_PUBLIC_CMS_EDITOR_ORIGIN
 * (comma-separated allowlist; default http://localhost:3000). Never '*'.
 */

const CHANNEL = 'bedigital-visual-editor' as const
const VERSION = 1 as const
const ANNOTATED = '[data-cms-file][data-cms-locale][data-cms-pointer][data-cms-type]'
const SELECTED_CLASS = 'cms-edit-selected'
const FIELD_TYPES = new Set(['text', 'html', 'image'])

type FieldType = 'text' | 'html' | 'image'

type Envelope = {
  __bd: typeof CHANNEL
  v: typeof VERSION
  type: string
  payload: unknown
}

type Field = {
  file: string
  locale: string
  pointer: string
  type: FieldType
  value: string
}

function editorOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_CMS_EDITOR_ORIGIN ?? 'http://localhost:3000'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '*')
}

function originAllowed(origin: string, allow: readonly string[]): boolean {
  return allow.includes(origin)
}

/** Prefer the real parent origin when it is on the allowlist; otherwise the first listed origin. */
function targetOrigin(allow: readonly string[]): string | null {
  if (allow.length === 0) return null
  try {
    const ancestors = 'ancestorOrigins' in location ? Array.from(location.ancestorOrigins) : []
    for (const origin of ancestors) if (originAllowed(origin, allow)) return origin
  } catch {
    /* ignore */
  }
  try {
    if (document.referrer) {
      const origin = new URL(document.referrer).origin
      if (originAllowed(origin, allow)) return origin
    }
  } catch {
    /* ignore */
  }
  return allow[0]
}

function envelope(type: string, payload: unknown): Envelope {
  return { __bd: CHANNEL, v: VERSION, type, payload }
}

function isEnvelope(data: unknown): data is Envelope {
  if (!data || typeof data !== 'object') return false
  const m = data as Record<string, unknown>
  return m.__bd === CHANNEL && m.v === VERSION && typeof m.type === 'string'
}

function fieldFrom(el: Element): Field | null {
  const file = el.getAttribute('data-cms-file')
  const locale = el.getAttribute('data-cms-locale')
  const pointer = el.getAttribute('data-cms-pointer')
  const type = el.getAttribute('data-cms-type')
  if (!file || !locale || !pointer || !type || !FIELD_TYPES.has(type)) return null
  const value =
    type === 'image'
      ? el.getAttribute('src') || el.querySelector('img')?.getAttribute('src') || ''
      : (el.textContent ?? '')
  return { file, locale, pointer, type: type as FieldType, value }
}

function rectOf(el: Element): { top: number; left: number; width: number; height: number } {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function applySetValue(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return
  const p = payload as Record<string, unknown>
  if (
    typeof p.file !== 'string' ||
    typeof p.locale !== 'string' ||
    typeof p.pointer !== 'string' ||
    typeof p.value !== 'string'
  ) {
    return
  }
  for (const el of document.querySelectorAll(ANNOTATED)) {
    if (
      el.getAttribute('data-cms-file') !== p.file ||
      el.getAttribute('data-cms-locale') !== p.locale ||
      el.getAttribute('data-cms-pointer') !== p.pointer
    ) {
      continue
    }
    const type = el.getAttribute('data-cms-type')
    // Live preview only — never innerHTML, never eval.
    if (type === 'text' || type === 'html') el.textContent = p.value
    return
  }
}

export function CmsEditRuntime({ locale, file }: { locale: string; file?: string }) {
  useEffect(() => {
    const allow = editorOrigins()

    const post = (type: string, payload: unknown) => {
      const origin = targetOrigin(allow)
      if (!origin) return
      window.parent.postMessage(envelope(type, payload), origin)
    }

    post('ready', file ? { locale, file } : { locale })

    let selected: Element | null = null

    const clearSelected = () => {
      selected?.classList.remove(SELECTED_CLASS)
      selected = null
    }

    const selectEl = (el: Element) => {
      const field = fieldFrom(el)
      if (!field) return
      if (selected !== el) {
        clearSelected()
        el.classList.add(SELECTED_CLASS)
        selected = el
      } else {
        // Re-read value/rect in case the live preview already changed the node.
        selected = el
      }
      post('select', { field, rect: rectOf(el) })
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const el = target.closest(ANNOTATED)
      if (el) {
        event.preventDefault()
        event.stopPropagation()
        selectEl(el)
        return
      }
      if (selected) {
        clearSelected()
        post('deselect', {})
      }
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const el = target.closest(ANNOTATED)
      if (el) selectEl(el)
    }

    const onMessage = (event: MessageEvent) => {
      if (!originAllowed(event.origin, allow)) return
      if (!isEnvelope(event.data)) return
      if (event.data.type === 'setValue') applySetValue(event.data.payload)
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('focusin', onFocusIn)
    window.addEventListener('message', onMessage)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('message', onMessage)
      clearSelected()
    }
  }, [locale, file])

  return (
    <>
      <div hidden data-cms-runtime="bedigital-visual-editor" data-cms-runtime-locale={locale} />
      <style>{`
        [data-cms-file] { cursor: pointer; }
        [data-cms-file]:hover { outline: 1px dashed color-mix(in srgb, currentColor 50%, transparent); outline-offset: 2px; }
        [data-cms-file].${SELECTED_CLASS} { outline: 2px solid currentColor; outline-offset: 2px; }
      `}</style>
    </>
  )
}
