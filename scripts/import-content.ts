import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import {clusterRef} from './service-url-map'

type Row = Record<string, string>
type Source = {equip: Row[]; area: Row[]; page: Row[]}
type ImportDocument = {_id: string; _type: string; [key: string]: unknown}
type MediaAsset = {path: string; alt: string; credit: string}
type MediaPlan = {
  assets: Record<string, MediaAsset>
  services: Record<string, {cover: string; gallery: string[]; workingPhotos: string[]}>
  areas: Record<string, Record<string, string>>
}

function loadLocalEnv() {
  const envPath = path.resolve('.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator)
    const value = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()
const projectId = process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0'
const dataset = process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('Add a Sanity Editor token to SANITY_API_WRITE_TOKEN in .env.local')

const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
const rawSource = JSON.parse(fs.readFileSync(path.resolve('data/source-content.json'), 'utf8')) as Source
const mediaPlan = JSON.parse(fs.readFileSync(path.resolve('data/media-plan.json'), 'utf8')) as MediaPlan
const inheritedCompanies = new Set(rawSource.page.map((row) => row.company_name).filter(Boolean))
if ([...inheritedCompanies].some((company) => /Highlights Chicago/i.test(company))) {
  throw new Error('Import blocked: data/source-content.json is inherited Highlights Chicago reference content. Replace it with approved City & Suburban HVAC content before importing into Sanity.')
}
const decodeRows = (rows: Row[]) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([field, value]) => [field, typeof value === 'string' ? decode(value) : value])) as Row)
const source: Source = {equip: decodeRows(rawSource.equip), area: decodeRows(rawSource.area), page: decodeRows(rawSource.page)}
const taxonomy = JSON.parse(fs.readFileSync(path.resolve('data/service-taxonomy.json'), 'utf8')) as {services: Array<{serviceId: number; clusterSlug: string; scopeStatus: string; scopeNote: string}>}
const taxonomyById = new Map(taxonomy.services.map((item) => [item.serviceId, item]))
const reviewContexts = JSON.parse(fs.readFileSync(path.resolve('data/review-context.json'), 'utf8')) as Record<string, Record<string, string>>
const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false})
const key = (prefix: string, index: number) => `${prefix}-${index + 1}`
const strings = (raw = '') => raw.split('||').map((item) => item.trim()).filter(Boolean)
const keywords = (raw = '') => raw.split(/\|\||,/).map((item) => item.trim()).filter(Boolean)
const objects = (raw: string, fields: string[], prefix: string): Array<{_key: string} & Record<string, string>> => strings(raw).map((item, index) => {
  const parts = item.split('::')
  return {_key: key(prefix, index), ...Object.fromEntries(fields.map((field, fieldIndex) => [field, (parts[fieldIndex] || '').trim()]))}
})
const imageList = (raw: string, prefix: string, altPrefix: string) => strings(raw).map((externalUrl, index) => ({_key: key(prefix, index), _type: 'externalImage', externalUrl, alt: `${altPrefix} ${index + 1}`}))
const plannedImage = (assetKey: string, useKey: string, assetRefs: Record<string, string>) => {
  const asset = mediaPlan.assets[assetKey]
  const assetRef = assetRefs[assetKey]
  if (!asset || !assetRef) throw new Error(`Missing planned media asset: ${assetKey}`)
  return {
    _key: useKey,
    _type: 'externalImage',
    image: {_type: 'image', asset: {_type: 'reference', _ref: assetRef}},
    alt: asset.alt,
    credit: asset.credit,
  }
}
const firstVolume = (raw = '') => Number((raw.match(/[\d,]+/)?.[0] || '0').replace(/,/g, ''))
const blocksFromHtml = (html: string, prefix: string) => decode(html)
  .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .split(/\n+/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((text, index) => ({_key: key(`${prefix}-block`, index), _type: 'block', style: 'normal', markDefs: [], children: [{_key: key(`${prefix}-span`, index), _type: 'span', text, marks: []}]}))

const firstPage = source.page[0]
const siteSettings = {
  _id: 'siteSettings', _type: 'siteSettings',
  companyName: firstPage.company_name,
  siteUrl: firstPage.site_url,
  phoneDisplay: firstPage.phone_display,
  phoneE164: firstPage.phone_e164,
  email: firstPage.email,
  address: {street: firstPage.address_street, city: firstPage.address_city, state: firstPage.address_state, zip: firstPage.address_zip},
  shopLocation: {_type: 'geopoint', lat: Number(firstPage.shop_lat), lng: Number(firstPage.shop_lng)},
  schemaBusinessType: firstPage.schema_business_type,
  brand: {primary: firstPage.brand_color, dark: firstPage.brand_dark, light: firstPage.brand_light, secondary: firstPage.brand_secondary, accent: firstPage.accent_color, accentDark: firstPage.accent_dark},
  google: {rating: Number(firstPage.google_rating), reviewCount: Number(firstPage.google_review_count), reviewsUrl: firstPage.google_reviews_url, verifiedAt: '2026-08-31'},
  trustLines: [firstPage.trust_line_1, firstPage.trust_line_2].filter(Boolean),
  trustHeading: firstPage.trust_heading,
  trustLede: firstPage.trust_lede,
  trustMetrics: [1, 2, 4, 5].map((cell, index) => ({_key: key('metric', index), _type: 'trustMetric', value: firstPage[`trust_cell_${cell}_value`], label: firstPage[`trust_cell_${cell}_label`]})),
  trustCards: objects(firstPage.trust_cards, ['title', 'body'], 'trust-card').map((item) => ({...item, _type: 'titledBody'})),
  reviewsHeading: firstPage.reviews_heading,
  reviewsDisclaimer: 'Each card uses a short verbatim excerpt from the linked Google review, followed by a service-specific summary. Reviews were verified 31 August 2026.',
  formSubtitle: firstPage.form_subtitle,
  formNote: firstPage.form_note,
}

const template = {
  _id: 'servicePageTemplate-standard-v1', _type: 'servicePageTemplate', name: 'Standard service landing page', version: '1.2.0', active: true,
  sectionOrder: ['hero', 'types', 'brands', 'trust', 'reviews', 'why', 'workingArea', 'coverage', 'otherServices', 'pricing', 'faq', 'closingCta', 'guides'],
  presentation: {
    footerColor: '#09263A',
    accentColor: '#DD382B',
    accentDarkColor: '#B92E23',
    actionBlueColor: '#0A4265',
    equalHeightReviewCards: true,
    ratingAfterReviewText: true,
    coverageMapFirst: true,
    neighborhoodGrid: true,
    brandLogoCards: true,
    pricingHeadingAsQuestion: true,
    separateCollectionCover: true,
    heroGalleryImageCount: 3,
    workingPhotoCount: 3,
    locationPhotoCards: true,
  },
}

const services = source.equip.map((row) => {
  const serviceId = row.service_id || row.C
  const taxonomyItem = taxonomyById.get(Number(serviceId))
  if (!taxonomyItem) throw new Error(`Missing service taxonomy for ${serviceId}`)
  return ({
  _id: `service-${serviceId}`, _type: 'serviceDefinition', serviceId: Number(serviceId), name: row.name, slug: {_type: 'slug', current: row.slug},
  cluster: clusterRef(taxonomyItem.clusterSlug), scopeStatus: taxonomyItem.scopeStatus, scopeNote: taxonomyItem.scopeNote,
  parentName: row.parent_name, parentUrl: row.parent_url, hubUrl: row.hub_url,
  primaryKeywords: keywords(row.kw_primary), monthlySearchVolume: firstVolume(row.kw_volume), searchVolumeSummary: row.kw_volume, secondaryKeywords: keywords(row.kw_secondary),
  h1Prefix: row.h1_prefix, heroLede: row.hero_lede, secondaryCta: row.cta_secondary, issueQuestion: row.issue_question, issueOptions: strings(row.issue_options),
  typesHeading: row.types_heading, typesLede: row.types_lede,
  types: objects(row.types, ['legacyIconSvg', 'name', 'description'], `type-${serviceId}`).map((item) => ({...item, _type: 'serviceType'})),
  typesFootnote: row.types_footnote, brandsHeading: row.brands_heading, brandsLede: row.brands_lede, brands: strings(row.brands), brandsNote: row.brands_note,
  whyHeading: row.why_heading, whyLede: row.why_lede, whyItems: objects(row.why, ['title', 'body'], `why-${serviceId}`).map((item) => ({...item, _type: 'titledBody'})),
  featuredCategory: {tag: row.feature_tag, title: row.feature_title, description: row.feature_desc, cta: row.feature_cta, url: row.feature_url},
  otherServices: objects(row.other_services, ['name', 'description', 'url'], `other-${serviceId}`).map((item) => ({...item, _type: 'linkedService'})),
  pricing: {heading: row.pricing_heading, lede: row.pricing_lede, caption: row.pricing_caption, column1: row.pricing_col_1, column2: row.pricing_col_2, column3: row.pricing_col_3, rows: objects(row.pricing_rows, ['job', 'driver', 'permit'], `price-${serviceId}`).map((item) => ({...item, _type: 'pricingRow'})), note: row.pricing_note},
  faqs: objects(row.faqs, ['question', 'answer'], `faq-${serviceId}`).map((item) => ({...item, _type: 'faq'})), ctaHeading: row.cta_heading, ctaBody: row.cta_body,
})})

const buildAreas = (assetRefs: Record<string, string>) => source.area.map((row) => ({
  _id: `area-${row.slug}`, _type: 'serviceArea', name: row.name, slug: {_type: 'slug', current: row.slug}, state: row.state,
  heroEyebrow: row.hero_eyebrow, galleryLabel: row.gallery_label, addressPlaceholder: row.address_placeholder, buildingTypes: strings(row.building_types),
  workingLede: row.working_lede, areasHeading: row.areas_heading, areasLede: row.areas_lede, areasNote: row.areas_note,
  subAreas: objects(row.sub_areas, ['name', 'note', 'externalUrl'], `subarea-${row.slug}`).map(({externalUrl, ...item}, index) => {
    const assetKey = mediaPlan.areas[row.slug]?.[item.name]
    const photo = assetKey
      ? plannedImage(assetKey, key(`subarea-photo-${row.slug}`, index), assetRefs)
      : externalUrl
        ? {_type: 'externalImage', externalUrl, alt: item.name}
        : undefined
    return {...item, _type: 'subArea', photo}
  }),
  mapQuery: row.map_query, libraryHeading: row.library_heading, libraryLede: row.library_lede,
  localFaqs: objects(firstPage.faqs_local, ['question', 'answer'], `local-faq-${row.slug}`).map((item) => ({...item, _type: 'faq'})),
}))

const buildPages = (assetRefs: Record<string, string>) => source.page.map((row) => {
  const plannedMedia = mediaPlan.services[row.equipment_slug]
  return ({
  _id: `servicePage-${row.service_id}-${row.area_slug}`, _type: 'servicePage', title: `${row.equipment_slug} — ${row.area_slug}`, serviceId: Number(row.service_id),
  service: {_type: 'reference', _ref: `service-${row.service_id}`}, area: {_type: 'reference', _ref: `area-${row.area_slug}`}, template: {_type: 'reference', _ref: template._id},
  seo: {
    title: row.meta_title,
    description: row.meta_description,
    canonicalUrl: row.canonical_url,
  },
  trustMetrics: [1, 2, 4, 5].map((cell, index) => ({_key: key(`page-${row.service_id}-metric`, index), _type: 'trustMetric', value: row[`trust_cell_${cell}_value`], label: row[`trust_cell_${cell}_label`]})),
  reviews: objects(row.reviews, ['quote', 'author', 'date', 'sourceUrl', 'sourceId'], `review-${row.service_id}`).map((item) => ({
    ...item,
    summary: reviewContexts[String(row.service_id)]?.[item.sourceId],
    _type: 'review',
    verifiedAt: '2026-08-31',
  })),
  coverImage: plannedMedia ? plannedImage(plannedMedia.cover, `cover-${row.service_id}`, assetRefs) : undefined,
  gallery: plannedMedia
    ? plannedMedia.gallery.map((assetKey, index) => plannedImage(assetKey, key(`gallery-${row.service_id}`, index), assetRefs))
    : imageList(row.gallery, `gallery-${row.service_id}`, `${row.equipment_slug} project`),
  workingPhotos: plannedMedia
    ? plannedMedia.workingPhotos.map((assetKey, index) => plannedImage(assetKey, key(`working-${row.service_id}`, index), assetRefs))
    : imageList(row.working_photos, `working-${row.service_id}`, `${row.equipment_slug} work in ${row.area_slug}`),
  guides: objects(row.guides, ['title', 'legacyHtml'], `guide-${row.service_id}`).map((item, index) => ({...item, _type: 'guide', body: blocksFromHtml(item.legacyHtml, `guide-${row.service_id}-${index}`)})),
  formSubtitle: row.form_subtitle,
  formNote: row.form_note,
  localFaqOverrides: [],
  })
})

const dryRun = process.argv.includes('--dry-run')

async function uploadMediaAssets(): Promise<Record<string, string>> {
  const assetRefs: Record<string, string> = {}
  for (const [assetKey, media] of Object.entries(mediaPlan.assets)) {
    const filePath = path.resolve(media.path)
    if (!fs.existsSync(filePath)) throw new Error(`Missing local media file: ${media.path}`)
    const uploaded = await client.assets.upload('image', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      title: media.alt,
    })
    assetRefs[assetKey] = uploaded._id
    console.log(`Prepared media: ${assetKey}`)
  }
  return assetRefs
}

