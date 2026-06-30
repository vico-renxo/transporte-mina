// CF Pages Function — /transporte
// Si el path NO tiene trailing slash, redirigir para añadirlo
// Si YA tiene slash, pasar al archivo estatico (context.next)
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.endsWith('/')) {
    return Response.redirect(url.origin + url.pathname + '/', 308);
  }
  // Con trailing slash: servir el archivo estatico de CF Pages
  return context.next();
}
