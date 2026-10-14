// Remove the retired indexing field without changing page content or publication state.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('Missing Sanity write token')
const client = createClient({
  projectId: process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0',
  dataset: process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw',
})

type Document = {_id: string; _rev: string; [key: string]: unknown}
function preservedContent(document: Document) {
  return Object.fromEntries(Object.entries(document).filter(([key]) =>
    !['_rev', '_updatedAt', 'factChecksComplete'].includes(key)))
}

async function main() {
  const documents = await client.fetch<Document[]>('*[_type == "referenceServicePage" && defined(factChecksComplete)]')
  if (!documents.length) {
    console.log('No retired indexing fields remain in Sanity.')
    return
  }
  const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
  fs.mkdirSync(backupDirectory, {recursive: true})
  fs.writeFileSync(path.join(backupDirectory, `before-remove-indexing-field-${Date.now()}.json`), JSON.stringify(documents, null, 2))
  let transaction = client.transaction()
  for (const document of documents) {
    transaction = transaction.patch(document._id, patch => patch.ifRevisionId(document._rev).unset(['factChecksComplete']))
  }
  await transaction.commit()
  const verified = await client.fetch<Document[]>('*[_id in $ids]', {ids: documents.map(document => document._id)})
  assert.equal(verified.length, documents.length)
  for (const document of verified) {
    assert.ok(!Object.hasOwn(document, 'factChecksComplete'), `Retired field remains: ${document._id}`)
    assert.deepEqual(preservedContent(document), preservedContent(documents.find(original => original._id === document._id)!))
  }
  const remaining = await client.fetch<number>('count(*[_type == "referenceServicePage" && defined(factChecksComplete)])')
  assert.equal(remaining, 0)
  console.log(`Removed the indexing field from ${verified.length} Sanity documents; verified all other fields and publication states are unchanged.`)
}

main().catch(error => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1})
