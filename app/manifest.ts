import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ameland Residence',
    short_name: 'Ameland Residence',
    description: 'Luxe vakantiehuizen op Ameland — Ameland Residence.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070121',
    theme_color: '#070121',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
