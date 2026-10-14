import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import {clusterRef} from './service-url-map'

type Row = Record<string, unknown>
type Source = {equip: Row[]; area: Row[]; page: Row[]}
type ImportDocument = {_id: string; _type: string; [key: string]: unknown}
type MediaAsset = {path: string; alt: string; credit: string; sourceUrl?: string; licenseUrl?: string}
type ServiceMedia = {cover: string; gallery: string[]; workingPhotos: string[]}

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

const batch = process.argv.find((argument) => argument.startsWith('--batch='))?.split('=')[1] || '306-315'
const batchConfig = {
  '306-315': {
    source: 'data/source-content-306-315.json',
    mediaPlan: 'data/media-plan-306-315.json',
    reviewContexts: 'data/review-context.json',
    startId: 306,
  },
  '316-325': {
    source: 'data/source-content-316-325.json',
    mediaPlan: 'data/media-plan-316-325.json',
    reviewContexts: 'data/review-context-316-325.json',
    startId: 316,
  },
} as const
const config = batchConfig[batch as keyof typeof batchConfig]
if (!config) throw new Error(`Unsupported batch: ${batch}`)

const source = JSON.parse(fs.readFileSync(path.resolve(config.source), 'utf8')) as Source
const sharedMedia = JSON.parse(fs.readFileSync(path.resolve('data/media-plan.json'), 'utf8')) as {assets: Record<string, MediaAsset>}
const licensedMedia306 = JSON.parse(fs.readFileSync(path.resolve('data/media-sources-306-315.json'), 'utf8')) as {assets: Record<string, MediaAsset>}
const licensedMedia316 = JSON.parse(fs.readFileSync(path.resolve('data/media-sources-316-325.json'), 'utf8')) as {assets: Record<string, MediaAsset>}
const serviceMedia = JSON.parse(fs.readFileSync(path.resolve(config.mediaPlan), 'utf8')) as {services: Record<string, ServiceMedia>}
const reviewContexts = JSON.parse(fs.readFileSync(path.resolve(config.reviewContexts), 'utf8')) as Record<string, Record<string, string>>
const taxonomy = JSON.parse(fs.readFileSync(path.resolve('data/service-taxonomy.json'), 'utf8')) as {services: Array<{serviceId: number; clusterSlug: string; scopeStatus: string; scopeNote: string}>}
const taxonomyById = new Map(taxonomy.services.map((item) => [item.serviceId, item]))
const mediaAssets = {...sharedMedia.assets, ...licensedMedia306.assets, ...licensedMedia316.assets}
const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

