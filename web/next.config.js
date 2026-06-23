/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/transporte',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL:         process.env.NEXT_PUBLIC_API_URL         || 'http://localhost:3001',
    NEXT_PUBLIC_SOCKET_URL:      process.env.NEXT_PUBLIC_SOCKET_URL      || 'http://localhost:3001',
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
  },
};
module.exports = nextConfig;
