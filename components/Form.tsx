'use client'
/**
 * Generic, data-driven form component.
 *
 * Form definitions live in `content/forms.json` (edited via the CMS Forms editor or the AI agent).
 * This component renders the fields for a given form `slug` and submits to the CMS submit endpoint,
 * which stores the submission (tenant-scoped) and sends the notification email. The submit base URL
 * comes from `NEXT_PUBLIC_FORMS_ENDPOINT` (the CMS origin); it falls back to same-origin.
 *
 * This is a reference implementation — restyle it per template; the data contract (forms.json +
 * the POST shape) stays the same.
 */
import * as React from 'react'

import formsData from '@/content/forms.json'

type Field = {
  name: string
  label: string
  fieldType: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'hidden'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
}
export type FormDef = {
  name: string
  submitLabel?: string
  successMessage?: string
  isActive?: boolean
  fields: Field[]
}

const FORMS = (formsData as { forms?: Record<string, FormDef> }).forms || {}

/**
 * `def` (optional): the form definition to render. On i18n sites the server passes the LOCALIZED
 * definition (loadForm(slug, locale) — translated labels/placeholders/button/success text). When
 * omitted, we fall back to the flat, build-time `content/forms.json` (single-language sites / other
 * callers). Submissions post the field `name`s either way, so localization only changes the wording.
 */
export default function Form({ slug, def: defProp }: { slug: string; def?: FormDef | null }) {
  const def = defProp ?? FORMS[slug]
  const formRef = React.useRef<HTMLFormElement>(null)
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [message, setMessage] = React.useState('')

  // After a successful submit, show the confirmation for a few seconds, then reset the form so the
  // visitor can send another message (and the section doesn't sit on a stale "thanks" state).
  React.useEffect(() => {
    if (status !== 'ok') return
    const t = setTimeout(() => {
      formRef.current?.reset()
      setStatus('idle')
      setMessage('')
    }, 6000)
    return () => clearTimeout(t)
  }, [status])

  if (!def || def.isActive === false) return null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setMessage('')
    const data: Record<string, unknown> = {}
    new FormData(e.currentTarget).forEach((v, k) => { data[k] = v })
    // CMS origin (e.g. https://cms.bedigital.nl). Empty = same origin.
    const base = process.env.NEXT_PUBLIC_FORMS_ENDPOINT || ''
    try {
      const res = await fetch(`${base}/forms/${slug}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) {
        setStatus('ok')
        setMessage(body.message || def.successMessage || 'Bedankt voor je bericht.')
      } else {
        setStatus('error')
        setMessage((body.errors && body.errors[0]) || 'Er ging iets mis. Probeer het opnieuw.')
      }
    } catch {
      setStatus('error')
      setMessage('Er ging iets mis. Probeer het opnieuw.')
    }
  }

  if (status === 'ok') {
    return (
      <div className="form-success" role="status" aria-live="polite">
        <span className="form-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <p className="form-success-text">{message}</p>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="form" noValidate>
      {def.fields.map((f) => {
        if (f.fieldType === 'hidden') {
          return <input key={f.name} type="hidden" name={f.name} defaultValue={f.placeholder || ''} />
        }
        return (
          <label key={f.name} className="form-field">
            <span className="form-label">{f.label}{f.required ? ' *' : ''}</span>
            {f.fieldType === 'textarea' ? (
              <textarea name={f.name} required={!!f.required} placeholder={f.placeholder || ''} />
            ) : f.fieldType === 'select' ? (
              <select name={f.name} required={!!f.required} defaultValue="">
                <option value="" disabled>{f.placeholder || 'Kies…'}</option>
                {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.fieldType === 'checkbox' ? (
              <input type="checkbox" name={f.name} required={!!f.required} />
            ) : (
              <input type={f.fieldType} name={f.name} required={!!f.required} placeholder={f.placeholder || ''} />
            )}
          </label>
        )
      })}
      {status === 'error' && <p className="form-error">{message}</p>}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Versturen…' : def.submitLabel || 'Versturen'}
      </button>
    </form>
  )
}
