// Writes the missing fields found on 22 Oct 2026 (data/missing-fields/2026-10-22.json) into Sanity drafts:
// - the short note after the badge in each "Match the symptom" row whose note was empty;
// - Ductwork Design & Repair's empty brands box and reviews intro.
// Every new text becomes a native, editable content field (data-content-field + contentFields entry).
// Existing drafts are patched in place; a page without a draft gets one copied from its published version.
// Dry run unless --write. A backup of every touched document is saved first. Never publishes.
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

type Field = {_key: string; _type: string; target: string; kind: string; label: string; value: string}
type Section = {_key?: string; module: string; html: string; contentFields?: Field[]}
type Doc = {_id: string; _rev: string; _type: string; clusterSlug: string; slug: {current: string}; sections: Section[]; [key: string]: unknown}
type Data = {
  notes: Record<string, Record<string, string>>
  ductwork: {page: string; brandsHeading: string; brandChips: Array<{kind: 'logo' | 'text'; src?: string; alt?: string; value?: string}>; reviewsIntro: string}
}

const data = JSON.parse(fs.readFileSync('data/missing-fields/2026-10-22.json', 'utf8')) as Data
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NOTE_STYLE = 'font-size: 13px; color: #606060;'
const CHIP_STYLE = 'margin: 0; background: #FFFFFF; border: 1px solid #E3E7EA; border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: center; min-width: 120px; height: 64px; box-sizing: border-box;'
const LOGO_STYLE = 'max-height: 40px; max-width: 140px; width: auto; height: auto; object-fit: contain; display: block;'
const CHIP_TEXT_STYLE = "font-family: 'Ubuntu', sans-serif; font-weight: 500; font-size: 16px; color: #09263A;"

/** Next free field number in a section: copy and image fields share one sequence. */
function nextIndex(section: Section, prefix: string) {
  const used = [...section.html.matchAll(new RegExp(`${prefix}-(?:copy|image)-(\\d+)`, 'g'))].map((m) => Number(m[1]))
  for (const field of section.contentFields || []) {
    const m = field.target.match(/-(\d+)$/)
    if (m) used.push(Number(m[1]))
  }
  return Math.max(0, ...used) + 1
}
function sectionPrefix(section: Section) {
  const m = section.html.match(/data-content-(?:field|image)="(s\d+)-/) || (section.contentFields || [])[0]?.target.match(/^(s\d+)-/)
  if (!m) throw new Error(`section ${section.module}: no field prefix`)
  return m[1]
}
const textField = (target: string, value: string, tag: string): Field => ({_key: target, _type: 'referenceContentField', target, kind: 'text', label: `${tag}: ${value}`.slice(0, 95), value})

function fillNotes(doc: Doc, notes: Record<string, string>, log: string[]) {
  const section = doc.sections.find((s) => s.module === 'problems')
  if (!section) throw new Error(`${doc._id}: no problems section`)
  const prefix = sectionPrefix(section)
  let index = nextIndex(section, prefix)
  for (const [title, note] of Object.entries(notes)) {
    const summaries = [...section.html.matchAll(/<summary\b[\s\S]*?<\/summary>/g)].filter((m) => new RegExp(`>\\s*${escapeRegExp(escapeHtml(title))}\\s*<`).test(m[0]))
    if (summaries.length !== 1) throw new Error(`${doc._id}: row "${title}" found ${summaries.length} times`)
    const summary = summaries[0][0]
    const spans = [...summary.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/g)].filter((m) => !/aria-hidden/.test(m[1]))
    if (spans.length < 3) throw new Error(`${doc._id}: row "${title}" has no note slot`)
    const slot = spans[2]
    if (slot[2].replace(/<[^>]*>/g, '').trim()) throw new Error(`${doc._id}: row "${title}" already has a note: ${slot[2]}`)
    const target = `${prefix}-copy-${index++}`
    const style = slot[1].match(/style="([^"]*)"/)?.[1] || NOTE_STYLE
    const filledSummary = summary.replace(slot[0], `<span data-content-field="${target}" style="${style}">${escapeHtml(note)}</span>`)
    section.html = section.html.replace(summary, () => filledSummary)
    section.contentFields = [...(section.contentFields || []), textField(target, note, 'SPAN')]
    log.push(`note "${note}" → ${title}`)
  }
}

