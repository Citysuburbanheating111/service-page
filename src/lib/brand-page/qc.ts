/**
 * The Studio's quality check for a brand page. A page with any problem here can't be published: the problems
 * show as errors on the brandPage document, which locks Publish, and they're listed together in its "QC" tab.
 * The rules (src/brand-pages/qc-rules.json) come from the citysuburban-brand-service-pages skill, so a page the
 * skill pushed passes, and a hand edit that breaks a rule is caught.
 */
import rules from '../../brand-pages/qc-rules.json'
import fieldSpec from '../../brand-pages/field-spec.json'

export type QcSegment = string | number | {_key: string}
export type QcProblem = {path: QcSegment[]; field: string; message: string; kind: QcKind}
export type QcKind = 'old design' | 'missing' | 'confirm' | 'note' | 'photo' | 'limit' | 'claim' | 'offer'

type Json = unknown
type Obj = Record<string, Json>

const LIMITS = (fieldSpec as {fields: Record<string, {maxLen?: number}>}).fields
const SKIP = new Set(rules.skipKeys)
const NEW_DESIGN_ONLY = ['modelTable', 'parts', 'comparison', 'sizing', 'estimateChecks', 'installations', 'library']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const isObj = (v: Json): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const present = (v: Json) => !(v === null || v === undefined || (typeof v === 'string' && !v.trim()) ||
  (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).filter((k) => !k.startsWith('_')).length))

/** Concrete path → Sanity path: list items by their _key when they have one (the Studio jumps to that item). */
type Step = {seg: QcSegment; label: string}
const toPath = (steps: Step[]) => steps.map((s) => s.seg)
const toField = (steps: Step[]) => steps.map((s) => s.label).join('').replace(/^\./, '')

function itemStep(item: Json, i: number): Step {
  return {seg: isObj(item) && typeof item._key === 'string' ? {_key: item._key} : i, label: `[${i}]`}
}

/**
 * Every concrete value of a rules path ('services.groups[].services[].title'), as the skill's QC reads it: a list item
 * that has no such list yields nothing (a part holds a price or chips, not both), and when no value is found at all
 * the field is reported missing where the path stopped.
 */
function instances(doc: Obj, npath: string): {steps: Step[]; value: Json}[] {
  let out: {steps: Step[]; value: Json}[] = [{steps: [], value: doc}]
  let stop: Step[] = []
  for (const part of npath.split(/\.(?![^[]*\])/)) {
    const many = part.endsWith('[]')
    const key = many ? part.slice(0, -2) : part
    const next: typeof out = []
    for (const {steps, value} of out) {
      const v = isObj(value) ? value[key] : undefined
      const here = [...steps, {seg: key, label: `.${key}`}]
      if (!many) next.push({steps: here, value: v})
      else if (Array.isArray(v)) v.forEach((x, i) => next.push({steps: [...here, itemStep(x, i)], value: x}))
      if (!stop.length || here.length > stop.length) stop = here
    }
    out = next
  }
  return out.length ? out : [{steps: stop, value: undefined}]
}

/** Every string in the page sections, with its path. visible = copy a reader sees (no links, photos or records). */
function* strings(o: Json, steps: Step[], visible: boolean): Generator<{steps: Step[]; text: string; visible: boolean}> {
  if (typeof o === 'string') yield {steps, text: o, visible}
  else if (Array.isArray(o)) for (let i = 0; i < o.length; i++) yield* strings(o[i], [...steps, itemStep(o[i], i)], visible)
  else if (isObj(o)) for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('_')) continue
    yield* strings(v, [...steps, {seg: k, label: `.${k}`}], visible && !SKIP.has(k))
  }
}

const has = (text: string, word: string) =>
  /^[A-Za-z]+$/.test(word) ? new RegExp(`(?<![A-Za-z])${word}(?![A-Za-z])`).test(text) : text.toLowerCase().includes(word.toLowerCase())

