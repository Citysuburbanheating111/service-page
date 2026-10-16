import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {CollectionHeader} from '../src/components/collection-chrome'
import {ReferenceLandingPage} from '../src/components/reference-landing-page'
import {referenceServices, getReferenceSnapshot} from '../src/lib/reference-pages'
import {LIVE_SITE, liveMenu, servicesLink} from '../src/lib/site-navigation'

function internalLinks(markup: string, currentPath?: string) {
  return [...markup.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].flatMap(match => {
    const url = new URL(match[1].replaceAll('&amp;', '&'), LIVE_SITE + (currentPath || '/'))
    if (url.origin !== LIVE_SITE || url.pathname === currentPath || !/^https?:$/.test(url.protocol)) return []
    return [url.pathname + url.search]
  })
}

const header = renderToStaticMarkup(<CollectionHeader />)
const links = internalLinks(header)
for (const link of [...liveMenu.flatMap(group => [group, ...group.items]), servicesLink]) {
  const pathname = new URL(link.href, LIVE_SITE).pathname
  assert.equal(links.filter(path => path === pathname).length, 1, `Duplicate or missing menu destination: ${pathname}`)
}
assert.equal((header.match(/aria-label="Main"/g) || []).length, 1)
assert.equal((header.match(/class="site-submenu"/g) || []).length, 4)
assert.equal((header.match(/class="site-submenu-toggle"/g) || []).length, 4)
assert.ok(header.includes('aria-controls="site-primary-navigation"'))
assert.ok(header.includes('aria-expanded="false"'))
assert.ok(!header.includes('aria-label="Mobile"'), 'Mobile must reuse the main menu')

const totals = referenceServices.map(page => {
  const snapshot = getReferenceSnapshot(page.clusterSlug, page.slug)!
  const markup = renderToStaticMarkup(<ReferenceLandingPage snapshot={snapshot} serviceName={page.name} />)
  assert.equal((markup.match(/id="site-primary-navigation"/g) || []).length, 1, page.livePath)
  assert.ok(!markup.includes('data-module="site-header"') || (markup.match(/data-module="site-header"/g) || []).length === 1)
  const count = internalLinks(markup, page.livePath).length
  assert.ok(count < 80, `${page.livePath}: ${count} internal placements`)
  // Every page still has contextual related links and its full location coverage.
  assert.ok(markup.includes('data-module="related"') && markup.includes('data-module="service-areas"'), page.livePath)
  return count
})
console.log(`Shared menu checks passed: 24 service links once each; all ${totals.length} landing pages have ${Math.min(...totals)}–${Math.max(...totals)} internal placements.`)
