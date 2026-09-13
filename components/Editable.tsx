import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cmsAttrs, type CmsEditType, type CmsNode } from '@/lib/cmsEdit'

import { Media, type MediaShape } from './Media'
import { RichText } from './RichText'

/**
 * Preview-only annotation wrapper. In edit mode (`?cms-edit=1`) it puts the four `data-cms-*`
 * attributes on the SAME element that already renders the value. Off edit mode it renders that
 * element with no extra attributes — public HTML stays identical.
 *
 *  - `text`  — headings / labels / plain strings
 *  - `html`  — existing `<RichText>` output (the content `<div>`)
 *  - `image` — `<img>` or `<Media>` (pointer addresses the media-path string)
 */

type Common = {
  file: string
  locale: string
  pointer: string
  type: CmsEditType
  className?: string
  children?: ReactNode
  /** Alternative to `children` for plain values. */
  value?: string
  editMode?: boolean
}

type HtmlProps = Common & {
  type: 'html'
  as?: never
  html?: string
}

type ImageProps = Common & {
  type: 'image'
  as?: 'img'
  src?: string | null
  alt?: string
  shape?: MediaShape
  label?: string
  /** When set, use `<Media>` (placeholder when empty) instead of a raw `<img>`. */
  media?: boolean
}

type TextProps<T extends ElementType> = Common & {
  type: 'text'
  as?: T
} & Omit<ComponentPropsWithoutRef<T>, keyof Common | 'as'>

function node(file: string, locale: string, pointer: string, editMode: boolean | undefined): CmsNode {
  return { file, locale, pointer, editMode: !!editMode }
}

export function Editable(props: HtmlProps): ReactNode
export function Editable(props: ImageProps): ReactNode
export function Editable<T extends ElementType = 'span'>(props: TextProps<T>): ReactNode
export function Editable({
  file,
  locale,
  pointer,
  type,
  as,
  className,
  children,
  value,
  editMode,
  html,
  src,
  alt,
  shape,
  label,
  media,
  ...rest
}: Common & {
  as?: ElementType
  html?: string
  src?: string | null
  alt?: string
  shape?: MediaShape
  label?: string
  media?: boolean
}) {
  const cms = node(file, locale, pointer, editMode)
  const attrs = cmsAttrs(cms, type)

  const classProps = className ? { className } : {}

  if (type === 'html') {
    return <RichText html={html ?? value ?? ''} className={className} cms={attrs} />
  }

  if (type === 'image') {
    if (media || shape) {
      return <Media src={src} alt={alt} shape={shape} className={className} label={label} cms={attrs} />
    }
    const Tag = (as ?? 'img') as ElementType
    return <Tag src={src} alt={alt} {...classProps} {...rest} {...(attrs ?? {})} />
  }

  const Tag = (as ?? 'span') as ElementType
  return <Tag {...classProps} {...(attrs ?? {})} {...rest}>{children ?? value}</Tag>
}
