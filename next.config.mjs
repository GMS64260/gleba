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
};

export default nextConfig;
