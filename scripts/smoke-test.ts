import fs from 'node:fs'
import path from 'node:path'

type Row = Record<string, string>
type Source = {equip: Row[]; area: Row[]; page: Row[]}

const baseUrl = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const source = JSON.parse(fs.readFileSync(path.resolve('data/source-content.json'), 'utf8')) as Source
const navigationSources = [
  source,
  JSON.parse(fs.readFileSync(path.resolve('data/source-content-306-315.json'), 'utf8')) as Source,
  JSON.parse(fs.readFileSync(path.resolve('data/source-content-316-325.json'), 'utf8')) as Source,
]
const navigationEquipment = navigationSources.flatMap((batch) => batch.equip)
const navigationPages = navigationSources.flatMap((batch) => batch.page)
const taxonomy = JSON.parse(fs.readFileSync(path.resolve('data/service-taxonomy.json'), 'utf8')) as {services: Array<{serviceId: number; clusterSlug: string}>}
const clusters = JSON.parse(fs.readFileSync(path.resolve('data/service-clusters.json'), 'utf8')) as {clusters: Array<{slug: string}>}
const serviceBySlug = new Map(source.equip.map((row) => [row.slug, row]))
const areaBySlug = new Map(source.area.map((row) => [row.slug, row]))
const sourceIds = new Set(navigationPages.map((row) => Number(row.service_id)))
const availableClusterSlugs = new Set(taxonomy.services.filter((item) => sourceIds.has(item.serviceId)).map((item) => item.clusterSlug))
const clusterByServiceId = new Map(taxonomy.services.map((item) => [item.serviceId, item.clusterSlug]))
// The live service pages this app serves; the menus link to them with relative URLs.
const referencePages = ['catalog.json', 'retained-catalog.json'].flatMap((file) =>
  JSON.parse(fs.readFileSync(path.resolve('src/reference-pages', file), 'utf8')) as Array<{clusterSlug: string; livePath: string}>)
const validServicePaths = new Set([
  '/services/',
  ...referencePages.flatMap((page) => [page.livePath, `/services/${page.clusterSlug}/`]),
  ...clusters.clusters.filter((cluster) => availableClusterSlugs.has(cluster.slug)).map((cluster) => `/services/${cluster.slug}/`),
  ...navigationEquipment.map((row) => `/services/${clusterByServiceId.get(Number(row.C))}/${row.slug}/`),
])
const failures: string[] = []
let assertions = 0

function expect(condition: unknown, message: string) {
  assertions += 1
  if (!condition) failures.push(message)
}

