import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

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
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('Sanity token is missing')

const batch = process.argv.find((argument) => argument.startsWith('--batch='))?.split('=')[1] || '306-315'
const startId = batch === '316-325' ? 316 : batch === '306-315' ? 306 : Number.NaN
if (!Number.isFinite(startId)) throw new Error(`Unsupported batch: ${batch}`)
const ids = Array.from({length: 10}, (_, index) => startId + index)
const existingIds = ids.flatMap((id) => [
  `service-${id}`,
  `drafts.service-${id}`,
  `servicePage-${id}-chicago`,
  `drafts.servicePage-${id}-chicago`,
])

const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

async function main() {
const documents = await client.fetch(`*[_id in $ids]{
  _id, _type, _rev, serviceId, name, title,
  "slug": slug.current,
  scopeStatus, scopeNote,
  "clusterRef": cluster._ref,
  "heroLedeLength": length(heroLede),
  "brandCount": count(brands),
  "typeCount": count(types),
  "whyItemCount": count(whyItems),
  "pricingRowCount": count(pricing.rows),
  "serviceFaqCount": count(faqs),
  "serviceRef": service._ref,
  "serviceRefIsWeak": service._weak == true,
  "areaRef": area._ref,
  "templateRef": template._ref,
  "reviewCount": count(reviews),
  "trustMetricCount": count(trustMetrics),
  "guideCount": count(guides),
  "galleryCount": count(gallery),
  "workingPhotoCount": count(workingPhotos),
  "hasCoverImage": defined(coverImage.image.asset) || defined(coverImage.externalUrl),
  "coverAssetRef": coverImage.image.asset._ref,
  "galleryAssetRefs": gallery[].image.asset._ref,
  "workingPhotoAssetRefs": workingPhotos[].image.asset._ref,
  "hasFormCopy": defined(formSubtitle) && defined(formNote),
  "metaTitleLength": length(seo.title),
  "metaDescriptionLength": length(seo.description)
} | order(serviceId asc, _id asc)`, {ids: existingIds})

const baseline = await client.fetch(`*[_id in $ids]{_id, _rev} | order(_id asc)`, {
  ids: Array.from({length: 5}, (_, index) => 301 + index).flatMap((id) => [`service-${id}`, `servicePage-${id}-chicago`]),
})

const serviceDefinitions = documents.filter((document: {_type: string}) => document._type === 'serviceDefinition')
const servicePages = documents.filter((document: {_type: string}) => document._type === 'servicePage')
if (serviceDefinitions.length !== 10 || serviceDefinitions.some((document: {_id: string}) => document._id.startsWith('drafts.'))) {
  throw new Error('Expected ten published service definitions and no draft service-definition duplicates')
}
if (serviceDefinitions.some((document: {clusterRef?: string; scopeStatus?: string}) => !document.clusterRef || !document.scopeStatus)) {
  throw new Error('Expected every service definition to have a cluster and scope status')
}
if (serviceDefinitions.some((document: {heroLedeLength?: number; brandCount?: number; typeCount?: number; whyItemCount?: number; pricingRowCount?: number; serviceFaqCount?: number}) =>
  !document.heroLedeLength || document.heroLedeLength < 150
  || (document.brandCount || 0) < 6
  || (document.typeCount || 0) < 6
  || (document.whyItemCount || 0) < 6
  || (document.pricingRowCount || 0) < 4
  || (document.serviceFaqCount || 0) < 6
)) {
  throw new Error('One or more service definitions are missing mapped landing-page content')
}
if (servicePages.length !== 10 || servicePages.some((document: {_id: string; serviceRefIsWeak: boolean}) => !document._id.startsWith('drafts.') || document.serviceRefIsWeak)) {
  throw new Error('Expected ten draft service pages with strong service references')
}
if (servicePages.some((document: {coverAssetRef?: string; galleryAssetRefs?: string[]; workingPhotoAssetRefs?: string[]}) =>
  !document.coverAssetRef
  || document.galleryAssetRefs?.length !== 3
  || document.galleryAssetRefs.some((asset) => !asset)
  || document.workingPhotoAssetRefs?.length !== 3
  || document.workingPhotoAssetRefs.some((asset) => !asset)
)) {
  throw new Error('One or more service pages are missing resolved Sanity image asset references')
}

console.log(JSON.stringify({projectId, dataset, documents, publishedBaseline301To305: baseline}, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown Sanity audit error')
  process.exit(1)
})
