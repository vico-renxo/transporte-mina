// CF Pages Advanced Mode Worker — TransporteMina
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. /transporte exacto (sin slash) → redirect permanente a /transporte/
    if (path === '/transporte') {
      return Response.redirect(url.origin + '/transporte/', 308);
    }

    // 2. Rewrite /transporte/_next/* → /_next/* (assets de Next.js)
    if (path.startsWith('/transporte/_next/')) {
      const assetPath = path.replace('/transporte/_next/', '/_next/');
      const assetUrl = new URL(request.url);
      assetUrl.pathname = assetPath;
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // 3. Default: servir el archivo estático correspondiente
    return env.ASSETS.fetch(request);
  }
};
