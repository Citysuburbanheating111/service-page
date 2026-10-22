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
assert.deepEqual(counts, {heating: 7, cooling: 6, 'air-quality': 5, commercial: 6})
assert.equal(catalog.length, 24)
assert.equal(new Set(catalog.map((page) => `${page.clusterSlug}/${page.slug}`)).size, 24)
assert.equal(new Set(catalog.map((page) => page.livePath)).size, 24)
assert.equal(catalog.filter((page) => page.qcStatus === 'PASS').length, 16)
assert.equal(retainedCatalog.length, 17)
assert.equal(new Set([...catalog, ...retainedCatalog].map(page => page.cardImage)).size, 41, 'Every service card needs a distinct image')
assert.equal(servicesMenu.href, '/services/')
assert.deepEqual(liveMenu.flatMap((group) => group.items.map((item) => [item.label, new URL(item.href, LIVE_SITE).pathname])), catalog.map((page) => [page.name, page.livePath]))

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

const editable = referenceSnapshots['heating/heater-repair-near-me'].sections.find((section) => section.module === 'hero')!
const titleField = editable.contentFields!.find((field) => field.label?.startsWith('H1:'))!
const editedHero = applyReferenceContentFields(editable.html, [{...titleField, value: 'A heading with <unsafe> & text'}])
assert.ok(editedHero.includes('A heading with &lt;unsafe&gt; &amp; text'))
assert.ok(!editedHero.includes('<unsafe>'))
const faq = referenceSnapshots['heating/heater-repair-near-me'].sections.find((section) => section.module === 'faq')!
const faqField = faq.contentFields!.find((field) => field.label?.startsWith('SUMMARY:'))!
const editedFaq = applyReferenceContentFields(faq.html, [{...faqField, value: 'Updated service question?'}])
const synchronized = JSON.parse(synchronizeVisibleSchema(referenceSnapshots['heating/heater-repair-near-me'].schema, editedFaq))
assert.equal(synchronized['@graph'].find((node: {'@type': string}) => node['@type'] === 'FAQPage').mainEntity[0].name, 'Updated service question?')

for (const cluster of referenceNavigation()) {
  const expected = [...catalog.filter((page) => page.clusterSlug === cluster.slug), ...retainedCatalog.filter((page) => page.directoryClusterSlug === cluster.slug)]
  assert.deepEqual(cluster.pages.map((page) => [page.serviceName, page.livePath]), expected.map((page) => [page.name, page.livePath]))
}
for (const untouched of ['/services/heating/', '/services/unrelated/', '/services/api/lead/', '/service-area/lincoln-park/', '/service-areas/']) {
  assert.equal(proxy(new NextRequest(`http://localhost${untouched}`)).headers.get('x-middleware-rewrite'), null)
}

for (const old of taxonomy.services) {
  const replacement = (migrations.overlaps as Record<string, string>)[old.slug]
  if (replacement) {
    assert.equal(legacyReplacementPath(old.slug), replacement)
    assert.ok(catalog.some((page) => page.livePath === replacement), `Missing redirect destination: ${old.slug}`)
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
assert.equal(futureNavigation.pages.length, 8)
assert.equal(futureNavigation.sourceServiceCount, 8)
assert.equal(futureNavigation.pages.at(-1)?.livePath, '/services/cooling/future-cms-service/')
assert.equal(futureNavigation.pages.at(-1)?.cardImage, futurePage.cardImage)
const futureSnapshot = renderReferencePage({...futurePage, responsiveCss: '.test{color:red}', sections: [{module: 'hero', html: '<section><h1>New published CMS service</h1><img src="/service/images/new.jpg" /></section>'}]})!
assert.ok(futureSnapshot.html.includes('<h1>New published CMS service</h1>'))
assert.ok(futureSnapshot.html.includes('/services/images/new.jpg'))
assert.equal(futureSnapshot.style, '.test{color:red}')
assert.equal(renderReferencePage(null), undefined)
assert.equal(renderReferencePage(null, referenceSnapshots['heating/heater-repair-near-me']), referenceSnapshots['heating/heater-repair-near-me'])
assert.deepEqual(migrateServiceContent({url: '/service/heating/water-heater-repair-installation/', image: '/service/images/logo.png', neighborhood: '/service-area/lincoln-park/', collection: '/service/heating-services/'}), {
  url: '/services/heating/water-heater-repair-installation/', image: '/services/images/logo.png', neighborhood: '/service-area/lincoln-park/', collection: '/services/heating/',
})
// "-near-me" URLs: every page's previous address answers with one permanent redirect to the new one.
for (const page of [...catalog, ...retainedCatalog]) {
  assert.equal(page.slug, `${page.previousSlug}-near-me`, `Slug is not the near-me form: ${page.slug}`)
  for (const old of [`/services/${page.clusterSlug}/${page.previousSlug}/`, `/services/${page.clusterSlug}/${page.previousSlug}`, `/service/${page.clusterSlug}/${page.previousSlug}/`]) {
    const response = proxy(new NextRequest(`http://localhost${old}?utm=old`))
    assert.equal(response.status, 308, `No permanent redirect from ${old}`)
    assert.equal(response.headers.get('location'), `http://localhost${page.livePath}?utm=old`)
  }
}
console.log('Reference checks passed: 24 exact live URLs (all -near-me, old addresses redirect), 17 retained keyword pages, 8 consolidated overlaps, cards, editable markup and schema.')
