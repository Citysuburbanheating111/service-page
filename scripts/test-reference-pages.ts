import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import catalog from '../src/reference-pages/catalog.json'
import retainedCatalog from '../src/reference-pages/retained-catalog.json'
import migrations from '../data/service-url-migrations.json'
import {referenceSnapshots} from '../src/reference-pages'
import {legacyReplacementPath} from '../src/lib/legacy-service-replacements'
import taxonomy from '../data/service-taxonomy.json'
import {getReferenceService, getReferenceSnapshot, referenceNavigation, referencePagePath} from '../src/lib/reference-pages'
import {proxy} from '../src/proxy'
import {NextRequest} from 'next/server'
import {LIVE_SITE, liveMenu, servicesMenu} from '../src/lib/site-navigation'
import {applyReferenceContentFields, synchronizeVisibleSchema} from '../src/lib/reference-content-fields'
import {migrateServiceContent} from '../src/lib/service-base-path'
import {renderReferencePage} from '../src/lib/reference-page-rendering'
import {withoutReferenceHeader} from '../src/lib/reference-header'

const counts = Object.fromEntries(['heating', 'cooling', 'air-quality', 'commercial'].map((cluster) => [cluster, catalog.filter((page) => page.clusterSlug === cluster).length]))
assert.deepEqual(counts, {heating: 6, cooling: 6, 'air-quality': 4, commercial: 6})
assert.equal(catalog.length, 22)
assert.equal(new Set(catalog.map((page) => `${page.clusterSlug}/${page.slug}`)).size, 22)
assert.equal(new Set(catalog.map((page) => page.livePath)).size, 22)
assert.equal(catalog.filter((page) => page.qcStatus === 'PASS').length, 15)
assert.equal(retainedCatalog.length, 4)
assert.equal(new Set([...catalog, ...retainedCatalog].map(page => page.cardImage)).size, 26, 'Every service card needs a distinct image')
assert.equal(servicesMenu.href, '/services/')
// Menu items for pages published in Sanity only (no code snapshot), placed as on the live home page menu.
const sanityOnlyMenu = [
  ['Furnace repair', '/services/heating/furnace-repair-near-me/'],
  ['Furnace Installation', '/services/heating/furnace-installation-near-me/'],
  ['Furnace Maintenance', '/services/heating/furnace-maintenance-near-me/'],
]
const menuItems = liveMenu.flatMap((group) => group.items.map((item) => [item.label, new URL(item.href, LIVE_SITE).pathname]))
assert.deepEqual(liveMenu[0].items.slice(1, 4).map((item) => [item.label, item.href]), sanityOnlyMenu, 'Furnace links follow Heater repair, as on the home page')
assert.deepEqual(menuItems.filter(([, href]) => !sanityOnlyMenu.some(([, path]) => path === href)), catalog.map((page) => [page.name, page.livePath]))