async function importDocuments() {
  const assetRefs = dryRun
    ? Object.fromEntries(Object.keys(mediaPlan.assets).map((assetKey) => [assetKey, `image-dry-run-${assetKey}`]))
    : await uploadMediaAssets()
  const areas = buildAreas(assetRefs)
  const pages = buildPages(assetRefs)
  const documents: ImportDocument[] = [siteSettings, template, ...services, ...areas, ...pages]
  const ids = documents.map((document) => document._id)
  if (new Set(ids).size !== ids.length) throw new Error('Import blocked: duplicate Sanity document IDs')
  if (services.some((service) => !Number.isFinite(service.monthlySearchVolume))) throw new Error('Import blocked: invalid monthly search volume')
  if (dryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      projectId,
      dataset,
      documentCount: documents.length,
      documentIds: ids,
      servicePages: pages.map((page) => ({_id: page._id, title: page.seo.title, canonicalUrl: page.seo.canonicalUrl})),
    }, null, 2))
    return
  }
  let transaction = client.transaction()
  for (const document of documents) transaction = transaction.createOrReplace(document)
  const result = await transaction.commit()
  console.log(`Imported ${documents.length} documents in transaction ${result.transactionId}`)
}

importDocuments().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown Sanity import error')
  process.exit(1)
})
