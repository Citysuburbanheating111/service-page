/** Migrate URL fields in drafts only; preserve copy, keywords and approval flags. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createClient} from 'next-sanity'
import {migrateServiceContent} from '../src/lib/service-base-path'
import catalog from '../src/reference-pages/catalog.json'
import retained from '../src/reference-pages/retained-catalog.json'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('Missing Sanity write token')
const client = createClient({projectId: process.env.NEXT_SANITY_PROJECT_ID || 'boolyxr0', dataset: process.env.NEXT_SANITY_DATASET || 'production', apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})
type Document = {_id: string; _rev: string; _type: string; [key: string]: unknown}
const fields = ['livePath', 'canonicalUrl', 'cardImageUrl', 'responsiveCss', 'structuredData', 'sections']
async function main() {
  const pages = [...catalog, ...retained]
  const ids = [...pages.map(page => `reference-service-${page.clusterSlug}-${page.legacySlug}`), 'servicePageTemplate-standard-v1']
  const documents = await client.fetch<Document[]>('*[_id in $ids || _id in $draftIds]', {ids, draftIds: ids.map(id => `drafts.${id}`)})
  const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
  fs.mkdirSync(backupDirectory, {recursive: true})
  fs.writeFileSync(path.join(backupDirectory, `before-services-base-path-${Date.now()}.json`), JSON.stringify(documents, null, 2))
  let changed = 0
  for (const id of ids) {
    let original = documents.find(doc => doc._id === `drafts.${id}`) || documents.find(doc => doc._id === id)
    if (!original) throw new Error(`Missing document ${id}`)
    const current = Object.fromEntries(fields.filter(field => original![field] !== undefined).map(field => [field, original![field]]))
    const updated = migrateServiceContent(current)
    if (JSON.stringify(current) === JSON.stringify(updated)) continue
    if (!original._id.startsWith('drafts.')) {
      const {_rev, _createdAt, _updatedAt, ...source} = original
      void _rev; void _createdAt; void _updatedAt
      original = await client.createIfNotExists({...source, _id: `drafts.${id}`}) as Document
    }
    const saved = await client.patch(original._id).ifRevisionId(original._rev).set(updated).commit() as Document
    // All fields outside the URL/design payload must remain byte-for-byte unchanged.
    for (const [key, value] of Object.entries(original)) {
      if (!fields.includes(key) && !['_rev', '_updatedAt'].includes(key)) assert.deepEqual(saved[key], value, `Unexpected change: ${id}/${key}`)
    }
    changed++
  }
  const saved = await client.fetch<Document[]>('*[_id in $ids]', {ids: ids.map(id => `drafts.${id}`)})
  for (const page of pages) {
    const doc = saved.find(item => item._id === `drafts.reference-service-${page.clusterSlug}-${page.legacySlug}`)
    assert.ok(doc)
    assert.equal(doc.livePath, page.livePath)
    assert.equal(doc.canonicalUrl, page.canonicalUrl)
    assert.ok(!/\/service\//.test(JSON.stringify(Object.fromEntries(fields.map(field => [field, doc[field]])))), `Old base path remains: ${page.livePath}`)
  }
  console.log(`Migrated ${changed} drafts; verified all 41 landing URLs, canonicals and design fields. Approval flags and content preserved. Nothing published.`)
}
main().catch(error => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1})