for (const page of catalog) {
  const snapshot = referenceSnapshots[`${page.clusterSlug}/${page.slug}`]
  assert.ok(snapshot, `Missing ${page.slug}`)
  const h1 = snapshot.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
  assert.equal(h1, page.h1, `Wrong H1 for ${page.slug}`)
  assert.ok(snapshot.sections.some((section) => section.module === 'hero'))
  assert.ok(snapshot.sections.some((section) => section.module === 'pricing'))
  assert.ok(snapshot.sections.some((section) => section.module === 'faq'))
  assert.ok(/href="\/services\/"[^>]*>Services<\/a>/.test(snapshot.sections.find((section) => section.module === 'site-header')?.html || ''), `Missing collection menu link: ${page.slug}`)
  assert.ok(!snapshot.html.includes('maximuslabs-ai.github.io'), `External preview link in ${page.slug}`)
  assert.equal(page.livePath, `/services/${page.clusterSlug}/${page.slug}/`)
  assert.equal(page.canonicalUrl, `https://citysuburbanheating.com${page.livePath}`)
  assert.equal(getReferenceService(page.clusterSlug, page.legacySlug)?.livePath, page.livePath)
  assert.equal(getReferenceSnapshot(page.clusterSlug, page.legacySlug), snapshot)
  assert.ok(snapshot.html.includes('type="submit"'), `Booking form is inert: ${page.slug}`)
  for (const section of snapshot.sections) assert.ok(snapshot.html.includes(section.html), `Sanity section changed reference markup: ${page.slug}/${section.module}`)
  assert.ok(snapshot.sections.every((section) => section.module === 'site-header' || section.contentFields?.length), `Missing native Sanity fields: ${page.slug}`)
  const rewritten = proxy(new NextRequest(`http://localhost${page.livePath}?utm_source=review`))
  assert.equal(rewritten.headers.get('x-middleware-rewrite'), null)
  assert.equal(rewritten.headers.get('location'), null)
  const schema = JSON.parse(snapshot.schema) as {'@graph': Array<{'@type': string; url?: string; name?: string}>}
  assert.ok(schema['@graph'].some((node) => node['@type'] === 'Service' && node.url === page.canonicalUrl), `Incorrect Service schema URL: ${page.slug}`)
  assert.ok(schema['@graph'].some((node) => node['@type'] === 'WebPage' && node.url === page.canonicalUrl), `Incorrect WebPage schema URL: ${page.slug}`)
  for (const match of snapshot.html.matchAll(/(?:src|href)="(\/services\/reference-assets\/[^"?#]+)"/g)) {
    assert.ok(fs.existsSync(path.resolve('public', match[1].replace('/services/', ''))), `Missing asset ${match[1]}`)
  }
}

const editable = referenceSnapshots['heating/heater-repair'].sections.find((section) => section.module === 'hero')!
const titleField = editable.contentFields!.find((field) => field.label?.startsWith('H1:'))!
const editedHero = applyReferenceContentFields(editable.html, [{...titleField, value: 'A heading with <unsafe> & text'}])
assert.ok(editedHero.includes('A heading with &lt;unsafe&gt; &amp; text'))
assert.ok(!editedHero.includes('<unsafe>'))
const faq = referenceSnapshots['heating/heater-repair'].sections.find((section) => section.module === 'faq')!
const faqField = faq.contentFields!.find((field) => field.label?.startsWith('SUMMARY:'))!
const editedFaq = applyReferenceContentFields(faq.html, [{...faqField, value: 'Updated service question?'}])
const synchronized = JSON.parse(synchronizeVisibleSchema(referenceSnapshots['heating/heater-repair'].schema, editedFaq))
assert.equal(synchronized['@graph'].find((node: {'@type': string}) => node['@type'] === 'FAQPage').mainEntity[0].name, 'Updated service question?')

for (const cluster of referenceNavigation()) {
  const expected = [...catalog.filter((page) => page.clusterSlug === cluster.slug), ...retainedCatalog.filter((page) => page.directoryClusterSlug === cluster.slug)]
  assert.deepEqual(cluster.pages.map((page) => [page.serviceName, page.livePath]), expected.map((page) => [page.name, page.livePath]))
}
for (const untouched of ['/services/heating/', '/services/unrelated/', '/services/api/lead/', '/service-area/lincoln-park/', '/service-areas/']) {
  assert.equal(proxy(new NextRequest(`http://localhost${untouched}`)).headers.get('x-middleware-rewrite'), null)
}

// Pages that exist only in Sanity (no code snapshot) but are a valid redirect destination.
const cmsOnlyDestinations = new Set(['/services/heating/furnace-repair-near-me/'])
// Category pages that take over from unrelated services removed from the site.
const categoryDestinations = new Set(['/services/heating/', '/services/cooling/', '/services/air-quality/', '/services/commercial/'])
assert.equal(legacyReplacementPath('furnace-repair-installation'), '/services/heating/furnace-repair-near-me/')
for (const old of taxonomy.services) {
  const replacement = (migrations.overlaps as Record<string, string>)[old.slug]
  if (replacement) {
    assert.equal(legacyReplacementPath(old.slug), replacement)
    assert.ok(catalog.some((page) => page.livePath === replacement) || cmsOnlyDestinations.has(replacement) || categoryDestinations.has(replacement), `Missing redirect destination: ${old.slug}`)
    assert.ok(!retainedCatalog.some((page) => page.slug === old.slug), `Duplicate keyword card: ${old.slug}`)
    for (const alias of ['service', 'services'].flatMap(base => [`/${base}/${old.slug}/`, `/${base}/${old.clusterSlug}/${old.slug}/`, `/${base}/${old.clusterSlug}/${old.slug}/chicago/`])) {
      const response = proxy(new NextRequest(`http://localhost${alias}?utm=keyword`))
      assert.equal(response.status, 308)
      assert.equal(response.headers.get('location'), `http://localhost${replacement}?utm=keyword`)
    }
  } else {
    assert.equal(legacyReplacementPath(old.slug), undefined)
    const retained = retainedCatalog.find((page) => page.slug === old.slug || page.previousSlug === old.slug)
    assert.ok(retained, `Distinct keyword was lost: ${old.slug}`)
    const snapshot = referenceSnapshots[`${retained.clusterSlug}/${retained.slug}`]
    assert.ok(snapshot.html.includes('data-module="hero"') && snapshot.html.includes('type="submit"'))
    assert.ok(snapshot.html.includes('data-module="pricing"'))
    assert.ok(snapshot.schema.includes(retained.canonicalUrl))
    assert.ok(!snapshot.html.includes('Heater Repair in Chicago'), `Borrowed furnace copy on ${old.slug}`)
  }
}
for (const page of [...catalog, ...retainedCatalog]) {
  const current = proxy(new NextRequest(`http://localhost${page.livePath}?utm=current`))
  assert.equal(current.headers.get('location'), null)
  assert.equal(current.headers.get('x-middleware-rewrite'), null)
  const previous = proxy(new NextRequest(`http://localhost${page.livePath.replace('/services/', '/service/')}?utm=old`))
  assert.equal(previous.status, 308)
  assert.equal(previous.headers.get('location'), `http://localhost${page.livePath}?utm=old`)
  const snapshot = referenceSnapshots[`${page.clusterSlug}/${page.slug}`]
  const header = snapshot.sections.find(section => section.module === 'site-header')!
  assert.equal((header.html.match(/class="site-submenu"/g) || []).length, 4, `Missing dropdowns: ${page.slug}`)
  const content = withoutReferenceHeader(snapshot.html)
  assert.ok(!content.includes('data-module="site-header"') && content.includes('data-module="hero"') && content.includes('id="live-site-footer"'), `Header removal damaged page: ${page.slug}`)
  assert.ok(!/\/service\//.test(JSON.stringify(snapshot)), `Old base in ${page.livePath}`)
}
for (const path of ['/service/api/lead/', '/service/_next/static/chunk.js', '/service/images/live-footer-logo.png', '/service/studio/']) {
  const response = proxy(new NextRequest(`http://localhost${path}?test=compat`))
  assert.equal(response.headers.get('x-middleware-rewrite'), `http://localhost${path.replace('/service/', '/services/')}?test=compat`)
}
const futurePage = {name: 'New published CMS service', clusterSlug: 'cooling', slug: 'future-cms-service', directoryClusterSlug: 'cooling', cardDescription: 'A new service description', cardImage: '/services/images/live-footer-logo.png'}
assert.equal(referencePagePath(futurePage), '/services/cooling/future-cms-service/')
assert.equal(referencePagePath({...futurePage, slug: '../invalid'}), undefined)
const futureNavigation = referenceNavigation([futurePage, {...futurePage}]).find(cluster => cluster.slug === 'cooling')!
assert.equal(futureNavigation.pages.length, 7)
assert.equal(futureNavigation.sourceServiceCount, 7)
assert.equal(futureNavigation.pages.at(-1)?.livePath, '/services/cooling/future-cms-service/')
assert.equal(futureNavigation.pages.at(-1)?.cardImage, futurePage.cardImage)
const futureSnapshot = renderReferencePage({...futurePage, responsiveCss: '.test{color:red}', sections: [{module: 'hero', html: '<section><h1>New published CMS service</h1><img src="/service/images/new.jpg" /></section>'}]})!
assert.ok(futureSnapshot.html.includes('<h1>New published CMS service</h1>'))
assert.ok(futureSnapshot.html.includes('/services/images/new.jpg'))
assert.equal(futureSnapshot.style, '.test{color:red}')
// GROQ returns null (not undefined) for a section with no editable fields; it must render, not crash with a 500.
const noFieldsSnapshot = renderReferencePage({...futurePage, sections: [{module: 'header', html: '<header>Site header</header>', contentFields: null}]})!
assert.ok(noFieldsSnapshot.html.includes('<header>Site header</header>'))
assert.equal(renderReferencePage(null), undefined)
assert.equal(renderReferencePage(null, referenceSnapshots['heating/heater-repair']), referenceSnapshots['heating/heater-repair'])
assert.deepEqual(migrateServiceContent({url: '/service/heating/water-heater-repair-installation/', image: '/service/images/logo.png', neighborhood: '/service-area/lincoln-park/', collection: '/service/heating-services/'}), {
  url: '/services/heating/water-heater-repair-installation/', image: '/services/images/logo.png', neighborhood: '/service-area/lincoln-park/', collection: '/services/heating/',
})
// "-near-me" URLs: every page's previous address answers with one permanent redirect to the new one.
// The three heater pages that run Google Ads keep their original URL; their "-near-me" form redirects to it.
const originalUrlPages = new Set(['heater-repair', 'heater-installation', 'heater-maintenance'])
for (const page of [...catalog, ...retainedCatalog]) {
  if (originalUrlPages.has(page.slug)) assert.equal(page.previousSlug, `${page.slug}-near-me`, `Near-me form missing: ${page.slug}`)
  else assert.equal(page.slug, `${page.previousSlug}-near-me`, `Slug is not the near-me form: ${page.slug}`)
  for (const old of [`/services/${page.clusterSlug}/${page.previousSlug}/`, `/services/${page.clusterSlug}/${page.previousSlug}`, `/service/${page.clusterSlug}/${page.previousSlug}/`]) {
    const response = proxy(new NextRequest(`http://localhost${old}?utm=old`))
    assert.equal(response.status, 308, `No permanent redirect from ${old}`)
    assert.equal(response.headers.get('location'), `http://localhost${page.livePath}?utm=old`)
  }
}
// Unrelated services taken off the site: no snapshot, not in the navigation, and both addresses go to the category page.
const removedPages: Record<string, string[]> = {
  '/services/heating/': [
    'heating/boiler-service-near-me',
    'fireplace-chimney/gas-fireplace-repair-installation-near-me',
    'heating/space-heater-repair-installation-near-me',
    'heating/oil-propane-heating-repair-maintenance-near-me',
    'heating/radiator-radiant-heat-repair-installation-near-me',
    'fireplace-chimney/wood-pellet-stove-repair-installation-near-me',
    'fireplace-chimney/chimney-sweeping-inspection-repair-near-me',
  ],
  '/services/cooling/': [
    'cooling/window-portable-ac-installation-repair-near-me',
  ],
  '/services/air-quality/': [
    'air-quality/dehumidifier-installation-near-me',
    'indoor-air-quality-ventilation/ceiling-fan-installation-repair-near-me',
    'indoor-air-quality-ventilation/exhaust-fan-installation-repair-near-me',
    'indoor-air-quality-ventilation/dryer-vent-cleaning-repair-near-me',
    'indoor-air-quality-ventilation/attic-fan-installation-repair-near-me',
  ],
  '/services/commercial/': [
    'commercial-specialty/commercial-refrigeration-repair-maintenance-near-me',
    'commercial-specialty/generator-installation-repair-near-me',
  ],
}
const navigationPaths = new Set(referenceNavigation().flatMap((cluster) => cluster.pages.map((page) => page.livePath)))
for (const [category, keys] of Object.entries(removedPages)) {
  for (const key of keys) {
    const [cluster, slug] = key.split('/')
    const previousSlug = slug.replace(/-near-me$/, '')
    assert.equal(referenceSnapshots[key], undefined, `Snapshot still present: ${key}`)
    assert.equal(getReferenceService(cluster, slug), undefined, `Still in a catalog: ${key}`)
    assert.ok(!navigationPaths.has(`/services/${key}/`), `Still in the navigation: ${key}`)
    assert.equal(legacyReplacementPath(slug), category, `Current address: ${key}`)
    assert.equal(legacyReplacementPath(previousSlug), category, `Previous address: ${key}`)
    if (taxonomy.services.some((service) => service.clusterSlug === cluster && service.slug === previousSlug)) {
      const response = proxy(new NextRequest(`http://localhost/services/${cluster}/${previousSlug}/?utm=old`))
      assert.equal(response.status, 308, `No permanent redirect from ${previousSlug}`)
      assert.equal(response.headers.get('location'), `http://localhost${category}?utm=old`)
    }
  }
}
assert.equal(legacyReplacementPath('dehumidifier-installation-repair'), '/services/air-quality/')
assert.equal(legacyReplacementPath('boiler-repair-installation'), '/services/heating/')
assert.equal(legacyReplacementPath('boiler-services'), '/services/heating/')
// The ad URLs serve the page directly (no redirect), with or without the trailing slash or a gclid.
for (const slug of originalUrlPages) {
  const page = getReferenceService('heating', slug)!
  assert.equal(page.livePath, `/services/heating/${slug}/`)
  assert.equal(page.canonicalUrl, `https://citysuburbanheating.com/services/heating/${slug}/`)
  assert.ok(referenceSnapshots[`heating/${slug}`], `Snapshot key not moved: ${slug}`)
  assert.equal(proxy(new NextRequest(`http://localhost/services/heating/${slug}/?gclid=ad`)).headers.get('location'), null, `Ad URL redirects: ${slug}`)
}
console.log('Reference checks passed: 22 exact live URLs (19 -near-me, 3 heater ad pages on their original URL; old addresses redirect), 4 retained keyword pages, 39 consolidated overlaps (15 removed pages go to their category page), cards, editable markup and schema.')