function fillDuctwork(doc: Doc, spec: Data['ductwork'], log: string[]) {
  const systems = doc.sections.find((s) => /data-module="brands"/.test(s.html))
  if (!systems) throw new Error(`${doc._id}: no brands box`)
  const prefix = sectionPrefix(systems)
  let index = nextIndex(systems, prefix)
  const box = systems.html.match(/<div data-module="brands"[^>]*>\s*<h3\b([^>]*)>\s*<\/h3>\s*<div\b([^>]*)>\s*<\/div>/)
  if (!box) throw new Error(`${doc._id}: brands box is not empty any more`)
  const headingTarget = `${prefix}-copy-${index++}`
  const fields: Field[] = [textField(headingTarget, spec.brandsHeading, 'H3')]
  const chips = spec.brandChips.map((chip) => {
    if (chip.kind === 'logo') {
      const target = `${prefix}-image-${index++}`
      fields.push({_key: `${target}-src`, _type: 'referenceContentField', target, kind: 'image', label: `Image: ${chip.alt}`, value: chip.src!})
      fields.push({_key: `${target}-alt`, _type: 'referenceContentField', target, kind: 'alt', label: `Alt text: ${chip.alt}`, value: chip.alt!})
      return `<figure data-role="brand-logo" style="${CHIP_STYLE}"><img data-content-image="${target}" src="${escapeHtml(chip.src!)}" alt="${escapeHtml(chip.alt!)}" style="${LOGO_STYLE}"></figure>`
    }
    const target = `${prefix}-copy-${index++}`
    fields.push(textField(target, chip.value!, 'SPAN'))
    return `<figure data-role="brand-logo" style="${CHIP_STYLE}"><span data-content-field="${target}" style="${CHIP_TEXT_STYLE}">${escapeHtml(chip.value!)}</span></figure>`
  })
  const filled = box[0]
    .replace(/<h3\b([^>]*)>\s*<\/h3>/, (_m, attrs: string) => `<h3 data-content-field="${headingTarget}"${attrs}>${escapeHtml(spec.brandsHeading)}</h3>`)
    .replace(/<div\b([^>]*)>\s*<\/div>$/, (_m, attrs: string) => `<div${attrs}>\n${chips.join('\n')}\n        </div>`)
  systems.html = systems.html.replace(box[0], () => filled)
  systems.contentFields = [...(systems.contentFields || []), ...fields]
  log.push(`brands box → "${spec.brandsHeading}" + ${spec.brandChips.length} chips`)

  const reviews = doc.sections.find((s) => s.module === 'reviews')
  if (!reviews) throw new Error(`${doc._id}: no reviews section`)
  const rPrefix = sectionPrefix(reviews)
  const intro = reviews.html.match(/(<\/h2>\s*)<p\b([^>]*)>\s*<\/p>/)
  if (!intro) throw new Error(`${doc._id}: reviews intro is not empty any more`)
  const target = `${rPrefix}-copy-${nextIndex(reviews, rPrefix)}`
  reviews.html = reviews.html.replace(intro[0], () => `${intro[1]}<p data-content-field="${target}"${intro[2]}>${escapeHtml(spec.reviewsIntro)}</p>`)
  reviews.contentFields = [...(reviews.contentFields || []), textField(target, spec.reviewsIntro, 'P')]
  log.push(`reviews intro → "${spec.reviewsIntro.slice(0, 60)}…"`)
}

async function main() {
  const pages = [...new Set([...Object.keys(data.notes), data.ductwork.page])]
  const found = await client.fetch<Array<{_id: string; c: string; s: string}>>(
    '*[_type == "referenceServicePage"]{_id, "c": clusterSlug, "s": slug.current}')
  const ids = pages.map((page) => {
    const [c, s] = page.split('/')
    const bases = [...new Set(found.filter((d) => d.c === c && d.s === s).map((d) => d._id.replace(/^drafts\./, '')))]
    if (bases.length !== 1) throw new Error(`${page}: ${bases.length} Sanity documents`)
    return {page, id: bases[0]}
  })
  const docs = await client.fetch<Doc[]>('*[_id in $all]', {all: ids.flatMap(({id}) => [id, `drafts.${id}`])})
  const backupDirectory = path.resolve('..', '.reference-preview', 'sanity-backups')
  fs.mkdirSync(backupDirectory, {recursive: true})
  const backup = path.join(backupDirectory, `before-missing-fields-${Date.now()}.json`)
  fs.writeFileSync(backup, JSON.stringify(docs, null, 1))

  let total = 0
  for (const {page, id} of ids) {
    const draft = docs.find((doc) => doc._id === `drafts.${id}`)
    const published = docs.find((doc) => doc._id === id)
    const base = structuredClone(draft || published) as Doc
    if (!base) throw new Error(`${page}: not found`)
    const log: string[] = []
    if (data.notes[page]) fillNotes(base, data.notes[page], log)
    if (page === data.ductwork.page) fillDuctwork(base, data.ductwork, log)
    total += log.length
    console.log(`${write ? 'WRITE' : 'dry run'} /services/${page}/ (${draft ? 'existing draft' : 'new draft from published'}): ${log.length} fields`)
    if (!write) continue
    if (draft) {
      await client.patch(draft._id).ifRevisionId(draft._rev).set({sections: base.sections}).commit()
    } else {
      const {_rev, _createdAt, _updatedAt, ...copy} = base
      void _rev; void _createdAt; void _updatedAt
      await client.create({...copy, _id: `drafts.${id}`} as Doc)
    }
  }
  console.log(`${total} fields ${write ? 'written to drafts' : 'ready (dry run, pass --write)'}; backup ${backup}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
