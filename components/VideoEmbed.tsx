'use client'

import { useState } from 'react'

import { Icon } from './icons'

/**
 * Click-to-play YouTube embed ("facade" pattern): until the visitor presses play we render only the
 * poster image, so no third-party script or cookie loads on page view. On click the privacy-friendly
 * youtube-nocookie player is inserted and starts.
 */
export function VideoEmbed({
  videoId,
  poster,
  title,
  playLabel,
}: {
  videoId: string
  poster?: string
  title: string
  /** Localised "Play video: {title}". Falls back to Dutch when a caller has not supplied it. */
  playLabel?: string
}) {
  const [playing, setPlaying] = useState(false)
  if (!videoId) return null

  const thumb = poster || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

  return (
    <div className="videoembed">
      {playing ? (
        <iframe
          className="videoembed-frame"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="videoembed-poster"
          onClick={() => setPlaying(true)}
          aria-label={(playLabel ?? 'Video afspelen: {title}').replace('{title}', title)}
        >
          {/* 16:9 poster. Dimensions reserve the box so the play button does not jump on load.
              Plain <img> rather than next/image — the poster is a third-party ytimg.com URL, and the
              reasoning for not using the optimiser here is in Media.tsx. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" loading="lazy" decoding="async" width={1280} height={720} sizes="(max-width: 900px) 100vw, 800px" />
          <span className="videoembed-play" aria-hidden="true">
            <Icon name="play" size={30} />
          </span>
        </button>
      )}
    </div>
  )
}
