// Puts the V1 service page design system into Sanity as drafts (never publishes):
// - the Service-page template gets designVersion "v1-2026-10" and the shared section copy
//   (Work We Handle heading/intro/footnote, "Equipment types" label, 24/7 band);
// - every service landing page with items in src/data/work-we-handle.json gets its own
//   "Work We Handle strip" field.
// Existing drafts are patched in place, so unpublished edits (keyword density etc.) are kept;
// a page or template with no draft gets one copied from its published version first.
// Dry run by default; pass --write to apply. A backup of every touched document is saved first.
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import catalog from '../src/reference-pages/catalog.json'
import retainedCatalog from '../src/reference-pages/retained-catalog.json'
import workItems from '../src/data/work-we-handle.json'
import {defaultServiceSections} from '../src/lib/service-page-sections'
import {WORK_ICON_NAMES, WORK_ITEM_COUNT} from '../src/lib/work-icons'

function loadLocalEnv() {
  const envPath = path.resolve('.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    process.env[match[1]] ||= match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadLocalEnv()

const write = process.argv.includes('--write')
const projectId = process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0'
const dataset = process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('Add a Sanity Editor token to SANITY_API_WRITE_TOKEN in .env.local')
const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

const TEMPLATE_ID = 'servicePageTemplate-standard-v1'
const DESIGN_VERSION = 'v1-2026-10'
type Doc = {_id: string; _rev: string; _type: string; [key: string]: unknown}

type Items = Array<{title: string; text: string; icon: string}>
// --items=<file> reads strips from another work-we-handle.json (for example a batch branch's copy).
const itemsArg = process.argv.find((arg) => arg.startsWith('--items='))?.slice('--items='.length)
const strips = (itemsArg ? JSON.parse(fs.readFileSync(path.resolve(itemsArg), 'utf8')) : workItems) as Record<string, Items>

/** Every strip key's Sanity document: catalog pages by their known ID, CMS-only pages by URL. */
async function resolvePages(): Promise<Array<{id: string; path: string; items: Items}>> {
  const known = [...catalog, ...retainedCatalog]
  const resolved: Array<{id: string; path: string; items: Items}> = []
  for (const [key, items] of Object.entries(strips)) {
    const [clusterSlug, slug] = key.split('/')
    const item = known.find((entry) => entry.clusterSlug === clusterSlug && entry.slug === slug)
    if (item) {resolved.push({id: `reference-service-${item.clusterSlug}-${item.legacySlug}`, path: item.livePath, items}); continue}
    const ids = await client.fetch<string[]>('*[_type == "referenceServicePage" && clusterSlug == $clusterSlug && slug.current == $slug]._id', {clusterSlug, slug})
    const bases = [...new Set(ids.map((id) => id.replace(/^drafts\./, '')))]
    if (bases.length > 1) throw new Error(`/services/${key}/ matches ${bases.length} Sanity documents: ${bases.join(', ')}`)
    resolved.push({id: bases[0] || `missing:${key}`, path: `/services/${key}/`, items})
  }
  return resolved
}

function strip(items: Array<{title: string; text: string; icon: string}>, pagePath: string) {
  if (items.length !== WORK_ITEM_COUNT) throw new Error(`${pagePath}: ${items.length} work items, expected ${WORK_ITEM_COUNT}`)
  return items.map((item, index) => {
    if (!(WORK_ICON_NAMES as readonly string[]).includes(item.icon)) throw new Error(`${pagePath}: unknown icon ${item.icon}`)
    return {_key: `work-${index + 1}`, _type: 'workItem', title: item.title, text: item.text, icon: item.icon}
  })
}

/** The draft to patch: the existing draft, or a new one copied from the published document. */
async function ensureDraft(id: string, docs: Doc[]): Promise<{draftId: string; created: boolean} | null> {
  const draftId = `drafts.${id}`
  if (docs.some((doc) => doc._id === draftId)) return {draftId, created: false}
  const published = docs.find((doc) => doc._id === id)
  if (!published) return null
  if (write) {
    const {_rev, _createdAt, _updatedAt, ...copy} = published
    void _rev; void _createdAt; void _updatedAt
    await client.createIfNotExists({...copy, _id: draftId} as Doc)
  }
  return {draftId, created: true}
}

async function main() {
  const pages = await resolvePages()
  const ids = [TEMPLATE_ID, ...pages.map((page) => page.id)]
  const docs = await client.fetch<Doc[]>('*[_id in $all]', {all: [...ids, ...ids.map((id) => `drafts.${id}`)]})
  const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
  fs.mkdirSync(backupDirectory, {recursive: true})
  const backup = path.join(backupDirectory, `before-design-system-${Date.now()}.json`)
  fs.writeFileSync(backup, JSON.stringify(docs, null, 2))

  const report: string[] = []
  const template = await ensureDraft(TEMPLATE_ID, docs)
  if (!template) throw new Error(`${TEMPLATE_ID} does not exist in ${dataset}`)
  const serviceSections = {_type: 'serviceSections', ...defaultServiceSections}
  if (write) await client.patch(template.draftId).set({designVersion: DESIGN_VERSION, serviceSections, active: true}).commit()
  report.push(`template: ${template.created ? 'new draft from published' : 'existing draft patched'} (designVersion ${DESIGN_VERSION}, shared sections)`)

  let patched = 0, created = 0
  const missing: string[] = []
  for (const page of pages) {
    const items = strip(page.items, page.path)
    const draft = await ensureDraft(page.id, docs)
    if (!draft) {missing.push(page.path); continue}
    if (write) {
      const rev = docs.find((doc) => doc._id === draft.draftId)?._rev
      const patch = client.patch(draft.draftId).set({workWeHandle: items})
      await (rev ? patch.ifRevisionId(rev) : patch).commit()
    }
    if (draft.created) created++; else patched++
  }
  report.push(`pages: ${patched} existing drafts patched, ${created} new drafts from published, ${missing.length} missing in Sanity${missing.length ? `: ${missing.join(', ')}` : ''}`)

  if (write) {
    const check = await client.fetch<Array<{_id: string; n: number}>>('*[_id in $drafts]{_id, "n": count(workWeHandle)}', {drafts: pages.map((page) => `drafts.${page.id}`)})
    const wrong = pages.filter((page) => !missing.includes(page.path) && check.find((doc) => doc._id === `drafts.${page.id}`)?.n !== WORK_ITEM_COUNT)
    const tpl = await client.fetch<{designVersion?: string; n?: number}>('*[_id == $id][0]{designVersion, "n": count(serviceSections.allDayPoints)}', {id: `drafts.${TEMPLATE_ID}`})
    if (wrong.length || tpl?.designVersion !== DESIGN_VERSION || !tpl?.n) throw new Error(`Verification failed: ${wrong.map((page) => page.path).join(', ') || 'template'}`)
    report.push(`verified: template draft and ${check.length} page drafts carry the design system`)
  }
  console.log(`${write ? 'WROTE' : 'DRY RUN (pass --write to apply)'}; backup ${backup}`)
  for (const line of report) console.log(`- ${line}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
