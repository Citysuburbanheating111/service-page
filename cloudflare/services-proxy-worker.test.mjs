// Generic prefix routing, forwarding and response behavior. No real leads submitted.
import worker from './services-proxy-worker.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pages = ['catalog.json', 'retained-catalog.json'].flatMap(file => JSON.parse(fs.readFileSync(new URL(`../src/reference-pages/${file}`, import.meta.url), 'utf8')));
const origin = 'https://service-page-p7ot.vercel.app';
const publicOrigin = 'https://citysuburbanheating.com';
let call;
let status = 200;
let headers = {};
let body = 'ok';
globalThis.fetch = async (input, options) => {
  call = {url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, options};
  return new Response(body, {status, headers});
};
let checked = 0;
for (const host of [publicOrigin, 'https://www.citysuburbanheating.com']) {
  for (const path of [...pages.map(page => page.livePath), '/services', '/services/', '/services/new-category/newly-published-page/?utm=future', '/services/api/lead/', '/services/studio/', '/services/_next/static/app.js', '/services/images/live-footer-logo.png', '/services/sitemap.xml']) {
    const response = await worker.fetch(new Request(host + path));
    assert.equal(call.url, origin + path);
    assert.equal(response.headers.get('X-CitySuburban-Proxy'), 'vercel');
    assert.equal(call.options.headers.get('X-Forwarded-Host'), new URL(host).host);
    assert.equal(call.options.headers.get('X-Forwarded-Proto'), 'https');
    checked++;
  }
}
for (const path of ['/', '/about-us/', '/wp-admin/', '/service-areas/', '/service-area/lincoln-park/', '/services-other/', '/service/', '/service/heating/']) {
  const response = await worker.fetch(new Request(publicOrigin + path));
  assert.equal(call.url, publicOrigin + path);
  assert.equal(call.options, undefined);
  assert.equal(response.headers.get('X-CitySuburban-Proxy'), null);
  checked++;
}
for (const host of [publicOrigin, 'https://www.citysuburbanheating.com']) {
  status = 308;
  headers = {Location: origin + '/services/heating/heater-repair/?utm=old', 'Set-Cookie': 'test=value; Path=/services/; Secure', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'self'"};
  const response = await worker.fetch(new Request(host + '/services/heating/furnace-repair-installation/?utm=old'));
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), host + '/services/heating/heater-repair/?utm=old');
  for (const key of ['Set-Cookie', 'Cache-Control', 'Content-Security-Policy']) assert.equal(response.headers.get(key), headers[key]);
  checked++;
}
for (const location of ['/services/heating/heater-repair/', 'https://retailservices.wellsfargo.com/pl/0024376626']) {
  headers = {Location: location};
  const response = await worker.fetch(new Request(publicOrigin + '/services/'));
  assert.equal(response.headers.get('Location'), location);
  checked++;
}
status = 200;
headers = {};
const payload = JSON.stringify({name: 'Mock routing test'});
await worker.fetch(new Request(publicOrigin + '/services/api/lead/?test=mock', {method: 'POST', body: payload, headers: {'content-type': 'application/json', Host: 'citysuburbanheating.com', Cookie: 'test=value'}}));
assert.equal(call.options.method, 'POST');
assert.equal(await new Response(call.options.body).text(), payload);
assert.equal(call.options.redirect, 'manual');
assert.equal(call.options.headers.has('Host'), false);
assert.equal(call.options.headers.get('Cookie'), 'test=value');
await worker.fetch(new Request(publicOrigin + '/services/', {method: 'HEAD'}));
assert.equal(call.options.method, 'HEAD');
assert.equal(call.options.body, undefined);
status = 404;
assert.equal((await worker.fetch(new Request(publicOrigin + '/services/missing/page/'))).status, 404);
status = 200;
body = new Uint8Array([0, 255, 33, 127]);
assert.deepEqual(new Uint8Array(await (await worker.fetch(new Request(publicOrigin + '/services/images/example.bin'))).arrayBuffer()), body);
console.log(`Passed ${checked} URL/redirect cases, future-page routing, POST/HEAD, binary data, cookies, security/cache headers and upstream 404 preservation.`);
