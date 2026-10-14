/** Refresh only footer fields/CSS; preserve all other Sanity content and publish state. */
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import catalog from '../src/reference-pages/catalog.json'
import retained from '../src/reference-pages/retained-catalog.json'
import footer from '../src/reference-pages/shared-footer.json'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('Sanity write token required')
const client = createClient({projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production', apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})
type Section = {_key: string; module: string; html: string; [key: string]: unknown}
type Document = {_id: string; _type: string; _rev: string; _createdAt?: string; _updatedAt?: string; sections?: Section[]; responsiveCss?: string; [key: string]: unknown}
const marker = '\n/* Live WordPress footer */\n'
const css = (original = '') => original.split(marker)[0] + marker + footer.style

async function main() {
  const pages = [...catalog, ...retained]
  const ids = [...pages.map(p => `reference-service-${p.clusterSlug}-${p.legacySlug}`), 'servicePageTemplate-standard-v1']
  const docs = await client.fetch<Document[]>('*[_id in $ids]', {ids: ids.flatMap(id => [id, `drafts.${id}`])})
  const directory = path.resolve('..', '.reference-preview', 'sanity-backups')
  fs.mkdirSync(directory, {recursive: true})
  fs.writeFileSync(path.join(directory, `before-live-footer-${Date.now()}.json`), JSON.stringify(docs, null, 2))
  for (const id of ids) {
    let doc = docs.find(d => d._id === `drafts.${id}`) || docs.find(d => d._id === id)
    if (!doc) throw new Error(`Missing Sanity document: ${id}`)
    if (!doc._id.startsWith('drafts.')) {
      const {_rev, _createdAt, _updatedAt, ...content} = doc
      void _rev; void _createdAt; void _updatedAt
      await client.createIfNotExists({...content, _id: `drafts.${id}`})
      doc = (await client.getDocument<Document>(`drafts.${id}`))!
    }
    const patch = client.patch(doc._id).ifRevisionId(doc._rev).set({responsiveCss: css(doc.responsiveCss)})
    if (id !== 'servicePageTemplate-standard-v1') {
      const index = doc.sections?.findIndex(s => s.module === 'site-footer') ?? -1
      if (index < 0) throw new Error(`Missing footer: ${id}`)
      const page = pages.find(p => `reference-service-${p.clusterSlug}-${p.legacySlug}` === id)!
      const snapshot = JSON.parse(fs.readFileSync(path.join('src/reference-pages', page.referenceFile), 'utf8'))
      const section = snapshot.sections.find((s: Section) => s.module === 'site-footer')
      patch.set({[`sections[${index}]`]: {...section, _key: doc.sections![index]._key, _type: 'referencePageSection',
        contentFields: section.contentFields.map((field: object) => ({...field, _type: 'referenceContentField'}))}})
    }
    await patch.commit()
  }
  const saved = await client.fetch<Document[]>('*[_id in $ids]', {ids: ids.map(id => `drafts.${id}`)})
  if (saved.length !== ids.length || saved.some(doc => !doc.responsiveCss?.endsWith(footer.style))) throw new Error('Footer CSS verification failed')
  for (const doc of saved.filter(d => d.sections)) {
    const section = doc.sections!.find(s => s.module === 'site-footer')
    if (!section?.html.includes('id="live-site-footer"') || !section.html.includes('/services/images/live-footer-logo.png')) throw new Error(`Footer verification failed: ${doc._id}`)
  }
  console.log(`Updated and verified only the footer in ${pages.length} Sanity drafts and the shared standard template.`)
}
main().catch(error => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1})
