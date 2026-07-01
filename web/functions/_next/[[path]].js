// CF Pages Function: intercepta /_next/* y sirve desde /transporte/_next/*
// (Next.js con basePath:'/transporte' pone los assets en /transporte/_next/)
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/transporte' + url.pathname;
  return context.env.ASSETS.fetch(url.toString());
}
