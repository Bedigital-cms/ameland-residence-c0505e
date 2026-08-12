'use client'

import { useState } from 'react'

import { Icon } from './icons'

/**
 * Click-to-play YouTube embed ("facade" pattern): until the visitor presses play we render only the
 * poster image, so no third-party script or cookie loads on page view. On click the privacy-friendly
 * youtube-nocookie player is inserted and starts.
 */
export function VideoEmbed({ videoId, poster, title }: { videoId: string; poster?: string; title: string }) {
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
        <button type="button" className="videoembed-poster" onClick={() => setPlaying(true)} aria-label={`Video afspelen: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" loading="lazy" />
          <span className="videoembed-play" aria-hidden="true">
            <Icon name="play" size={30} />
          </span>
        </button>
      )}
    </div>
  )
}