async function request(pathname: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${pathname}`, init)
  const text = await response.text()
  return {response, text}
}

function reviewEntries(raw = '') {
  return raw.split('||').map((entry) => {
    const [quote, author, date, sourceUrl, sourceId] = entry.split('::').map((value) => value.trim())
    return {quote, author, date, sourceUrl, sourceId}
  }).filter((entry) => entry.sourceId)
}

function brandLogoPath(brand: string) {
  const slug = brand
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `/services/images/brands/${slug}.png`
}

function visibleText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}

function anchorHrefs(html: string) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((match) => match[1].replace(/&amp;/g, '&'))
}

function headingTexts(html: string) {
  return [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((match) => visibleText(match[1]).trim())
}

async function testDocument(pathname: string, requiredText: string[]) {
  const {response, text} = await request(pathname)
  expect(response.status === 200, `${pathname} returned ${response.status}`)
  expect(!/This page couldn.t load|Application error|Internal Server Error/i.test(text), `${pathname} rendered an error page`)
  for (const value of requiredText) expect(text.includes(value), `${pathname} is missing ${JSON.stringify(value)}`)
  return text
}

async function run() {
  const collection = await testDocument('/services', ['Trusted HVAC experts for Chicago homes', 'Explore by system'])
  expect(!collection.includes('Browse HVAC service clusters'), 'Collection page still renders the removed browse heading')
  expect(!collection.includes('Start with the system or problem category'), 'Collection page still renders the removed directory paragraph')
  expect(!collection.includes('local pages'), 'Collection page still labels cluster cards with local-page counts')
  expect(collection.includes('Explore services'), 'Collection page is missing the compact Explore services CTA')
  expect(collection.includes('class="collection-hero-svg"'), 'Collection hero is missing the red-and-white SVG graphic')
  expect(!collection.includes('/services/images/services/electrical-panel-upgrade.jpg'), 'Collection hero still uses the retired raster background')
  for (const href of [
    'https://citysuburbanheating.com/',
    'https://citysuburbanheating.com/about-us/',
    'https://citysuburbanheating.com/contact-us/',
    'https://citysuburbanheating.com/services/heating/',
    'https://citysuburbanheating.com/services/cooling/',
    'https://citysuburbanheating.com/services/air-quality/',
    'https://citysuburbanheating.com/services/commercial-hvac/',
    'https://citysuburbanheating.com/services/heating/heater-repair/',
    'https://citysuburbanheating.com/services/heating-services/',
    '/services/',
    'tel:+17732383838',
    'mailto:service@citysuburbanheating.com',
  ]) expect(anchorHrefs(collection).includes(href) || anchorHrefs(collection).includes(href.replace('https://citysuburbanheating.com/services/', '/services/')), `Collection page is missing live destination ${href}`)
  expect(collection.includes('Need quick help?') && collection.includes('class="site-footer"'), 'Collection page is missing the live-site footer')
  expect(collection.includes('>Services<') && !collection.includes('>Service Areas<'), 'Header must show Services in place of Service Areas')
  expect(collection.includes('We provide top-quality heating, ventilation, and air conditioning services tailored to your needs.'), 'Collection footer is missing the live company summary')
  // The only /service-areas/ link is the home page Services dropdown's "All service areas →".
  expect(anchorHrefs(collection).filter(href => href === 'https://citysuburbanheating.com/service-areas/').length === 1 && collection.includes('All service areas →'), 'Header still links to Service Areas')
  expect(!collection.includes('nearby suburbs'), 'Collection page still makes the removed nearby-suburbs claim')
  expect(!collection.includes('NATE'), 'Collection page still makes an unverified NATE certification claim')
  expect(collection.includes('class="site-topbar"'), 'Collection page is missing the live top bar')
  expect(collection.includes('/wp-content/uploads/2025/05/city-suburban-transparent-logo.png'), 'Collection page is not using the live City & Suburban logo')
  expect((collection.match(/class="cluster-card"/g) || []).length === availableClusterSlugs.size, 'Collection page does not render each available service cluster')
  expect(!collection.includes('class="cluster-filter-bar"'), 'Collection page still renders the unnecessary system filter bar')
  expect(collection.includes('class="cluster-card-count"'), 'Collection cards are missing their service-count overlays')
  expect(collection.includes('class="cluster-card-title"'), 'Collection cards are missing their cluster titles')
  expect(collection.includes('loading="lazy"'), 'Collection card images are not lazy-loaded')
  expect(!collection.includes('cluster-card-service-chip'), 'Collection cards still expose individual equipment-service chips')
  expect(!collection.includes('/services/furnace/lincoln-park'), 'Collection page still renders the Lincoln Park sample')
  const cardImages = [...collection.matchAll(/class="cluster-card-media[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, '&'))
  for (const image of cardImages) {
    const isRemote = /^https:\/\//.test(image)
    if (isRemote) {
      expect(new URL(image).hostname === 'cdn.sanity.io', `Collection image is not from the configured Sanity CDN: ${image}`)
    } else {
      expect(image.startsWith('/services/images/services/'), `Collection image is not a recognized local service image: ${image}`)
      const imagePath = path.resolve('public', image.replace('/services/', ''))
      expect(fs.existsSync(imagePath), `Collection image file is missing: ${image}`)
      const imageBytes = fs.readFileSync(imagePath)
      expect(imageBytes.length > 10_000, `Collection image is unexpectedly small: ${image}`)
      const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
      const isPng = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4e && imageBytes[3] === 0x47
      expect(isJpeg || isPng, `Collection image is not a valid JPEG or PNG: ${image}`)
    }
    const imageResponse = await fetch(isRemote ? image : `${baseUrl}${image}`)
    expect(imageResponse.status === 200, `Collection image returned ${imageResponse.status}: ${image}`)
    expect(imageResponse.headers.get('content-type')?.startsWith('image/'), `Collection image has an invalid content type: ${image}`)
    expect((await imageResponse.arrayBuffer()).byteLength > 10_000, `Collection image response is unexpectedly small: ${image}`)
  }
  for (const clusterSlug of availableClusterSlugs) {
    const clusterPage = await testDocument(`/services/${clusterSlug}`, ['services in Chicago', 'in this category'])
    expect(!clusterPage.includes('Service landing page'), `/services/${clusterSlug} still renders the removed landing-page keyword card`)
    expect(!visibleText(clusterPage).includes('monthly searches'), `/services/${clusterSlug} still exposes monthly search-volume data`)
    const panelImage = clusterPage.match(/data-panel-image="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&')
    expect(panelImage?.startsWith('https://cdn.sanity.io/'), `/services/${clusterSlug} is missing its Sanity image-backed count panel`)
  }
  await testDocument('/services/studio', [])

  for (const row of navigationPages.filter((candidate) => Number(candidate.service_id) > 305)) {
    const pathname = `/services/${clusterByServiceId.get(Number(row.service_id))}/${row.equipment_slug}`
    const service = navigationEquipment.find((candidate) => Number(candidate.C) === Number(row.service_id))
    const text = await testDocument(pathname, ['id="quote"', 'id="reviews"', 'id="faq"', 'id="guides"'])
    expect(visibleText(text).includes(`${service?.h1_prefix} in Chicago`), `${pathname} is missing its mapped Chicago H1`)
    expect((text.match(/class="site-header"/g) || []).length === 1, `${pathname} does not render exactly one shared header`)
    expect((text.match(/class="site-footer"/g) || []).length === 1, `${pathname} does not render exactly one shared footer`)
  }

  for (const row of source.page) {
    const pathname = `/services/${clusterByServiceId.get(Number(row.service_id))}/${row.equipment_slug}`
    const service = serviceBySlug.get(row.equipment_slug)
    const area = areaBySlug.get(row.area_slug)
    const heading = `${service?.h1_prefix} in ${area?.name}`
    const text = await testDocument(pathname, [heading, 'id="quote"', 'id="reviews"', 'id="faq"', 'id="guides"'])
    expect((text.match(/class="site-header"/g) || []).length === 1, `${pathname} does not render exactly one shared header`)
    expect((text.match(/class="site-footer"/g) || []).length === 1, `${pathname} does not render exactly one shared footer`)
    expect((text.match(/class="site-topbar"/g) || []).length === 1, `${pathname} does not render exactly one top bar`)
    const renderedText = visibleText(text)
    for (const pageHeading of headingTexts(text).filter((value) => /^(what|why|who)\b/i.test(value))) {
      expect(pageHeading.endsWith('?'), `${pathname} question heading is missing ?: ${pageHeading}`)
    }
    for (const href of anchorHrefs(text)) {
      expect(Boolean(href), `${pathname} contains an empty link`)
      if (href.startsWith('#')) expect(text.includes(`id="${href.slice(1)}"`), `${pathname} has a broken ${href} anchor`)
      else if (href.startsWith('tel:')) expect(/^\+?\d{10,15}$/.test(href.slice(4).replace(/[^+\d]/g, '')), `${pathname} has an invalid phone link ${href}`)
      else if (href.startsWith('mailto:')) expect(/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(href), `${pathname} has an invalid email link ${href}`)
      else if (/^https?:/.test(href)) expect(Boolean(new URL(href)), `${pathname} has an invalid external URL ${href}`)
      else expect(validServicePaths.has(href), `${pathname} has an invalid internal URL ${href}`)
    }
    for (const id of ['quote', 'working-in-area']) {
      expect(text.includes(`id="${id}"`), `${pathname} is missing the #${id} target`)
    }
    for (const review of reviewEntries(row.reviews)) {
      expect(renderedText.includes(review.quote), `${pathname} is missing review excerpt ${review.sourceId}`)
      // Review cards show the verbatim excerpt only (audit 2026-10-05); paraphrased summaries are not rendered.
      expect(anchorHrefs(text).includes(review.sourceUrl), `${pathname} does not link review ${review.sourceId} to Google`)
    }
    expect((text.match(/class="rev-card"/g) || []).length === 4, `${pathname} does not render four review cards`)
    expect(text.includes('reviews-grid-equal'), `${pathname} does not use equal-height review cards`)
    expect(!text.includes('class="rev-head"'), `${pathname} still renders the duplicate aggregate rating above reviews`)
    expect(text.indexOf('class="rev-rating"') > text.indexOf('<blockquote>'), `${pathname} does not place the rating after review feedback`)
    expect(text.includes('class="brands-section"'), `${pathname} does not use the footer-colored brand section`)
    expect(text.includes('class="brand-strip"'), `${pathname} does not use the shared horizontal brand marquee`)
    expect((text.match(/class="brand-sequence"/g) || []).length === 2, `${pathname} does not render two seamless brand-marquee sequences`)
    expect(text.includes('class="trust-cell google-proof-cell"'), `${pathname} is missing the normalized Google proof rating`)
    expect(text.includes('class="google-review-total"'), `${pathname} is missing the linked total Google review count`)
    const reviewTotalHref = text.match(/<a class="google-review-total" href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&')
    expect(reviewTotalHref === row.google_reviews_url, `${pathname} review count does not link to the configured Google review page`)
    expect(text.indexOf('>A+</b>') < text.indexOf('class="trust-cell google-proof-cell"'), `${pathname} does not place A+ before the final Google proof cell`)
    expect(text.indexOf('class="trust-cell google-proof-cell"') > text.lastIndexOf('class="trust-cell"'), `${pathname} does not render Google proof as the fifth trust cell`)
    expect(!text.includes('class="static-stars"'), `${pathname} still renders a duplicate row of Google stars`)
    expect(!text.includes('class="fill"'), `${pathname} still renders an overlapping duplicate star layer`)
    for (const brand of (service?.brands || '').split('||').filter(Boolean)) {
      const logoPath = brandLogoPath(brand)
      const logoSlug = logoPath.slice('/services/images/brands/'.length, -'.png'.length)
      expect(text.includes(logoPath), `${pathname} is missing the ${brand} logo`)
      expect(text.includes(`brand-mark--${logoSlug}`), `${pathname} is missing the ${brand} logo class`)
      expect(fs.existsSync(path.resolve('public', logoPath.replace('/services/', ''))), `Local brand logo is missing: ${logoPath}`)
    }
    const whySection = text.match(/<section class="wrap" id="why-us">([\s\S]*?)<\/section>/)?.[1] || ''
    expect((whySection.match(/<article class="why-item"/g) || []).length === (service?.why || '').split('||').filter(Boolean).length, `${pathname} does not render every why-us item as always-visible content`)
    expect(!whySection.includes('<details') && !whySection.includes('why-chevron'), `${pathname} still renders mobile why-us accordion controls`)
    expect(renderedText.includes(`Read all ${row.google_review_count} reviews`), `${pathname} does not include the live review count in the all-reviews CTA`)
    expect(text.indexOf('class="cs-gallery-rail"') < text.indexOf('class="cs-gallery-head"'), `${pathname} does not place the crew gallery caption below its images`)
    expect(renderedText.includes(`Our Work in ${area?.name}`), `${pathname} does not use the standard work-section heading`)
    expect(text.includes('class="single-line-mobile"'), `${pathname} does not mark the coverage heading as mobile single-line`)
    expect(text.includes('area-rail-single-row'), `${pathname} does not render the single-row horizontal location rail`)
    expect(!text.includes('class="area-grid"'), `${pathname} still renders locations as a wrapping grid`)
    expect(text.indexOf('class="area-map"') < text.indexOf('area-rail-single-row'), `${pathname} does not render the map before the location rail`)
    expect((text.match(/class="area-chip"/g) || []).length === (area?.sub_areas || '').split('||').filter(Boolean).length, `${pathname} does not render every location in the rail`)
    expect(text.includes('scroll horizontally to view all columns'), `${pathname} does not expose its mobile pricing table as horizontally scrollable`)
    const faqSection = text.match(/<section class="wrap" id="faq">([\s\S]*?)<\/section>/)?.[1] || ''
    expect((faqSection.match(/class="faq-chevron"/g) || []).length === (faqSection.match(/<details\b/g) || []).length, `${pathname} does not render one FAQ chevron per question`)
    expect(text.includes('class="wrap closing-cta-section"'), `${pathname} is missing the compact closing-CTA spacing hook`)
    expect(text.includes('class="cta-heading"'), `${pathname} does not mark the closing CTA heading for responsive sizing`)
    expect(text.includes('class="section-tint library-section"'), `${pathname} does not use shared library section spacing`)
    expect(text.includes('class="site-footer"'), `${pathname} is missing the live-site footer`)
    expect(renderedText.includes(`${service?.pricing_heading} in ${area?.name}?`), `${pathname} pricing heading is not a question`)
  }

  for (const service of navigationEquipment) {
    const clusterSlug = clusterByServiceId.get(Number(service.C))
    const oldCollection = await fetch(`${baseUrl}/services/${service.slug}/`, {redirect: 'manual'})
    expect(oldCollection.status === 308, `Legacy collection /services/${service.slug}/ returned ${oldCollection.status} instead of 308`)
    expect(oldCollection.headers.get('location') === `/services/${clusterSlug}/${service.slug}/`, `Legacy collection /services/${service.slug}/ redirects to the wrong hierarchy`)
  }
  for (const row of navigationPages) {
    const clusterSlug = clusterByServiceId.get(Number(row.service_id))
    const oldPage = await fetch(`${baseUrl}/services/${row.equipment_slug}/${row.area_slug}/`, {redirect: 'manual'})
    expect(oldPage.status === 308, `Legacy page /services/${row.equipment_slug}/${row.area_slug}/ returned ${oldPage.status} instead of 308`)
    expect(oldPage.headers.get('location') === `/services/${clusterSlug}/${row.equipment_slug}/`, `Legacy page /services/${row.equipment_slug}/${row.area_slug}/ redirects to the wrong hierarchy`)
    const oldNestedPage = await fetch(`${baseUrl}/services/${clusterSlug}/${row.equipment_slug}/${row.area_slug}/`, {redirect: 'manual'})
    expect(oldNestedPage.status === 308, `Area-suffixed page /services/${clusterSlug}/${row.equipment_slug}/${row.area_slug}/ returned ${oldNestedPage.status} instead of 308`)
    expect(oldNestedPage.headers.get('location') === `/services/${clusterSlug}/${row.equipment_slug}/`, `Area-suffixed page /services/${clusterSlug}/${row.equipment_slug}/${row.area_slug}/ redirects to the wrong hierarchy`)
  }

  const missing = await fetch(`${baseUrl}/services/heating/not-a-service/`, {redirect: 'manual'})
  expect(missing.status === 404, `Unknown service returned ${missing.status} instead of 404`)
  const removedLincolnPark = await fetch(`${baseUrl}/services/heating/furnace-repair-installation/lincoln-park/`, {redirect: 'manual'})
  expect(removedLincolnPark.status === 404, `Removed Lincoln Park route returned ${removedLincolnPark.status} instead of 404`)

  const invalidLead = await request('/services/api/lead/', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({}),
  })
  expect(invalidLead.response.status === 400, `Invalid lead returned ${invalidLead.response.status}`)

  const honeypot = await request('/services/api/lead/', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({website: 'bot.example'}),
  })
  expect(honeypot.response.status === 200, `Honeypot lead returned ${honeypot.response.status}`)

  const invalidWebhook = await request('/services/api/revalidate/', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({documentType: 'servicePage'}),
  })
  expect(invalidWebhook.response.status === 401, `Unsigned revalidation returned ${invalidWebhook.response.status}`)

  if (failures.length) {
    console.error(`Smoke test failed with ${failures.length} failure(s):\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
    process.exit(1)
  }

  console.log(`Smoke test passed: ${assertions} assertions across ${navigationPages.length} service pages.`)
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