export function checkBrandPage(doc: Obj | undefined | null, today = new Date()): QcProblem[] {
  if (!doc) return []
  const problems: QcProblem[] = []
  const add = (steps: Step[], kind: QcKind, message: string) => problems.push({path: toPath(steps), field: toField(steps), message, kind})

  // 1. Old design: the page has none of the new design's sections. One clear message instead of hundreds.
  const missingNew = NEW_DESIGN_ONLY.filter((s) => !present(doc[s]))
  if (missingNew.length === NEW_DESIGN_ONLY.length) {
    add([{seg: 'title', label: 'title'}], 'old design',
      'Old design: this page has none of the new design\'s sections (models table, parts, comparison, sizing, quote checks, installations, library). Rewrite it with the brand-pages skill; it can\'t be published as it is.')
    return problems
  }

  const seen = new Set<string>()
  const once = (steps: Step[], kind: QcKind, message: string) => {
    const k = `${toField(steps)}|${message}`
    if (!seen.has(k)) { seen.add(k); add(steps, kind, message) }
  }

  // 2. Missing fields: every field of the design is filled, on every list item.
  for (const npath of rules.required) {
    for (const {steps, value} of instances(doc, npath)) {
      if (!present(value)) once(steps, 'missing', 'Missing: this field must be filled before the page can be published.')
    }
  }

  // each part card shows a price or chips: one of the two, never both or neither
  const parts = isObj(doc.parts) && Array.isArray(doc.parts.items) ? doc.parts.items : []
  parts.forEach((item, i) => {
    if (!isObj(item)) return
    if (present(item.price) === present(item.chips)) {
      add([{seg: 'parts', label: 'parts'}, {seg: 'items', label: '.items'}, itemStep(item, i)], 'missing',
        `Part ${i + 1} needs a price or chips: one of the two, not both or neither.`)
    }
  })

  // 3. Photos: every photo slot holds an https photo.
  for (const npath of rules.imagePaths) {
    for (const {steps, value} of instances(doc, npath)) {
      if (present(value) && !(typeof value === 'string' && value.startsWith('https://'))) add(steps, 'photo', 'Photo: this slot needs a real photo link (https).')
    }
  }

  // 4. Text: [CONFIRM] tags and placeholders anywhere; designer notes, credits, other clients and forbidden claims in the copy.
  const sections = rules.sections.map((s) => ({s, v: doc[s]}))
  const forbidden = rules.forbidden.map((f) => ({re: new RegExp(f.pattern, 'i'), reason: f.reason}))
  for (const {s, v} of sections) {
    for (const {steps, text, visible} of strings(v, [{seg: s, label: s}], true)) {
      // one message per kind of problem per field (the lists overlap: "[CONFIRM" and "CONFIRM:", "Highlights" and "Highlights Chicago")
      const lower = text.toLowerCase()
      const tag = rules.placeholders.find((w) => has(text, w))
      if (tag) once(steps, 'confirm', `"${tag.trim()}" left in the text: write the fact, or remove the sentence.`)
      if (!visible) continue
      const note = rules.designerNotes.find((n) => lower.includes(n.toLowerCase()))
      if (note) once(steps, 'note', `Note left on the page ("${note}"): remove it.`)
      const name = rules.otherNames.find((n) => has(lower, n.toLowerCase()))
      if (name) once(steps, 'claim', `Another company's name ("${name}"): remove it.`)
      const claim = forbidden.map((f) => ({m: text.match(f.re), reason: f.reason})).find((f) => f.m)
      const phrase = rules.bannedPricePhrases.find((p) => lower.includes(p.toLowerCase()))
      if (claim?.m) once(steps, 'claim', `"${claim.m[0]}": ${claim.reason}.`)
      else if (phrase) once(steps, 'claim', `"${phrase}" can't be on the page.`)
      // 5. Offers: no offer date that has passed.
      for (const m of text.matchAll(/[Vv]alid (?:to|until|through|till) ([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})/g)) {
        const month = MONTHS.indexOf(m[1])
        if (month < 0) continue
        const end = new Date(Number(m[3]), month, Number(m[2]), 23, 59, 59)
        if (end < today) once(steps, 'offer', `The offer ended ("${m[0]}"): use the site's current offer and date, or remove it.`)
      }
    }
  }

  // 6. Limits: character limits of the design, SEO title and description, the address.
  for (const {s, v} of sections) {
    for (const {steps, text} of strings(v, [{seg: s, label: s}], true)) {
      const max = LIMITS[toField(steps).replace(/\[\d+\]/g, '[]')]?.maxLen
      if (max && text.length > max) add(steps, 'limit', `Too long: ${text.length} characters, the design fits ${max}.`)
    }
  }
  const metaTitle = typeof doc.metaTitle === 'string' ? doc.metaTitle : ''
  if (metaTitle.length > rules.seoTitleMax) add([{seg: 'metaTitle', label: 'metaTitle'}], 'limit', `Meta title is ${metaTitle.length} characters; Google shows ${rules.seoTitleMax}.`)
  const metaDescription = typeof doc.metaDescription === 'string' ? doc.metaDescription : ''
  if (metaDescription.length > rules.metaDescriptionMax) add([{seg: 'metaDescription', label: 'metaDescription'}], 'limit', `Meta description is ${metaDescription.length} characters; keep it to ${rules.metaDescriptionMax}.`)
  const meta = isObj(doc.meta) ? doc.meta : {}
  if (typeof meta.slug === 'string' && typeof doc.path === 'string' && meta.slug !== doc.path) {
    add([{seg: 'path', label: 'path'}], 'limit', `The page address (${doc.path}) and meta slug (${meta.slug}) differ: make them the same.`)
  }
  return problems
}

/** Sanity document validation: every problem is an error, so Publish stays locked until the list is empty. */
export function brandPageValidation(doc: unknown) {
  const problems = checkBrandPage(doc as Obj)
  return problems.length ? problems.map((p) => ({message: `QC: ${p.message}`, path: p.path})) : true
}
