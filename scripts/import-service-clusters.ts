import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import {clusterRef} from './service-url-map'

type Cluster = {
  id: string
  name: string
  slug: string
  description: string
  displayOrder: number
  sourceServiceCount: number
  monthlySearchVolume: number
  chicagoSearchVolume: number
  serviceIds: number[]
  requiresScopeReview: boolean
  buildNote: string
}
type TaxonomyItem = {serviceId: number; clusterSlug: string; scopeStatus: string; scopeNote: string}

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

const clusterSource = JSON.parse(fs.readFileSync(path.resolve('data/service-clusters.json'), 'utf8')) as {clusters: Cluster[]}
const taxonomySource = JSON.parse(fs.readFileSync(path.resolve('data/service-taxonomy.json'), 'utf8')) as {services: TaxonomyItem[]}
const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const clusterSlugs = new Set(clusterSource.clusters.map((cluster) => cluster.slug))
  const invalidMappings = taxonomySource.services.filter((service) => !clusterSlugs.has(service.clusterSlug))
  if (invalidMappings.length) throw new Error(`Unknown cluster mappings: ${invalidMappings.map((item) => item.serviceId).join(', ')}`)

  const existingServices = await client.fetch<Array<{_id: string; serviceId: number}>>(
    `*[_type == "serviceDefinition" && serviceId in $serviceIds]{_id, serviceId}`,
    {serviceIds: taxonomySource.services.map((item) => item.serviceId)},
  )
  const taxonomyById = new Map(taxonomySource.services.map((item) => [item.serviceId, item]))
  const clusterDocuments = clusterSource.clusters.map((cluster) => ({
    _id: cluster.id,
    _type: 'serviceCluster',
    name: cluster.name,
    slug: {_type: 'slug', current: cluster.slug},
    description: cluster.description,
    displayOrder: cluster.displayOrder,
    sourceServiceCount: cluster.sourceServiceCount,
    monthlySearchVolume: cluster.monthlySearchVolume,
    chicagoSearchVolume: cluster.chicagoSearchVolume,
    serviceIds: cluster.serviceIds,
    requiresScopeReview: cluster.requiresScopeReview,
    buildNote: cluster.buildNote,
    active: true,
  }))

  if (dryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      projectId,
      dataset,
      clusters: clusterDocuments.map((cluster) => ({_id: cluster._id, name: cluster.name, serviceIds: cluster.serviceIds})),
      existingServicesToPatch: existingServices.map((service) => service.serviceId).sort((a, b) => a - b),
      futureServicesNotCreated: taxonomySource.services.filter((item) => !existingServices.some((service) => service.serviceId === item.serviceId)).map((item) => item.serviceId),
    }, null, 2))
    return
  }

  let transaction = client.transaction()
  for (const cluster of clusterDocuments) transaction = transaction.createOrReplace(cluster)
  for (const service of existingServices) {
    const taxonomy = taxonomyById.get(service.serviceId)
    if (!taxonomy) continue
    transaction = transaction.patch(service._id, (patch) => patch.set({
      cluster: clusterRef(taxonomy.clusterSlug),
      scopeStatus: taxonomy.scopeStatus,
      scopeNote: taxonomy.scopeNote,
    }))
  }
  const result = await transaction.commit({visibility: 'sync'})
  const verification = await client.fetch<{clusterCount: number; mappedServiceCount: number}>(`{
    "clusterCount": count(*[_type == "serviceCluster" && active != false]),
    "mappedServiceCount": count(*[_type == "serviceDefinition" && serviceId in $serviceIds && defined(cluster._ref)])
  }`, {serviceIds: existingServices.map((service) => service.serviceId)})
  if (verification.clusterCount !== clusterDocuments.length || verification.mappedServiceCount !== existingServices.length) {
    throw new Error(`Sanity verification failed: ${verification.clusterCount} clusters and ${verification.mappedServiceCount} mapped services found`)
  }
  console.log(`Imported and verified ${verification.clusterCount} clusters and ${verification.mappedServiceCount} existing service definitions in transaction ${result.transactionId}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown service-cluster import error')
  process.exit(1)
})
