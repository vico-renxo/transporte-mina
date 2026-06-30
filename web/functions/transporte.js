// CF Pages Function — redirige /transporte (sin slash) a /transporte/
export async function onRequestGet({ request }) {
  return Response.redirect('https://viczul.com/transporte/', 308);
}
