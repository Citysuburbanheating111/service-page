// Apply only the requested card images and shared header, preserving all page edits.
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import catalog from '../src/reference-pages/catalog.json'
import retained from '../src/reference-pages/retained-catalog.json'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('Missing Sanity write token')
const client = createClient({projectId: 'boolyxr0', dataset: 'production', apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

async function main() {
  const pages = [...catalog, ...retained]
  const ids = pages.flatMap(page => [`reference-service-${page.clusterSlug}-${page.legacySlug}`, `drafts.reference-service-${page.clusterSlug}-${page.legacySlug}`])
  const documents = await client.fetch<Array<{_id: string; _rev: string; sections: Array<{module: string; _key: string; html: string}>; cardImageUrl?: string}>>('*[_id in $ids]', {ids})
  if (!documents.length) throw new Error('No matching Sanity documents')
  const backup = path.resolve('..', '.reference-preview', 'sanity-backups', `before-card-navigation-${Date.now()}.json`)
  fs.writeFileSync(backup, JSON.stringify(documents, null, 2))
  let updated = 0
  for (const doc of documents) {
    const page = pages.find(page => doc._id.replace(/^drafts\./, '') === `reference-service-${page.clusterSlug}-${page.legacySlug}`)!
    const snapshot = JSON.parse(fs.readFileSync(`src/reference-pages/${page.referenceFile}`, 'utf8'))
    const shared = snapshot.sections.find((section: {module: string}) => section.module === 'site-header')
    const section = doc.sections.find(section => section.module === 'site-header')
    if (doc.cardImageUrl === page.cardImage && section?.html === shared.html) continue
    let patch = client.patch(doc._id).ifRevisionId(doc._rev).set({cardImageUrl: page.cardImage})
    if (section) patch = patch.set({[`sections[_key=="${section._key}"].html`]: shared.html, [`sections[_key=="${section._key}"].contentFields`]: []})
    await patch.commit()
    updated++
  }
  const verified = await client.fetch<typeof documents>('*[_id in $ids]', {ids})
  for (const doc of verified) {
    const page = pages.find(page => doc._id.replace(/^drafts\./, '') === `reference-service-${page.clusterSlug}-${page.legacySlug}`)!
    if (doc.cardImageUrl !== page.cardImage ||
      !doc.sections.find(section => section.module === 'site-header')?.html.includes('site-submenu')) throw new Error(`Verification failed: ${doc._id}`)
  }
  console.log(`Updated and verified ${updated} Sanity documents; existing page content preserved.`)
}
main().catch(error => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1})
