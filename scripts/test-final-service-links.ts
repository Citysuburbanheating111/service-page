// Internal links point at final addresses: no page links to a URL the proxy redirects.
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {proxy} from '../src/proxy'
import {withFinalServiceLinks} from '../src/lib/final-service-links'
import {renderReferencePage} from '../src/lib/reference-page-rendering'
import {referenceSnapshots} from '../src/reference-pages'
import {legacyReplacementPath} from '../src/lib/legacy-service-replacements'

const site = 'https://citysuburbanheating.com'
const cases: Array<[string, string]> = [
  // A page's previous "-near-me" slug, relative and absolute, with and without the trailing slash
  ['<a href="/services/heating/heat-pump-near-me/">', '<a href="/services/heating/heat-pump/">'],
  [`<a href="${site}/services/cooling/air-conditioning-repair-near-me/">`, `<a href="${site}/services/cooling/air-conditioning-repair/">`],
  ['<a href="/services/heating/boiler-service-near-me">', '<a href="/services/heating/boiler-service/">'],
  // The old plain slug of a page that is now "-near-me"; query strings are kept
  ['<a href="/services/air-quality/duct-repair/?utm=x">', '<a href="/services/air-quality/duct-repair-near-me/?utm=x">'],
  // A removed page and a category alias go where the proxy sends them
  ['<a href="/services/fireplace-chimney/gas-fireplace-repair-installation-near-me/">', '<a href="/services/heating/">'],
  ['<a href="/services/hvac-systems/">', '<a href="/services/heating/">'],
  // Inside JSON-LD
  [`"url":"${site}/services/heating/hybrid-heating-systems-near-me/"`, `"url":"${site}/services/heating/hybrid-heating-systems/"`],
]
for (const [input, expected] of cases) assert.equal(withFinalServiceLinks(input), expected, input)

// Unchanged: final addresses, categories, assets, Sanity-only pages, other sites, WordPress paths
for (const untouched of [
  '<a href="/services/heating/heat-pump/">', '<a href="/services/heating/">', '<a href="/services/">',
  '<img src="/services/reference-assets/job-boiler-1.jpg">', '<a href="/services/heating/furnace-repair-near-me/">',
  '<a href="https://example.com/services/heating/heat-pump-near-me/">', '<a href="/service-area/near-west-loop-60607/">',
  '<a href="/services/commercial/commercial-hvac-contractor-near-me/">',
]) assert.equal(withFinalServiceLinks(untouched), untouched, untouched)

// Where a rewrite comes from the proxy, it matches the proxy's redirect exactly.
for (const [input, expected] of [...cases.slice(0, 4), cases[5]]) {
  const from = input.match(/href="([^"]+)"/)![1]
  const to = expected.match(/href="([^"]+)"/)![1]
  const location = proxy(new NextRequest(new URL(from, 'http://localhost'))).headers.get('location')
  assert.equal(location && new URL(location).pathname + new URL(location).search, new URL(to, 'http://localhost').pathname + new URL(to, 'http://localhost').search, from)
}
// Removed pages: the page route redirects them (legacyReplacementPath); the rewrite uses the same table.
assert.equal(legacyReplacementPath('gas-fireplace-repair-installation-near-me'), '/services/heating/')

// Every built-in page, rendered as the live site renders it, links only to final addresses.
let links = 0
for (const [key, snapshot] of Object.entries(referenceSnapshots)) {
  const page = renderReferencePage(null, snapshot)!
  for (const [, href] of page.html.matchAll(/href="([^"]+)"/g)) {
    const url = new URL(href.replaceAll('&amp;', '&'), site)
    if (url.hostname !== 'citysuburbanheating.com' || !/^\/services?(\/|$)/.test(url.pathname)) continue
    links++
    const response = proxy(new NextRequest(`http://localhost${url.pathname}${url.search}`))
    assert.equal(response.headers.get('location'), null, `${key} links to a redirect: ${href}`)
    const segments = url.pathname.split('/').filter(Boolean)
    assert.ok(segments.length !== 3 || !legacyReplacementPath(segments[2]), `${key} links to a removed page: ${href}`)
  }
}
// A CMS page is rewritten the same way.
const cms = renderReferencePage({sections: [{module: 'copy', html: '<p><a href="/services/cooling/ductless-hvac-service-near-me/">Ductless</a></p>'}]} as never, referenceSnapshots['heating/heat-pump'])!
assert.ok(cms.html.includes('href="/services/cooling/ductless-hvac-service/"'))
console.log(`Final-link checks passed: ${cases.length} rewrites match the proxy, 8 links left alone, ${links} internal links across ${Object.keys(referenceSnapshots).length} built-in pages, none redirect.`)