const value = (row: Row, field: string) => String(row[field] ?? '')
const decode = (input: string) => input.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
const key = (prefix: string, index: number) => `${prefix}-${index + 1}`
const strings = (raw = '') => raw.split('||').map((item) => item.trim()).filter(Boolean)
const keywords = (raw = '') => raw.split(/\|\||,/).map((item) => item.trim()).filter(Boolean)
const objects = (raw: string, fields: string[], prefix: string): Array<{_key: string} & Record<string, string>> => strings(raw).map((item, index) => {
  const parts = item.split('::')
  return {_key: key(prefix, index), ...Object.fromEntries(fields.map((field, fieldIndex) => [field, (parts[fieldIndex] || '').trim()]))}
})
const firstVolume = (raw = '') => Number((raw.match(/[\d,]+/)?.[0] || '0').replace(/,/g, ''))
const blocksFromHtml = (html: string, prefix: string) => decode(html)
  .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .split(/\n+/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((text, index) => ({_key: key(`${prefix}-block`, index), _type: 'block', style: 'normal', markDefs: [], children: [{_key: key(`${prefix}-span`, index), _type: 'span', text, marks: []}]}))

const expectedIds = Array.from({length: 10}, (_, index) => config.startId + index)
const equipmentIds = source.equip.map((row) => Number(row.C || row.service_id))
const pageIds = source.page.map((row) => Number(row.service_id))
if (equipmentIds.join(',') !== expectedIds.join(',')) throw new Error(`Expected equipment IDs ${batch}, received ${equipmentIds.join(',')}`)
if (pageIds.join(',') !== expectedIds.join(',')) throw new Error(`Expected page IDs ${batch}, received ${pageIds.join(',')}`)
if (source.area.length !== 1 || value(source.area[0], 'slug') !== 'chicago') throw new Error('Expected one shared Chicago area row')

const requiredAssetKeys = new Set<string>()
for (const row of source.page) {
  const slug = value(row, 'equipment_slug')
  const plan = serviceMedia.services[slug]
  if (!plan) throw new Error(`Missing media plan for ${slug}`)
  for (const assetKey of [plan.cover, ...plan.gallery, ...plan.workingPhotos]) {
    if (!mediaAssets[assetKey]) throw new Error(`Missing media asset definition: ${assetKey}`)
    requiredAssetKeys.add(assetKey)
  }
}

const plannedImage = (assetKey: string, useKey: string, assetRefs: Record<string, string>) => {
  const asset = mediaAssets[assetKey]
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

const buildServices = (): ImportDocument[] => source.equip.map((row) => {
  const serviceId = value(row, 'service_id') || value(row, 'C')
  const taxonomyItem = taxonomyById.get(Number(serviceId))
  if (!taxonomyItem) throw new Error(`Missing service taxonomy for ${serviceId}`)
  return {
    _id: `service-${serviceId}`,
    _type: 'serviceDefinition',
    serviceId: Number(serviceId),
    name: value(row, 'name'),
    slug: {_type: 'slug', current: value(row, 'slug')},
    cluster: clusterRef(taxonomyItem.clusterSlug),
    scopeStatus: taxonomyItem.scopeStatus,
    scopeNote: taxonomyItem.scopeNote,
    parentName: value(row, 'parent_name'),
    parentUrl: value(row, 'parent_url'),
    hubUrl: value(row, 'hub_url'),
    primaryKeywords: keywords(value(row, 'kw_primary')),
    monthlySearchVolume: firstVolume(value(row, 'kw_volume')),
    searchVolumeSummary: value(row, 'kw_volume'),
    secondaryKeywords: keywords(value(row, 'kw_secondary')),
    h1Prefix: value(row, 'h1_prefix'),
    heroLede: value(row, 'hero_lede'),
    secondaryCta: value(row, 'cta_secondary'),
    issueQuestion: value(row, 'issue_question'),
    issueOptions: strings(value(row, 'issue_options')),
    typesHeading: value(row, 'types_heading'),
    typesLede: value(row, 'types_lede'),
    types: objects(value(row, 'types'), ['legacyIconSvg', 'name', 'description'], `type-${serviceId}`).map((item) => ({...item, _type: 'serviceType'})),
    typesFootnote: value(row, 'types_footnote'),
    brandsHeading: value(row, 'brands_heading'),
    brandsLede: value(row, 'brands_lede'),
    brands: strings(value(row, 'brands')),
    brandsNote: value(row, 'brands_note'),
    whyHeading: value(row, 'why_heading'),
    whyLede: value(row, 'why_lede'),
    whyItems: objects(value(row, 'why'), ['title', 'body'], `why-${serviceId}`).map((item) => ({...item, _type: 'titledBody'})),
    featuredCategory: {
      tag: value(row, 'feature_tag'),
      title: value(row, 'feature_title'),
      description: value(row, 'feature_desc'),
      cta: value(row, 'feature_cta'),
      url: value(row, 'feature_url'),
    },
    otherServices: objects(value(row, 'other_services'), ['name', 'description', 'url'], `other-${serviceId}`).map((item) => ({...item, _type: 'linkedService'})),
    pricing: {
      heading: value(row, 'pricing_heading'),
      lede: value(row, 'pricing_lede'),
      caption: value(row, 'pricing_caption'),
      column1: value(row, 'pricing_col_1'),
      column2: value(row, 'pricing_col_2'),
      column3: value(row, 'pricing_col_3'),
      rows: objects(value(row, 'pricing_rows'), ['job', 'driver', 'permit'], `price-${serviceId}`).map((item) => ({...item, _type: 'pricingRow'})),
      note: value(row, 'pricing_note'),
    },
    faqs: objects(value(row, 'faqs'), ['question', 'answer'], `faq-${serviceId}`).map((item) => ({...item, _type: 'faq'})),
    ctaHeading: value(row, 'cta_heading'),
    ctaBody: value(row, 'cta_body'),
  }
})

const seoTitleOverrides: Record<string, string> = {
  '310': 'Ductless Mini-Split Service in Chicago | City & Suburban',
  '315': 'Indoor Air Quality Services in Chicago | City & Suburban',
}

const buildPages = (assetRefs: Record<string, string>): ImportDocument[] => source.page.map((row) => {
  const serviceId = value(row, 'service_id')
  const slug = value(row, 'equipment_slug')
  const areaSlug = value(row, 'area_slug')
  const plan = serviceMedia.services[slug]
  const reviewItems = objects(value(row, 'reviews'), ['quote', 'author', 'date', 'sourceUrl', 'sourceId'], `review-${serviceId}`)
  if (reviewItems.some((review) => review.quote.trim().split(/\s+/).length > 14)) throw new Error(`Review excerpt exceeds 14 words for service ${serviceId}`)
  const reviews = reviewItems.map((item) => ({
    ...item,
    summary: reviewContexts[serviceId]?.[item.sourceId],
    _type: 'review',
    verifiedAt: '2026-08-31',
  }))
  if (reviews.some((review) => !review.summary)) throw new Error(`Missing review summary for service ${serviceId}`)

  return {
    _id: `drafts.servicePage-${serviceId}-${areaSlug}`,
    _type: 'servicePage',
    title: `${slug} — ${areaSlug}`,
    serviceId: Number(serviceId),
    service: {_type: 'reference', _ref: `service-${serviceId}`},
    area: {_type: 'reference', _ref: `area-${areaSlug}`},
    template: {_type: 'reference', _ref: 'servicePageTemplate-standard-v1'},
    seo: {
      title: seoTitleOverrides[serviceId] || value(row, 'meta_title'),
      description: value(row, 'meta_description'),
      canonicalUrl: value(row, 'canonical_url'),
    },
    trustMetrics: [1, 2, 4, 5].map((cell, index) => ({
      _key: key(`page-${serviceId}-metric`, index),
      _type: 'trustMetric',
      value: value(row, `trust_cell_${cell}_value`),
      label: value(row, `trust_cell_${cell}_label`),
    })),
    reviews,
    coverImage: plannedImage(plan.cover, `cover-${serviceId}`, assetRefs),
    gallery: plan.gallery.map((assetKey, index) => plannedImage(assetKey, key(`gallery-${serviceId}`, index), assetRefs)),
    workingPhotos: plan.workingPhotos.map((assetKey, index) => plannedImage(assetKey, key(`working-${serviceId}`, index), assetRefs)),
    guides: objects(value(row, 'guides'), ['title', 'legacyHtml'], `guide-${serviceId}`).map((item, index) => ({
      ...item,
      _type: 'guide',
      body: blocksFromHtml(item.legacyHtml, `guide-${serviceId}-${index}`),
    })),
    formSubtitle: value(row, 'form_subtitle'),
    formNote: value(row, 'form_note'),
    localFaqOverrides: [],
  }
})

function validateDocuments(services: ImportDocument[], pages: ImportDocument[]) {
  if (services.length !== 10 || pages.length !== 10) throw new Error('Expected ten service definitions and ten service pages')
  for (const page of pages) {
    const seo = page.seo as {title: string; description: string}
    if (seo.title.length > 75) throw new Error(`${page._id} meta title exceeds 75 characters`)
    if (seo.description.length > 170) throw new Error(`${page._id} meta description exceeds 170 characters`)
    if ((page.reviews as unknown[]).length !== 4) throw new Error(`${page._id} must have four reviews`)
    if ((page.trustMetrics as unknown[]).length !== 4) throw new Error(`${page._id} must have four trust metrics`)
    if ((page.guides as unknown[]).length !== 4) throw new Error(`${page._id} must have four guides`)
    if ((page.gallery as unknown[]).length !== 3 || (page.workingPhotos as unknown[]).length !== 3) throw new Error(`${page._id} must have three gallery and three working photos`)
  }
}

async function prepareAssets(dryRun: boolean): Promise<Record<string, string>> {
  if (dryRun) return Object.fromEntries([...requiredAssetKeys].map((assetKey) => [assetKey, `image-dry-run-${assetKey}`]))

  const filenames = [...requiredAssetKeys].map((assetKey) => path.basename(mediaAssets[assetKey].path))
  const existing = await client.fetch<Array<{_id: string; originalFilename: string}>>(
    `*[_type == "sanity.imageAsset" && originalFilename in $filenames]{_id, originalFilename}`,
    {filenames},
  )
  const existingByFilename = new Map(existing.map((asset) => [asset.originalFilename, asset._id]))
  const assetRefs: Record<string, string> = {}
  for (const assetKey of requiredAssetKeys) {
    const media = mediaAssets[assetKey]
    const filename = path.basename(media.path)
    const existingRef = existingByFilename.get(filename)
    if (existingRef) {
      assetRefs[assetKey] = existingRef
      console.log(`Reused media: ${assetKey}`)
      continue
    }
    const filePath = path.resolve(media.path)
    if (!fs.existsSync(filePath)) throw new Error(`Missing local media file: ${media.path}`)
    const uploaded = await client.assets.upload('image', fs.createReadStream(filePath), {filename, title: media.alt})
    assetRefs[assetKey] = uploaded._id
    console.log(`Uploaded media: ${assetKey}`)
  }
  return assetRefs
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const assetRefs = await prepareAssets(dryRun)
  const services = buildServices()
  const pages = buildPages(assetRefs)
  validateDocuments(services, pages)
  const documents = [...services, ...pages]
  const ids = documents.map((document) => document._id)
  if (
    new Set(ids).size !== 20
    || services.some((service) => service._id.startsWith('drafts.'))
    || pages.some((page) => !page._id.startsWith('drafts.'))
  ) throw new Error('Import must target ten published service definitions and ten draft service pages')

  const obsoleteServiceDraftIds = services.map((service) => `drafts.${service._id}`)

  if (dryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      projectId,
      dataset,
      documentCount: documents.length,
      publishedServiceDefinitions: services.length,
      draftServicePages: pages.length,
      obsoleteServiceDraftsRemoved: obsoleteServiceDraftIds.length,
      documents: pages.map((page) => ({
        _id: page._id,
        title: (page.seo as {title: string}).title,
        reviews: (page.reviews as unknown[]).length,
        gallery: (page.gallery as unknown[]).length,
        workingPhotos: (page.workingPhotos as unknown[]).length,
        guides: (page.guides as unknown[]).length,
      })),
    }, null, 2))
    return
  }

  let transaction = client.transaction()
  for (const document of documents) transaction = transaction.createOrReplace(document)
  for (const draftId of obsoleteServiceDraftIds) transaction = transaction.delete(draftId)
  const result = await transaction.commit({visibility: 'sync'})
  console.log(`Updated ${services.length} published service definitions and ${pages.length} draft service pages in transaction ${result.transactionId}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown Sanity draft import error')
  process.exit(1)
})
