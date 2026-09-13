/**
 * Preview-only Visual Editor addressing helpers.
 *
 * The CMS maps a clicked element on a `?cms-edit=1` preview to a content leaf via four DOM
 * attributes (`data-cms-file`, `data-cms-locale`, `data-cms-pointer`, `data-cms-type`). Pointers are
 * RFC 6901 JSON Pointers into the locale's real source file (`content/<locale>/<file>`). Nothing
 * here is emitted on the public site — `cmsAttrs` returns undefined unless `editMode` is on.
 */

export type CmsEditType = 'text' | 'html' | 'image'

/** Source coordinates for the content object currently being rendered. */
export type CmsNode = {
  /** Content file name, e.g. `villas.json`. */
  file: string
  /** Locale of that file, e.g. `nl` or `de`. */
  locale: string
  /** RFC 6901 pointer to the current object (no trailing slash), e.g. `/villa-zee` or `/sections/0`. */
  pointer: string
  /** True only when this request has `?cms-edit=1`. */
  editMode: boolean
}

export type CmsDomAttrs = {
  'data-cms-file': string
  'data-cms-locale': string
  'data-cms-pointer': string
  'data-cms-type': CmsEditType
}

/** RFC 6901: `~` → `~0`, `/` → `~1`. */
export function escapePointerSegment(segment: string | number): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1')
}

/** Build a pointer from path segments rooted at the file (`['villa-zee', 'title']` → `/villa-zee/title`). */
export function cmsPointer(...segments: Array<string | number>): string {
  return `/${segments.map(escapePointerSegment).join('/')}`
}

/** Append segments onto an existing pointer (`/villa-zee` + `paragraphs`, `0` → `/villa-zee/paragraphs/0`). */
export function cmsJoin(base: string, ...segments: Array<string | number>): string {
  const tail = segments.map(escapePointerSegment).join('/')
  if (!base) return `/${tail}`
  return `${base.replace(/\/$/, '')}/${tail}`
}

/** A child node of `cms` addressing a nested field or index. */
export function cmsChild(cms: CmsNode | undefined, ...segments: Array<string | number>): CmsNode | undefined {
  if (!cms) return undefined
  return { ...cms, pointer: cmsJoin(cms.pointer, ...segments) }
}

/**
 * The four `data-cms-*` attributes, or `undefined` when not in edit mode / not addressable.
 * Callers spread the result onto the EXISTING element so public HTML stays unchanged.
 */
export function cmsAttrs(cms: CmsNode | undefined, type: CmsEditType): CmsDomAttrs | undefined {
  if (!cms?.editMode || !cms.file || !cms.pointer) return undefined
  return {
    'data-cms-file': cms.file,
    'data-cms-locale': cms.locale,
    'data-cms-pointer': cms.pointer,
    'data-cms-type': type,
  }
}
