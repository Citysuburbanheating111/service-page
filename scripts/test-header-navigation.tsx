import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {CollectionHeader} from '../src/components/collection-chrome'
import {ReferenceLandingPage} from '../src/components/reference-landing-page'
import {referenceServices, getReferenceSnapshot} from '../src/lib/reference-pages'
import {LIVE_SITE, liveMenu, servicesMenu} from '../src/lib/site-navigation'
import {refineServicePageLinks} from '../src/lib/service-page-links'

function internalLinks(markup: string, currentPath?: string) {
  return [...markup.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].flatMap(match => {
    const url = new URL(match[1].replaceAll('&amp;', '&'), LIVE_SITE + (currentPath || '/'))
    if (url.origin !== LIVE_SITE || url.pathname === currentPath || !/^https?:$/.test(url.protocol)) return []
    return [url.pathname + url.search]
  })
}

const header = renderToStaticMarkup(<CollectionHeader />)
const links = internalLinks(header)
const servicesLinks = [servicesMenu, ...servicesMenu.columns.flatMap(column => [...column.items, column.all])]
for (const link of [...liveMenu.flatMap(group => [group, ...group.items]), ...servicesLinks]) {
  const pathname = new URL(link.href, LIVE_SITE).pathname
  // As on the live home page, "Services" and its "All services →" link share /services/.
  const expected = pathname === '/services/' ? 2 : 1
  assert.equal(links.filter(path => path === pathname).length, expected, `Duplicate or missing menu destination: ${pathname}`)
}
assert.equal((header.match(/aria-label="Main"/g) || []).length, 1)
assert.equal((header.match(/class="site-submenu"/g) || []).length, 4)
assert.equal((header.match(/class="site-submenu site-submenu-services"/g) || []).length, 1)
assert.equal((header.match(/class="site-submenu-toggle"/g) || []).length, 5)
assert.ok(header.includes('aria-controls="site-primary-navigation"'))
assert.ok(header.includes('aria-expanded="false"'))
assert.ok(!header.includes('aria-label="Mobile"'), 'Mobile must reuse the main menu')

// The home page's Services dropdown adds its links to every page's budget.
// So do dropdown items added beyond the original 24-service menu (the three furnace links, 28/10/2026).
const menuItemCount = liveMenu.flatMap(group => group.items).length
const linkBudget = 55 + servicesLinks.length - 1 + (menuItemCount - 24)
const totals = referenceServices.map(page => {
  const snapshot = getReferenceSnapshot(page.clusterSlug, page.slug)!
  const markup = renderToStaticMarkup(<ReferenceLandingPage snapshot={snapshot} serviceName={page.name} />)
  assert.equal((markup.match(/id="site-primary-navigation"/g) || []).length, 1, page.livePath)
  assert.ok(!markup.includes('data-module="site-header"') || (markup.match(/data-module="site-header"/g) || []).length === 1)
  const count = internalLinks(markup, page.livePath).length
  assert.ok(count < linkBudget, `${page.livePath}: ${count} internal placements with the full menu retained`)
  // Every page still has contextual related links and its full location coverage.
  assert.ok(markup.includes('data-module="related"') && markup.includes('data-module="service-areas"'), page.livePath)
  const refined = refineServicePageLinks(snapshot.html)
  const originalCopy = snapshot.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  const refinedCopy = refined.replace(/<p class="service-area-directory-link">[\s\S]*?<\/p>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  assert.equal(refinedCopy, originalCopy, `Existing copy changed: ${page.livePath}`)
  assert.equal(refineServicePageLinks(refined), refined, `Link policy is not idempotent: ${page.livePath}`)
  return count
})

const fixture = `<header><a href="/services/heating/heater-repair/">Menu</a></header>
<section data-module="faq"><a href="/services/heating/">Heating</a>
<a href="/services/heating/heater-repair/">Repair</a>
<a href="/services/heating/boiler-service/">Boiler repair</a>
<a href="/services/heating/boiler-service/" data-content-field="copy-1"><strong>Boiler service</strong></a>
<a href="/contact-us/">Schedule service</a><a href="#book">Book online</a>
<a href="https://citysuburbanheating.com/services/heating/boiler-service/#book">Book a boiler visit</a>
<a href="tel:+17732383838">Call</a><a href="sms:+13128216809">Text</a>
<a href="https://example.com/reference">Reference</a></section>
<section data-module="related"><a href="/services/heating/heater-repair/">Related repair</a></section>
<section data-module='service-areas'><a href='https://www.citysuburbanheating.com/service-area/wicker-park/' style='color:red'>Wicker Park</a><a href='/service-area/skokie/'>Skokie</a><a href='tel:+17732383838'>Call</a></section>
<footer><a href="/services/heating/">Heating</a></footer>`
const refined = refineServicePageLinks(fixture)
assert.ok(refined.includes('<span style=\'color:red\'>Wicker Park</span>'))
assert.ok(refined.includes('<span data-content-field="copy-1"><strong>Boiler service</strong></span>'))
assert.equal((refined.match(/href="\/services\/heating\/boiler-service\/"/g) || []).length, 1)
assert.equal((refined.match(/href="\/services\/heating\/heater-repair\/"/g) || []).length, 2, 'Header and related link must stay')
for (const href of ['/contact-us/', '#book', 'tel:+17732383838', 'sms:+13128216809', 'https://example.com/reference', 'https://citysuburbanheating.com/services/heating/boiler-service/#book']) {
  assert.ok(refined.includes(`href="${href}"`), `Important action changed: ${href}`)
}
assert.equal((refined.match(/View all service areas/g) || []).length, 1)
assert.equal(refineServicePageLinks(refined), refined)
const nested = '<div data-module="faq"><div><a href="/services/heating/boiler-service/">Boiler</a></div><div><a href="/services/heating/boiler-service/">Boiler again</a></div></div><footer data-module="site-footer"><a href="/services/heating/">Heating</a></footer>'
const refinedNested = refineServicePageLinks(nested)
assert.equal((refinedNested.match(/href="\/services\/heating\/boiler-service\/"/g) || []).length, 1)
assert.ok(refinedNested.endsWith('<footer data-module="site-footer"><a href="/services/heating/">Heating</a></footer>'), 'Nested module parsing damaged the following footer')
console.log(`Link checks passed: full ${menuItemCount}-service menu and Services dropdown retained; original copy and actions preserved; all ${totals.length} landing pages have ${Math.min(...totals)}–${Math.max(...totals)} internal placements.`)
