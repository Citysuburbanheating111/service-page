// Splits the furnace copy away from the three heater URLs (28 Oct 2026).
// On 22 Oct the Heater Repair, Heater Installation and Heater Maintenance documents were rewritten with
// furnace copy, so /services/heating/heater-*-near-me/ showed furnace pages. This script:
// 1. creates Furnace Repair, Furnace Installation and Furnace Maintenance pages at
//    /services/heating/furnace-*-near-me/ from the current (furnace) documents, with their self URL,
//    JSON-LD and the FAQ links between the three furnace pages moved to the furnace URLs;
// 2. restores the heater copy published on 20 Oct to the three heater documents, with the changes every
//    page received since then: the "-near-me" URLs, the current site header and a Work We Handle strip
//    (the heater strips from src/data/work-we-handle.json).
// Dry run by default. --write saves drafts (backup first); --publish then publishes those six drafts.
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import workItems from '../src/data/work-we-handle.json'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (match) process.env[match[1]] ||= match[2].replace(/^['"]|['"]$/g, '')
}
const write = process.argv.includes('--write')
const publish = process.argv.includes('--publish')
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('Add a Sanity Editor token to SANITY_API_WRITE_TOKEN in .env.local')
const PROJECT = 'boolyxr0', DATASET = 'production', SITE = 'https://citysuburbanheating.com'
const client = createClient({projectId: PROJECT, dataset: DATASET, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

type Field = {kind: string; value: string; [key: string]: unknown}
type Section = {module: string; html: string; contentFields?: Field[]; [key: string]: unknown}
type Doc = {_id: string; _rev?: string; _type: string; slug: {_type?: string; current: string}; name: string; livePath: string; canonicalUrl: string; structuredData: string; sections: Section[]; workWeHandle?: unknown[]; [key: string]: unknown}

const services = ['repair', 'installation', 'maintenance'] as const
// The heater copy as published on 20 Oct 2026, before the furnace rewrite (Sanity history revisions).
const heaterRevision: Record<(typeof services)[number], string> = {
  repair: 'PT0Z0fhD72TdeKdiN1ITyc',
  installation: 'OJlbDBzLZ7NM7c3sgLrsaL',
  maintenance: 'OJlbDBzLZ7NM7c3sgLruc9',
}
const heaterId = (service: string) => `reference-service-heating-heating-${service}`
const furnaceId = (service: string) => `reference-service-heating-furnace-${service}`
const heaterPath = (service: string) => `/services/heating/heater-${service}-near-me/`
const furnacePath = (service: string) => `/services/heating/furnace-${service}-near-me/`

const nearMe = JSON.parse(fs.readFileSync('data/service-url-near-me.json', 'utf8')) as Record<string, string>
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Replaces each from → to path, matched with or without its trailing slash, only as a whole path. */
function replacePaths(text: string, map: Record<string, string>): [string, number] {
  let count = 0
  for (const [from, to] of Object.entries(map)) {
    const re = new RegExp(`${escapeRegExp(from.slice(0, -1))}(/?)(?=[\\\\"'#?\\s<)\\]]|$)`, 'g')
    text = text.replace(re, (_match, slash: string) => { count++; return to.slice(0, -1) + slash })
  }
  return [text, count]
}
/** Applies replacePaths to every section except the shared site header, plus the JSON-LD. */
function rewriteContent(doc: Doc, map: Record<string, string>) {
  let links = 0
  const sections = doc.sections.map((section) => {
    if (section.module === 'site-header') return section
    const [html, n] = replacePaths(section.html, map)
    links += n
    const contentFields = section.contentFields?.map((field) => {
      if (field.kind === 'image') return field
      const [value, m] = replacePaths(field.value || '', map)
      links += m
      return m ? {...field, value} : field
    })
    return {...section, html, ...(contentFields ? {contentFields} : {})}
  })
  const [structuredData, s] = replacePaths(doc.structuredData || '', map)
  return {sections, structuredData, links: links + s}
}
const strip = (key: string) => {
  const items = (workItems as Record<string, Array<{title: string; text: string; icon: string}>>)[key]
  if (!items || items.length !== 7) throw new Error(`src/data/work-we-handle.json: ${key} needs exactly 7 items`)
  return items.map((item, index) => ({_key: `work-${index + 1}`, _type: 'workItem', icon: item.icon, text: item.text, title: item.title}))
}
const visibleWords = (doc: Pick<Doc, 'sections'>, word: RegExp) =>
  doc.sections.map((s) => s.html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).join(' ').match(word)?.length || 0

async function historicalRevision(id: string, revision: string): Promise<Doc> {
  const response = await fetch(`https://${PROJECT}.api.sanity.io/v2021-06-07/data/history/${DATASET}/documents/${id}?revision=${revision}`, {headers: {authorization: `Bearer ${token}`}})
  const doc = (await response.json() as {documents?: Doc[]}).documents?.[0]
  if (!response.ok || !doc) throw new Error(`${id}: revision ${revision} not found (${response.status})`)
  return doc
}

async function main() {
  const ids = services.flatMap((service) => [heaterId(service), furnaceId(service)])
  const existing = await client.fetch<Doc[]>('*[_id in $ids || _id in $drafts]', {ids, drafts: ids.map((id) => `drafts.${id}`)})
  const taken = await client.fetch<string[]>('*[_type == "referenceServicePage" && livePath in $paths && !(_id in $ids)]._id', {paths: services.map(furnacePath), ids: ids.flatMap((id) => [id, `drafts.${id}`])})
  if (taken.length) throw new Error(`A furnace URL is already used by ${taken.join(', ')}`)

  if (publish) {
    for (const id of ids) {
      const draft = existing.find((doc) => doc._id === `drafts.${id}`)
      if (!draft) throw new Error(`${id}: no draft to publish; run --write first`)
      const {_rev, _createdAt, _updatedAt, ...body} = draft
      void _rev; void _createdAt; void _updatedAt
      // One document per transaction: the Sanity request limit is 4 MB.
      await client.transaction().createOrReplace({...body, _id: id} as Doc).delete(draft._id).commit()
      console.log(`PUBLISHED ${id} → ${draft.livePath}`)
    }
    return
  }

  const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
  const backup = path.join(backupDirectory, `before-split-furnace-heater-${Date.now()}.json`)
  const changes: Doc[] = []
  for (const service of services) {
    const current = existing.find((doc) => doc._id === heaterId(service))
    if (!current) throw new Error(`${heaterId(service)} is not published`)
    if (existing.some((doc) => doc._id === `drafts.${heaterId(service)}` || doc._id.endsWith(furnaceId(service)))) {
      throw new Error(`${service}: a draft or furnace page already exists; review it in the Studio before running again`)
    }
    if (current.livePath !== heaterPath(service) || !/^Furnace /.test(current.name)) throw new Error(`${current._id}: expected the furnace copy at ${heaterPath(service)}, found "${current.name}" at ${current.livePath}`)

    // 1. Furnace page: today's document, moved to its own URL. FAQ links between the furnace pages follow.
    const toFurnace = Object.fromEntries(services.map((s) => [heaterPath(s), furnacePath(s)]))
    const furnaceContent = rewriteContent(current, toFurnace)
    const {_rev, _createdAt, _updatedAt, ...currentBody} = current
    void _rev; void _createdAt; void _updatedAt
    const furnace = {
      ...currentBody,
      ...furnaceContent,
      _id: `drafts.${furnaceId(service)}`,
      slug: {_type: 'slug', current: `furnace-${service}-near-me`},
      livePath: furnacePath(service),
      canonicalUrl: `${SITE}${furnacePath(service)}`,
      workWeHandle: strip(`heating/furnace-${service}-near-me`),
    } as Doc
    delete furnace.links
    delete furnace.previewUrl

    // 2. Heater page: the 20 Oct heater copy with the near-me URLs, the current header and a heater strip.
    const old = await historicalRevision(heaterId(service), heaterRevision[service])
    if (!/^Heater /i.test(old.name)) throw new Error(`${old._id}@${heaterRevision[service]}: expected heater copy, found "${old.name}"`)
    const heaterContent = rewriteContent(old, nearMe)
    const header = current.sections.find((section) => section.module === 'site-header')
    const sections = heaterContent.sections.map((section) => section.module === 'site-header' && header ? header : section)
    const {_rev: oldRev, _createdAt: oldCreated, _updatedAt: oldUpdated, ...oldBody} = old
    void oldRev; void oldCreated; void oldUpdated
    const heater = {
      ...oldBody,
      sections,
      structuredData: heaterContent.structuredData,
      _id: `drafts.${heaterId(service)}`,
      slug: current.slug,
      livePath: current.livePath,
      canonicalUrl: current.canonicalUrl,
      template: current.template,
      workWeHandle: strip(`heating/heater-${service}-near-me`),
    } as Doc
    const stale = JSON.stringify({sections: heater.sections.filter((s) => s.module !== 'site-header'), sd: heater.structuredData}).match(/\/services\/[a-z-]+\/[a-z-]+(?<!-near-me)\/(?=["'\\#?])/g)
    if (stale?.length) throw new Error(`${heaterId(service)}: old URLs left after the near-me rename: ${[...new Set(stale)].join(', ')}`)

    for (const [label, doc, links] of [['furnace', furnace, furnaceContent.links], ['heater', heater, heaterContent.links]] as const) {
      console.log(`${write ? 'WRITE' : 'dry run'} ${label.padEnd(7)} ${doc._id.padEnd(55)} ${doc.livePath}  "${doc.name}" / ${doc.metaTitle}  (${links} links moved; visible "furnace" ${visibleWords(doc, /furnace/gi)}, "heater" ${visibleWords(doc, /heater/gi)})`)
    }
    changes.push(furnace, heater)
  }
  if (!write) return console.log(`${changes.length} drafts ready (dry run). Pass --write to save them as drafts, then --publish.`)
  fs.mkdirSync(backupDirectory, {recursive: true})
  fs.writeFileSync(backup, JSON.stringify(existing, null, 1))
  for (const doc of changes) await client.create(doc)
  console.log(`${changes.length} drafts written; backup ${backup}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
