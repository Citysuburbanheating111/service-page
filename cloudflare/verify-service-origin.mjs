// Read-only HTTP verification. Default: Vercel; pass the public origin after rollout.
import fs from 'node:fs';
const origin = new URL(process.argv[2] || 'https://service-page-p7ot.vercel.app').origin;
const pages = ['catalog.json', 'retained-catalog.json'].flatMap(file => JSON.parse(fs.readFileSync(new URL(`../src/reference-pages/${file}`, import.meta.url), 'utf8')));
const pending = [...pages];
const failures = [];
let checked = 0;
let noindex = 0;
await Promise.all(Array.from({length: 4}, async () => {
  while (pending.length) {
    const page = pending.shift();
    try {
      const response = await fetch(origin + page.livePath, {redirect: 'manual', signal: AbortSignal.timeout(30000)});
      const html = await response.text();
      const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
      const indexingBlocked = /<meta[^>]+name="(?:robots|googlebot)"[^>]+content="[^"]*noindex/i.test(html) || /noindex/i.test(response.headers.get('x-robots-tag') || '');
      if (response.status !== 200 || canonical !== page.canonicalUrl || !html.includes('reference-design') || !html.includes('id="live-site-footer"') || indexingBlocked) {
        failures.push({path: page.livePath, status: response.status, location: response.headers.get('location'), canonical, indexingBlocked});
      } else checked++;
      if (indexingBlocked) noindex++;
    } catch (error) { failures.push({path: page.livePath, error: error.message}); }
  }
}));
console.log(JSON.stringify({origin, checked, total: pages.length, noindex, failures}, null, 2));
process.exitCode = failures.length ? 1 : 0;
