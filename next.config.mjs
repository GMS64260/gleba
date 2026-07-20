/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone pour Docker
  output: 'standalone',

  // Bug PDFKit (audit 2026-05-14) : Next.js standalone ne trace pas les .afm
  // car PDFKit les charge via fs.readFileSync dynamique non détectable par
  // le bundler. Sans ça, tous nos exports PDF crashent avec
  // `ENOENT: no such file or directory, open '/ROOT/node_modules/pdfkit/js/data/Helvetica.afm'`
  // (registre phyto, factures, calendrier verger, dossier campagne, étiquettes QR).
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/pdfkit/js/data/*.afm',
      './node_modules/pdfkit/js/data/*.trie',
    ],
  },

  // Ne pas bundler pdfkit côté serveur : il utilise __dirname pour résoudre
  // ses .afm, et Turbopack le remplace par un placeholder `/ROOT/...` qui
  // n'existe pas au runtime. En externe, le require() natif fonctionne.
  serverExternalPackages: ['pdfkit', 'qrcode'],

  // Vue 3D du jardin (react-three-fiber) : ces paquets sont livrés en ESM
  // non transpilé ; on les transpile pour un build standalone fiable. Ils ne
  // sont chargés que côté client (dynamic import ssr:false), donc sans impact
  // sur le poids des autres pages.
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

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
      // Roadmap GitHub historique → Community Voice (roadmap communautaire)
      { source: '/roadmap', destination: '/communaute', permanent: true },
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
