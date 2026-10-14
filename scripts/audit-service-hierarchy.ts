import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

type ClusterSource = {clusters: Array<{id: string; slug: string; serviceIds: number[]}>}
type TaxonomySource = {services: Array<{serviceId: number; slug: string; clusterSlug: string; scopeStatus: string}>}
type ClusterDocument = {_id: string; slug?: string; serviceIds?: number[]}
type ServiceDocument = {_id: string; serviceId: number; slug?: string; clusterRef?: string; scopeStatus?: string}
type PageDocument = {
  _id: string
  serviceId: number
  serviceRef?: string
  serviceRefIsWeak?: boolean
  areaRef?: string
  areaRefIsWeak?: boolean
  areaSlug?: string
  templateRef?: string
  templateRefIsWeak?: boolean
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as T
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
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('Add a Sanity Viewer token to SANITY_API_READ_TOKEN in .env.local')

const clusterSource = readJson<ClusterSource>('data/service-clusters.json')
const taxonomySource = readJson<TaxonomySource>('data/service-taxonomy.json')
const ids = taxonomySource.services.map((service) => service.serviceId)
const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

async function main() {
  const [clusters, services, pages] = await Promise.all([
    client.fetch<ClusterDocument[]>(`*[_type == "serviceCluster" && _id in $ids]{_id, "slug": slug.current, serviceIds}`, {ids: clusterSource.clusters.map((cluster) => cluster.id)}),
    client.fetch<ServiceDocument[]>(`*[_type == "serviceDefinition" && serviceId in $ids]{_id, serviceId, "slug": slug.current, "clusterRef": cluster._ref, scopeStatus}`, {ids}),
    client.fetch<PageDocument[]>(`*[_type == "servicePage" && serviceId in $ids]{
      _id, serviceId,
      "serviceRef": service._ref, "serviceRefIsWeak": service._weak == true,
      "areaRef": area._ref, "areaRefIsWeak": area._weak == true, "areaSlug": area->slug.current,
      "templateRef": template._ref, "templateRefIsWeak": template._weak == true
    }`, {ids}),
  ])

  assert.equal(clusters.length, 6, 'Sanity must contain the six published cluster documents')
  assert.equal(services.length, 25, 'Sanity must contain the 25 published service definitions')
  assert.equal(pages.length, 25, 'Sanity must contain exactly one page document for each service ID')

  const clusterById = new Map(clusters.map((cluster) => [cluster._id, cluster]))
  for (const expected of clusterSource.clusters) {
    const actual = clusterById.get(expected.id)
    assert.ok(actual, `Sanity cluster ${expected.id} is missing`)
    assert.equal(actual.slug, expected.slug, `Sanity cluster ${expected.id} has the wrong slug`)
    assert.deepEqual([...(actual.serviceIds || [])].sort((a, b) => a - b), [...expected.serviceIds].sort((a, b) => a - b), `Sanity cluster ${expected.id} has the wrong service ID list`)
  }

  const serviceById = new Map(services.map((service) => [service.serviceId, service]))
  for (const expected of taxonomySource.services) {
    const actual = serviceById.get(expected.serviceId)
    assert.ok(actual, `Sanity service ${expected.serviceId} is missing`)
    assert.equal(actual._id, `service-${expected.serviceId}`, `Sanity service ${expected.serviceId} must be published and use its stable ID`)
    assert.equal(actual.slug, expected.slug, `Sanity service ${expected.serviceId} has the wrong slug`)
    assert.equal(actual.clusterRef, `cluster-${expected.clusterSlug}`, `Sanity service ${expected.serviceId} has the wrong cluster reference`)
    assert.equal(actual.scopeStatus, expected.scopeStatus, `Sanity service ${expected.serviceId} has the wrong scope status`)
  }

  for (const page of pages) {
    const stablePageId = `servicePage-${page.serviceId}-chicago`
    assert.ok(page._id === stablePageId || page._id === `drafts.${stablePageId}`, `service page ${page.serviceId} has an unexpected document ID`)
    assert.equal(page.serviceRef, `service-${page.serviceId}`, `service page ${page.serviceId} has the wrong service reference`)
    assert.equal(page.serviceRefIsWeak, false, `service page ${page.serviceId} has a weak service reference`)
    assert.equal(page.areaRef, 'area-chicago', `service page ${page.serviceId} has the wrong area reference`)
    assert.equal(page.areaRefIsWeak, false, `service page ${page.serviceId} has a weak area reference`)
    assert.equal(page.areaSlug, 'chicago', `service page ${page.serviceId} does not resolve to Chicago`)
    assert.equal(page.templateRef, 'servicePageTemplate-standard-v1', `service page ${page.serviceId} has the wrong standard-template reference`)
    assert.equal(page.templateRefIsWeak, false, `service page ${page.serviceId} has a weak template reference`)
  }

  const publishedPages = pages.filter((page) => !page._id.startsWith('drafts.')).length
  const draftPages = pages.length - publishedPages
  console.log(JSON.stringify({
    projectId,
    dataset,
    clusters: clusters.length,
    services: services.length,
    pages: pages.length,
    publishedPages,
    draftPages,
    clusterMembership: clusterSource.clusters.map((cluster) => ({slug: cluster.slug, serviceIds: cluster.serviceIds})),
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
