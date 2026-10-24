// Save brand page JSON files (the citysuburban-brand-service-pages skill's shape) to Sanity as brandPage
// DRAFTS: every field of the design, the page address, and a rendered design snapshot. Never publishes.
//   tsx scripts/sync-brand-pages.ts <page.json>... [--reviews google-reviews.csv] [--id <docId> for a single file] [--write]
// A page that is already published gets a draft on top of it; publish it in Studio to put it live.
import fs from 'node:fs'
import {createClient} from 'next-sanity'
import {renderBrandPage} from '@/lib/brand-page/render'
import {DESIGN_CSS} from '@/lib/brand-page/styles'

const args = process.argv.slice(2)
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const write = args.includes('--write')
const files = args.filter((a, i) => !a.startsWith('--') && !['--reviews', '--id'].includes(args[i - 1]))
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m![1], m![2].replace(/^['"]|['"]$/g, '')]))
const token = process.env.SANITY_API_WRITE_TOKEN || env.SANITY_API_WRITE_TOKEN
if (write && !token) throw new Error('SANITY_API_WRITE_TOKEN is needed to write')
const client = createClient({projectId: 'boolyxr0', dataset: 'production', apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})

/** Review links by reviewer name, from the Google reviews export (CSV with author and review_url). */
function reviewLinks(csvPath?: string) {
  if (!csvPath) return {}
  const text = fs.readFileSync(csvPath, 'utf8'); const rows: string[][] = []; let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false } else field += c }
    else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  const [head, ...data] = rows
  const a = head.indexOf('author'), u = head.indexOf('review_url')
  return Object.fromEntries(data.filter((r) => r[a] && r[u]).map((r) => [r[a], r[u]]))
}

/** Sanity needs a _key on every object inside an array. */
function keyed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v, i) => (v && typeof v === 'object' && !Array.isArray(v) ? {_key: `k${i}`, ...(keyed(v) as object)} : keyed(v)))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== '_key').map(([k, v]) => [k, keyed(v)]))
  return value
}

async function main() {
const links = reviewLinks(opt('--reviews'))
for (const file of files) {
  const page = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const r of page.reviews?.reviews || []) if (!r.url && links[r.name]) r.url = links[r.name]
  const path = page.meta.slug as string
  const key = path.replace(/^\/|\/$/g, '').replace(/\//g, '-')
  const id = opt('--id') && files.length === 1 ? opt('--id')! : `brandPage-${key}`
  const rendered = renderBrandPage(page)
  const content = Object.fromEntries(['meta', 'hero', 'models', 'services', 'recentJobs', 'pricing', 'servicePlan', 'financing', 'whoYoureCalling', 'reviews', 'process', 'serviceArea', 'faq', 'closingCta', 'siblingLinks'].map((k) => [k, keyed(page[k])]))
  const fields = {
    title: page.hero.h1, path, metaTitle: page.meta.seoTitle, metaDescription: page.meta.metaDescription,
    designSource: 'https://app.paper.design/file/01M4X2DQFNVXA75B9MRX99QYFG/p-3-1', responsiveCss: DESIGN_CSS,
    ...content,
    sections: rendered.sections.map((s) => ({_key: s.module.replace(/[^a-z0-9]/g, ''), _type: 'brandPageSection', module: s.module, label: s.label, html: s.html})),
  }
  const [draft, published] = await Promise.all([client.getDocument(`drafts.${id}`), client.getDocument(id)])
  const base = draft || published
  console.log(`${write ? '✓ saved' : '· would save'} drafts.${id} | ${path} | "${fields.title}"${published ? ' | published version stays live until you publish this draft' : ''}`)
  if (!write) continue
  if (base) await client.createOrReplace({...base, _id: `drafts.${id}`, _type: 'brandPage', ...fields, slug: base.slug || {_type: 'slug', current: key}})
  else await client.create({_id: `drafts.${id}`, _type: 'brandPage', slug: {_type: 'slug', current: key}, ...fields})
}
if (!write) console.log('(dry run: add --write to save the drafts)')
}

main().catch((error) => { console.error(error); process.exit(1) })
