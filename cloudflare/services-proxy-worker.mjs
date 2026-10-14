// Generic reverse proxy. Every /services URL is owned by the Vercel app.
const ORIGIN = 'https://service-page-p7ot.vercel.app';
const BASE_PATH = '/services';

const worker = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) {
      return fetch(request);
    }

    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));

    const upstream = await fetch(new URL(url.pathname + url.search, ORIGIN), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(upstream.headers);
    const location = responseHeaders.get('Location');
    if (location) {
      const target = new URL(location, ORIGIN);
      if (target.origin === ORIGIN && /^(https?:)?\/\//.test(location)) {
        responseHeaders.set('Location', `${url.origin}${target.pathname}${target.search}${target.hash}`);
      }
    }
    responseHeaders.set('X-CitySuburban-Proxy', 'vercel');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

export default worker;
