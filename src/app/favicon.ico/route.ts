/** Browsers and crawlers ask for /favicon.ico; the site icon is the SVG generated from app/icon.svg. */
export function GET(request: Request) {
  return Response.redirect(new URL("/icon.svg", request.url), 308);
}
