'use client'

import { useEffect } from 'react'

/**
 * Preview-only Visual Editor runtime (child side of the bridge).
 *
 * Only active on a `?cms-edit=1` preview that is embedded inside the BE Digital customer editor. It
 * matches the frozen wire contract in bedigital-ai (`src/lib/website/bridge.ts`):
 *
 *   envelope: { __bd: 'bedigital-visual-editor', v: 1, type, payload }
 *   child → parent: `ready` { locale }, `select` { field, rect }, `deselect` {}
 *   parent → child: `setValue` { file, locale, pointer, value }
 *
 * It reads the `data-cms-*` annotations already emitted by <Editable> to describe the clicked field,
 * and applies live parent edits back onto the same element. It renders nothing and adds no listeners
 * on the public site (no `?cms-edit=1`) or when embedded by an untrusted origin (fail closed).
 *
 * Security: messages are only ever posted to — and accepted from — a single trusted parent origin
 * (the deployed customer portal, https://bedigital.ai by default; override with
 * NEXT_PUBLIC_CMS_EDITOR_ORIGINS). Never posts to '*'; never evals.
 */

const CHANNEL = 'bedigital-visual-editor'
const VERSION = 1

/** Editor parent origins allowed to drive this preview. bedigital.ai is the live customer portal. */
const DEFAULT_PARENT_ORIGINS = [
  'https://bedigital.ai',
  'https://www.bedigital.ai',
  'http://localhost:3000',
]

type CmsType = 'text' | 'html' | 'image'
type CmsField = { file: string; locale: string; pointer: string; type: CmsType; value: string }

function allowedParentOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_CMS_EDITOR_ORIGINS
  const parsed = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        const u = new URL(s)
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null
      } catch {
        return null
      }
    })
    .filter((o): o is string => Boolean(o))
  return parsed.length ? Array.from(new Set(parsed)) : DEFAULT_PARENT_ORIGINS
}

function editModeOn(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('cms-edit') === '1'
  } catch {
    return false
  }
}

/** The trusted parent origin this preview is embedded in, or null when not embedded/allowed. */
function resolveParentOrigin(allowed: string[]): string | null {
  if (window.parent === window) return null
  try {
    const ao = window.location.ancestorOrigins
    if (ao && ao.length) {
      for (let i = 0; i < ao.length; i += 1) {
        if (allowed.includes(ao[i])) return ao[i]
      }
    }
  } catch {
    /* ancestorOrigins unsupported — fall back to referrer */
  }
  try {
    if (document.referrer) {
      const origin = new URL(document.referrer).origin
      if (allowed.includes(origin)) return origin
    }
  } catch {
    /* no usable referrer */
  }
  return null
}

function cssEscape(value: string): string {
  const g = globalThis as unknown as { CSS?: { escape?: (s: string) => string } }
  if (typeof g.CSS?.escape === 'function') return g.CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

function readField(el: HTMLElement): CmsField | null {
  const file = el.getAttribute('data-cms-file')
  const locale = el.getAttribute('data-cms-locale')
  const pointer = el.getAttribute('data-cms-pointer')
  const type = el.getAttribute('data-cms-type') as CmsType | null
  if (!file || !locale || !pointer || (type !== 'text' && type !== 'html' && type !== 'image')) return null
  let value = ''
  if (type === 'image') {
    value = el instanceof HTMLImageElement ? el.src : el.querySelector('img')?.getAttribute('src') ?? ''
  } else if (type === 'html') {
    value = el.innerHTML
  } else {
    value = el.textContent ?? ''
  }
  return { file, locale, pointer, type, value }
}

function applyValue(file: string, locale: string, pointer: string, value: string): void {
  const selector =
    `[data-cms-file="${cssEscape(file)}"]` +
    `[data-cms-locale="${cssEscape(locale)}"]` +
    `[data-cms-pointer="${cssEscape(pointer)}"]`
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const type = el.getAttribute('data-cms-type')
    if (type === 'image') {
      if (el instanceof HTMLImageElement) el.src = value
      else {
        const img = el.querySelector('img')
        if (img) img.setAttribute('src', value)
      }
    } else if (type === 'html') {
      el.innerHTML = value
    } else {
      el.textContent = value
    }
  })
}

export function CmsEditRuntime() {
  useEffect(() => {
    if (!editModeOn()) return
    const allowed = allowedParentOrigins()
    const parentOrigin = resolveParentOrigin(allowed)
    if (!parentOrigin) return // not embedded, or an untrusted embedder → do nothing

    const post = (type: string, payload: unknown) => {
      window.parent.postMessage({ __bd: CHANNEL, v: VERSION, type, payload }, parentOrigin)
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const el = target?.closest?.('[data-cms-file][data-cms-pointer][data-cms-type]') as HTMLElement | null
      if (!el) {
        post('deselect', {})
        return
      }
      const field = readField(el)
      if (!field) return
      // In edit mode a clicked field must not navigate or submit — it selects.
      event.preventDefault()
      event.stopPropagation()
      const r = el.getBoundingClientRect()
      post('select', {
        field,
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      })
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== parentOrigin) return
      const data = event.data as Record<string, unknown> | null
      if (!data || typeof data !== 'object') return
      if (data.__bd !== CHANNEL || data.v !== VERSION || data.type !== 'setValue') return
      const payload = data.payload as Record<string, unknown> | undefined
      if (!payload || typeof payload !== 'object') return
      const { file, locale, pointer, value } = payload
      if (
        typeof file !== 'string' ||
        typeof locale !== 'string' ||
        typeof pointer !== 'string' ||
        typeof value !== 'string'
      ) {
        return
      }
      applyValue(file, locale, pointer, value)
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('message', onMessage)
    post('ready', { locale: document.documentElement.lang || 'nl' })

    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
