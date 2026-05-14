/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone pour Docker
  output: 'standalone',

  // Optimisations
  poweredByHeader: false,

  // Configuration des images
  images: {
    remotePatterns: [],
  },

  // PROMPT 21 — Convention REST unifiée : tous les chemins anciens sont
  // redirigés en 301 (permanent) vers leur nouvelle URL `/maraichage/*`
  // ou `/verger/*`. Les routes physiques ont été déplacées, ces redirects
  // assurent la compat des bookmarks, partages de liens existants et tout
  // lien interne du codebase pas encore migré.
  async redirects() {
    return [
      // Maraîchage
      { source: '/cultures', destination: '/maraichage/cultures', permanent: true },
      { source: '/cultures/:path*', destination: '/maraichage/cultures/:path*', permanent: true },
      { source: '/planches', destination: '/maraichage/planches', permanent: true },
      { source: '/planches/:path*', destination: '/maraichage/planches/:path*', permanent: true },
      { source: '/rotations', destination: '/maraichage/rotations', permanent: true },
      { source: '/rotations/:path*', destination: '/maraichage/rotations/:path*', permanent: true },
      { source: '/itps', destination: '/maraichage/itps', permanent: true },
      { source: '/itps/:path*', destination: '/maraichage/itps/:path*', permanent: true },
      { source: '/stocks', destination: '/maraichage/stocks', permanent: true },
      { source: '/stocks/:path*', destination: '/maraichage/stocks/:path*', permanent: true },
      { source: '/recoltes', destination: '/maraichage/recoltes', permanent: true },
      { source: '/recoltes/:path*', destination: '/maraichage/recoltes/:path*', permanent: true },
      { source: '/especes', destination: '/maraichage/especes', permanent: true },
      { source: '/especes/:path*', destination: '/maraichage/especes/:path*', permanent: true },
      { source: '/associations', destination: '/maraichage/associations', permanent: true },
      { source: '/associations/:path*', destination: '/maraichage/associations/:path*', permanent: true },
      { source: '/planification', destination: '/maraichage/planification', permanent: true },
      { source: '/planification/:path*', destination: '/maraichage/planification/:path*', permanent: true },

      // Verger
      { source: '/arbres', destination: '/verger', permanent: true },
      { source: '/arbres/:path*', destination: '/verger/:path*', permanent: true },
    ]
  },
}

export default nextConfig
