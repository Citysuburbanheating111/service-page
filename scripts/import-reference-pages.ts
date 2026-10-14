/** Seed drafts; --refresh-design applies an explicitly requested reference update. */
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import catalog from '../src/reference-pages/catalog.json'
import retainedCatalog from '../src/reference-pages/retained-catalog.json'
import migrations from '../data/service-url-migrations.json'

type CatalogItem = (typeof catalog)[number] & {
  directoryClusterSlug?: string; keyPhrases?: string[]; sourcePageId?: string; scopeStatus?: string
}
const allCatalog: CatalogItem[] = [...catalog, ...retainedCatalog]

const localEnv = path.resolve('.env.local')
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('A Sanity write token is required in .env.local')
const client = createClient({
  projectId: process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0',
  dataset: process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw',
})

type Snapshot = {style: string; schema: string; sections: Array<{_key: string; module: string; html: string; contentFields?: Array<{_key: string; target: string; kind: string; label: string; value: string}>}>}
type KeywordRow = {slug?: string; kw_primary?: string; kw_secondary?: string}
const keywordRows = ['source-content.json', 'source-content-306-315.json', 'source-content-316-325.json']
  .flatMap((file) => (JSON.parse(fs.readFileSync(path.resolve('data', file), 'utf8')) as {equip: KeywordRow[]}).equip)
const keywordBySlug = new Map(keywordRows.map((row) => [row.slug, row]))
const keywordSource: Record<string, string> = {
  'ac-installation': 'air-conditioner-repair-installation', 'ac-maintenance': 'air-conditioner-repair-installation',
  'ac-repair': 'air-conditioner-repair-installation', 'cooling-maintenance-plans': 'air-conditioner-repair-installation',
  'ductless-hvac': 'ductless-mini-split-installation-repair', 'heat-pump-services': 'heat-pump-repair-installation',
  'heating-repair': 'furnace-repair-installation', 'heating-installation': 'furnace-repair-installation',
  'heating-maintenance': 'furnace-repair-installation', 'heat-pumps': 'heat-pump-repair-installation',
  'boiler-services': 'boiler-repair-installation', 'hybrid-heating': 'hvac-repair-installation',
  'maintenance-plans': 'hvac-repair-installation',
  'dehumidifier-installation': 'dehumidifier-installation-repair',
  'duct-maintenance': 'air-duct-cleaning-repair', 'duct-repair': 'air-duct-cleaning-repair',
  'humidifier-air-cleaner': 'humidifier-installation-repair',
  'indoor-air-quality-test': 'indoor-air-quality-testing-installation',
  'ductwork-design-repair-services': 'air-duct-cleaning-repair',
}

function phrases(slug: string, name: string) {
  const source = keywordBySlug.get(keywordSource[slug] || 'hvac-repair-installation')
  return [...new Set([name.toLowerCase(), ...[source?.kw_primary, source?.kw_secondary].filter(Boolean).flatMap((item) => String(item).split('||'))
    .map((item) => item.trim().toLowerCase()).filter(Boolean)])].slice(0, 12)
}

