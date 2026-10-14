// Name: apply-live-url-slugs
// What: Renames 8 service slugs, the air quality cluster slug, and moves Heat Pump
//       (305) into Cooling, so each new page lives at the exact URL of the live
//       WordPress page it replaces. 10 patches across 10 documents.
//       --revert does the exact opposite and restores the original slugs and clusters.
// Safe to re-run: yes. Documents already in the target state are skipped; any
//       document in an unexpected state aborts the whole run before writing.
//
// Usage:  npx tsx scripts/apply-live-url-slugs.ts                     (dry run, read only)
//         npx tsx scripts/apply-live-url-slugs.ts --apply             (writes, one transaction)
//         npx tsx scripts/apply-live-url-slugs.ts --revert            (dry run of the revert)
//         npx tsx scripts/apply-live-url-slugs.ts --revert --apply    (restores the original slugs)
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
const apply = process.argv.includes('--apply')
const revert = process.argv.includes('--revert')
const projectId = 'boolyxr0'
const dataset = 'production'
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN || process.env.SANITY_API_READ_TOKEN
if (!token) throw new Error('No Sanity token in .env.local')
if (apply && !(process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN)) throw new Error('--apply needs SANITY_API_WRITE_TOKEN')
const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

const EXPECTED_CLUSTERS_BEFORE = 'commercial-specialty, cooling, fireplace-chimney, heating, hvac-systems, indoor-air-quality-ventilation'
const EXPECTED_CLUSTERS_AFTER = 'air-quality, commercial-specialty, cooling, fireplace-chimney, heating, hvac-systems'

type Change = {id: string; field: 'slug.current' | 'cluster._ref'; from: string; to: string}
const FORWARD: Change[] = [
  {id: 'cluster-indoor-air-quality-ventilation', field: 'slug.current', from: 'indoor-air-quality-ventilation', to: 'air-quality'},
  {id: 'service-302', field: 'slug.current', from: 'air-conditioner-repair-installation', to: 'air-conditioning-installation'},
  {id: 'service-305', field: 'slug.current', from: 'heat-pump-repair-installation', to: 'heat-pump-services'},
  {id: 'service-305', field: 'cluster._ref', from: 'cluster-hvac-systems', to: 'cluster-cooling'},
  {id: 'service-306', field: 'slug.current', from: 'space-heater-repair-installation', to: 'heater-repair'},
  {id: 'service-307', field: 'slug.current', from: 'air-duct-cleaning-repair', to: 'duct-repair'},
  {id: 'service-308', field: 'slug.current', from: 'boiler-repair-installation', to: 'boiler-service'},
  {id: 'service-310', field: 'slug.current', from: 'ductless-mini-split-installation-repair', to: 'ductless-hvac-service'},
  {id: 'service-315', field: 'slug.current', from: 'indoor-air-quality-testing-installation', to: 'indoor-air-quality-test'},
  {id: 'service-320', field: 'slug.current', from: 'dehumidifier-installation-repair', to: 'dehumidifier-installation'},
]
const CHANGES: Change[] = revert ? FORWARD.map((change) => ({...change, from: change.to, to: change.from})) : FORWARD
const EXPECTED_AFTER = revert ? EXPECTED_CLUSTERS_BEFORE : EXPECTED_CLUSTERS_AFTER

const read = (field: Change['field'], doc: {slug?: {current?: string}; cluster?: {_ref?: string}} | null) =>
  field === 'slug.current' ? doc?.slug?.current : doc?.cluster?._ref

async function clusterList() {
  return client.fetch<string>(`array::join(*[_type == "serviceCluster" && !(_id in path("drafts.**"))] | order(slug.current asc).slug.current, ", ")`)
}

async function main() {
  // 1. Prove the target: only this project's production dataset has exactly these clusters.
  const before = await clusterList()
  console.log(`Target: project ${projectId}, dataset ${dataset}${revert ? '  (REVERT to original slugs)' : ''}`)
  console.log(`Clusters now: ${before}`)
  if (before !== EXPECTED_CLUSTERS_BEFORE && before !== EXPECTED_CLUSTERS_AFTER) throw new Error('Unexpected cluster set; refusing to continue')

  const ids = [...new Set(CHANGES.map((change) => change.id))]
  const docs = await client.fetch<Array<{_id: string; _rev: string; slug?: {current?: string}; cluster?: {_ref?: string}}>>(`*[_id in $ids]{_id, _rev, slug, cluster}`, {ids})
  const drafts = await client.fetch<number>(`count(*[_id in $ids])`, {ids: ids.map((id) => `drafts.${id}`)})
  if (drafts) throw new Error(`${drafts} draft(s) exist for these documents; publish or discard them first`)

  const pending: Change[] = []
  for (const change of CHANGES) {
    const current = read(change.field, docs.find((doc) => doc._id === change.id) || null)
    const state = current === change.to ? 'already done' : current === change.from ? 'will change' : `UNEXPECTED (${current})`
    console.log(`${change.id.padEnd(40)} ${change.field.padEnd(13)} ${change.from} -> ${change.to}   [${state}]`)
    if (state.startsWith('UNEXPECTED')) throw new Error(`Unexpected value on ${change.id}; nothing written`)
    if (state === 'will change') pending.push(change)
  }
  console.log(`${pending.length} of ${CHANGES.length} patches pending`)
  if (!apply) return console.log('Dry run only. Re-run with --apply to write.')
  if (!pending.length) return console.log('Nothing to write.')

  // 2. One transaction; each patch is pinned to the revision just read, so a concurrent edit aborts it.
  let tx = client.transaction()
  for (const id of new Set(pending.map((change) => change.id))) {
    const set = Object.fromEntries(pending.filter((change) => change.id === id).map((change) => [change.field, change.to]))
    tx = tx.patch(id, (patch) => patch.ifRevisionId(docs.find((doc) => doc._id === id)!._rev).set(set))
  }
  const result = await tx.commit({visibility: 'sync'})
  console.log(`Committed transaction ${result.transactionId}`)

  // 3. Verify with a fresh read.
  const after = await client.fetch<Array<{_id: string; slug?: {current?: string}; cluster?: {_ref?: string}}>>(`*[_id in $ids]{_id, slug, cluster}`, {ids})
  const wrong = CHANGES.filter((change) => read(change.field, after.find((doc) => doc._id === change.id) || null) !== change.to)
  if (wrong.length) throw new Error(`Verification failed for: ${wrong.map((change) => `${change.id} ${change.field}`).join(', ')}`)
  const finalClusters = await clusterList()
  if (finalClusters !== EXPECTED_AFTER) throw new Error(`Unexpected clusters after write: ${finalClusters}`)
  console.log(`Verified. Clusters now: ${finalClusters}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
