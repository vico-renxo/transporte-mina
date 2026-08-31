/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/transporte',
  trailingSlash: true,
  images: { unoptimized: true },
  // ignoreBuildErrors SACADO el 2026-08-30. Estaba puesto para destrabar un
  // deploy, pero convertia cualquier error de tipos en un bug silencioso en
  // runtime en vez de en un build fallido. Se saco con evidencia: `tsc
  // --noEmit` sobre todo web/src da CERO errores (correr `probar todo.bat`).
  // Si un dia el build de Pages falla por tipos, es esto haciendo su trabajo:
  // arreglá el tipo, no vuelvas a poner el flag.
  //
  // eslint.ignoreDuringBuilds se DEJA: ahi si hay avisos viejos y no vale la
  // pena que un lint frene un deploy.
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_API_URL:         process.env.NEXT_PUBLIC_API_URL         || 'http://localhost:3001',
    NEXT_PUBLIC_SOCKET_URL:      process.env.NEXT_PUBLIC_SOCKET_URL      || 'http://localhost:3001',
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
  },
};
module.exports = nextConfig;
