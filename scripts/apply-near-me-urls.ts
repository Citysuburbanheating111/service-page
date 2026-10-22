// Moves every service landing page in Sanity to its "-near-me" URL, as drafts (never publishes):
// slug, livePath, canonicalUrl, structuredData and every internal link to a renamed page (section html
// and content-field values). Old → new paths come from data/service-url-near-me.json.
// Existing drafts are patched in place; a page without a draft gets one copied from its published version.
// Dry run unless --write. A backup of every touched document is saved first.
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (match) process.env[match[1]] ||= match[2].replace(/^['"]|['"]$/g, '')
}
const write = process.argv.includes('--write')
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('Add a Sanity Editor token to SANITY_API_WRITE_TOKEN in .env.local')
const client = createClient({projectId: 'boolyxr0', dataset: 'production', apiVersion: '2026-03-01', token, useCdn: false, perspective: 'raw'})
const SITE = 'https://citysuburbanheating.com'

const map = JSON.parse(fs.readFileSync('data/service-url-near-me.json', 'utf8')) as Record<string, string>
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rules = Object.entries(map).map(([from, to]) => ({
  re: new RegExp(`${escapeRegExp(from.slice(0, -1))}(/?)(?=[\\\\"'#?\\s<)\\]]|$)`, 'g'),
  to: to.slice(0, -1),
}))
function rewrite(text: string): [string, number] {
  let count = 0
  for (const {re, to} of rules) text = text.replace(re, (_m, slash: string) => { count++; return to + slash })
  return [text, count]
}

type Field = {target: string; kind: string; value: string; label?: string}
type Section = {module: string; html: string; contentFields?: Field[]}
type Doc = {_id: string; _rev: string; _type: string; clusterSlug: string; slug: {_type?: string; current: string}; livePath?: string; canonicalUrl?: string; structuredData?: string; sections: Section[]; [key: string]: unknown}

async function main() {
  const docs = await client.fetch<Doc[]>('*[_type == "referenceServicePage"]')
  const ids = [...new Set(docs.map((doc) => doc._id.replace(/^drafts\./, '')))]
  const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
  fs.mkdirSync(backupDirectory, {recursive: true})
  const backup = path.join(backupDirectory, `before-near-me-urls-${Date.now()}.json`)
  fs.writeFileSync(backup, JSON.stringify(docs, null, 1))

  let pages = 0, links = 0
  const problems: string[] = []
  for (const id of ids) {
    const draft = docs.find((doc) => doc._id === `drafts.${id}`)
    const published = docs.find((doc) => doc._id === id)
    const base = structuredClone(draft || published) as Doc
    const oldPath = `/services/${base.clusterSlug}/${base.slug.current}/`
    const newPath = map[oldPath]
    if (!newPath) {
      if (!Object.values(map).includes(oldPath)) problems.push(`${id}: ${oldPath} is not in the rename list`)
      continue // already renamed
    }
    const newSlug = newPath.split('/').at(-2)!
    let count = 0
    const sections = base.sections.map((section) => {
      const [html, n] = rewrite(section.html)
      count += n
      const contentFields = section.contentFields?.map((field) => {
        if (field.kind === 'image') return field
        const [value, m] = rewrite(field.value || '')
        count += m
        return m ? {...field, value} : field
      })
      return {...section, html, ...(contentFields ? {contentFields} : {})}
    })
    const [structuredData, s] = rewrite(base.structuredData || '')
    count += s
    const set = {
      slug: {_type: 'slug', current: newSlug},
      livePath: newPath,
      canonicalUrl: `${SITE}${newPath}`,
      ...(base.structuredData ? {structuredData} : {}),
      sections,
    }
    pages++; links += count
    console.log(`${write ? 'WRITE' : 'dry run'} ${oldPath} → ${newPath} (${draft ? 'existing draft' : 'new draft'}; ${count} links)`)
    if (!write) continue
    if (draft) {
      await client.patch(draft._id).ifRevisionId(draft._rev).set(set).commit()
    } else {
      const {_rev, _createdAt, _updatedAt, ...copy} = base
      void _rev; void _createdAt; void _updatedAt
      await client.create({...copy, ...set, _id: `drafts.${id}`} as Doc)
    }
  }
  for (const problem of problems) console.log(`PROBLEM ${problem}`)
  console.log(`${pages} pages, ${links} links ${write ? 'written to drafts' : 'ready (dry run, pass --write)'}; backup ${backup}`)
  if (problems.length) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
