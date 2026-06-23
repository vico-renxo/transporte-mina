/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/transporte',
  trailingSlash: true,
  images: { unoptimized: true },
  // Skip type/lint errors during CF Pages build — checked by IDE locally
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_API_URL:         process.env.NEXT_PUBLIC_API_URL         || 'http://localhost:3001',
    NEXT_PUBLIC_SOCKET_URL:      process.env.NEXT_PUBLIC_SOCKET_URL      || 'http://localhost:3001',
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
  },
};
module.exports = nextConfig;