async function main() {
  const refresh = process.argv.includes('--refresh-design')
  let created = 0
  let refreshed = 0
  const ids = allCatalog.map((item) => `drafts.reference-service-${item.clusterSlug}-${item.legacySlug}`)
  const existingDocs = await client.fetch<Array<{_id: string; _rev: string; keyPhrases?: string[]; [key: string]: unknown}>>('*[_id in $ids]', {ids})
  if (refresh && existingDocs.length) {
    const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
    fs.mkdirSync(backupDirectory, {recursive: true})
    fs.writeFileSync(path.join(backupDirectory, `before-design-refresh-${Date.now()}.json`), JSON.stringify(existingDocs, null, 2))
  }
  const sourceDocuments = fs.existsSync(path.resolve('..', '.reference-preview', 'existing-service-content.json'))
    ? JSON.parse(fs.readFileSync(path.resolve('..', '.reference-preview', 'existing-service-content.json'), 'utf8')) as Array<{_type: string; slug?: {current?: string}; primaryKeywords?: string[]; secondaryKeywords?: string[]}>
    : []
  for (const item of allCatalog) {
    const snapshot = JSON.parse(fs.readFileSync(path.resolve('src/reference-pages', item.referenceFile), 'utf8')) as Snapshot
    const id = `drafts.reference-service-${item.clusterSlug}-${item.legacySlug}`
    const existing = existingDocs.find((document) => document._id === id)
    if (existing && !refresh) continue
    const matchingResearch = sourceDocuments.filter((doc) => doc._type === 'serviceDefinition' &&
      (doc.slug?.current === item.slug || (migrations.overlaps as Record<string, string>)[doc.slug?.current || ''] === item.livePath))
      .flatMap((doc) => [...(doc.primaryKeywords || []), ...(doc.secondaryKeywords || [])])
    const fields = {
      name: item.name, clusterSlug: item.clusterSlug, slug: {_type: 'slug', current: item.slug},
      directoryClusterSlug: item.directoryClusterSlug || item.clusterSlug,
      template: {_type: 'reference', _ref: 'servicePageTemplate-standard-v1'},
      cardImageUrl: item.cardImage, cardDescription: item.description,
      livePath: item.livePath, metaTitle: item.title, metaDescription: item.description, canonicalUrl: item.canonicalUrl,
      keyPhrases: [...new Set([item.name.toLowerCase(), item.h1.toLowerCase(), item.slug.replaceAll('-', ' '),
        ...phrases(item.legacySlug, item.name), ...matchingResearch,
        ...(item.keyPhrases || []), ...(existing?.keyPhrases || [])])],
      ...(item.previewUrl ? {previewUrl: item.previewUrl} : {}), qcStatus: item.qcStatus, photoStatus: item.photoStatus,
      ...(item.sourcePageId ? {sourcePage: {_type: 'reference', _ref: item.sourcePageId, _weak: true}, scopeStatus: item.scopeStatus} : {}),
      responsiveCss: snapshot.style, structuredData: snapshot.schema,
      sections: snapshot.sections.map((section) => ({...section, _type: 'referencePageSection', contentFields: section.contentFields?.map((field) => ({...field, _type: 'referenceContentField'}))})),
    }
    if (existing) {
      await client.patch(id).ifRevisionId(existing._rev).set(fields).commit()
      refreshed++
    } else {
      await client.createIfNotExists({_id: id, _type: 'referenceServicePage', ...fields})
      created++
    }
  }
  const templateId = 'drafts.servicePageTemplate-standard-v1'
  const existingTemplate = await client.getDocument(templateId) || await client.getDocument('servicePageTemplate-standard-v1')
  const standard = JSON.parse(fs.readFileSync(path.resolve('src/reference-pages/heating--heater-repair.json'), 'utf8')) as Snapshot
  if (refresh && existingTemplate) {
    const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
    fs.mkdirSync(backupDirectory, {recursive: true})
    fs.writeFileSync(path.join(backupDirectory, `before-standard-template-refresh-${Date.now()}.json`), JSON.stringify(existingTemplate, null, 2))
    if (existingTemplate._id !== templateId) {
      const {_rev, _createdAt, _updatedAt, ...original} = existingTemplate
      void _rev; void _createdAt; void _updatedAt
      await client.createIfNotExists({...original, _id: templateId})
    }
    await client.patch(templateId).set({name: 'Standard service landing page · finalized October design',
      version: '2.0.0', designVersion: 'october-2026', responsiveCss: standard.style,
      sectionOrder: standard.sections.map((section) => section.module), active: true}).commit()
  }
  const updated = await client.fetch<Array<{_id: string; livePath: string; slug: string; canonicalUrl: string; name: string; sectionCount: number; fieldCount: number; structuredData: string}>>(
    '*[_id in $ids]{_id,livePath,"slug":slug.current,canonicalUrl,name,"sectionCount":count(sections),"fieldCount":count(sections[].contentFields[]),structuredData}', {ids})
  for (const item of allCatalog) {
    const snapshot = JSON.parse(fs.readFileSync(path.resolve('src/reference-pages', item.referenceFile), 'utf8')) as Snapshot
    if (!updated.some((doc) => doc.livePath === item.livePath && doc.slug === item.slug && doc.name === item.name && doc.canonicalUrl === item.canonicalUrl &&
      doc.sectionCount === snapshot.sections.length && doc.fieldCount === snapshot.sections.reduce((count, section) => count + (section.contentFields?.length || 0), 0) && doc.structuredData === snapshot.schema)) {
      throw new Error(`Draft URL/name verification failed for ${item.livePath}`)
    }
  }
  console.log(`Created ${created}; refreshed ${refreshed}; verified all ${updated.length} Sanity drafts: URLs, names, design sections, native fields and JSON-LD.`)
}

main().catch((error) => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1})
