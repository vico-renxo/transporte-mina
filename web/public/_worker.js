// CF Pages Worker — maneja rutas especiales
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // /transporte sin slash → redirect a /transporte/
    if (url.pathname === '/transporte') {
      return Response.redirect(url.origin + '/transporte/', 308);
    }
    
    // Rewrite /_next/* assets (ya servidos desde /transporte/_next/ por el CF Worker externo)
    // Solo servir estáticos normalmente
    return env.ASSETS.fetch(request);
  }
};
