/* eslint-disable @typescript-eslint/no-explicit-any -- Brand page content is the skill's open JSON shape. */
// Brand pages: the Paper design ("city new", Brand page · American Standard furnace) filled from a
// brandPage document's fields. The design sections carry the American Standard furnace copy; every
// slot is found by that copy and replaced from the page's fields, then the static design is made
// interactive (links, booking form, tabs, FAQ, carousels, map). Site chrome comes from the live header
// and footer, so the design's own utility bar, header and footer are not rendered.
import {parse, type HTMLElement, type Node} from 'node-html-parser'
import designSections from '@/brand-pages/design-sections.json'
import slotReference from '@/brand-pages/slot-reference.json'
import {business} from '@/lib/site-navigation'

export type BrandPageContent = Record<string, any>
export type RenderedBrandPage = {html: string; sections: {module: string; label: string; html: string}[]}
type Words = {brand: string; eq: string; eqL: string; service: string; serviceL: string}

const SECTIONS = designSections as {module: string; label: string; html: string}[]
const EXAMPLE = slotReference as BrandPageContent
const CHROME = new Set(['utility-bar', 'site-header', 'site-footer'])
const YELP = 'https://www.yelp.com/biz/city-and-suburban-heating-and-cooling-chicago'
const MAP_FALLBACK = 'https://www.google.com/maps?q=City+%26+Suburban+Heating+%26+Cooling,+1225+N+Cleaver+St,+Chicago,+IL&z=11&output=embed'

/** Anchor ids for the sections the "On this page" chips and phone tabs point to. */
export const SECTION_IDS: Record<string, string> = {
  models: 'models', services: 'services', 'recent-jobs': 'jobs', pricing: 'prices', 'service-plan': 'plan', financing: 'financing',
  'who-you-call': 'about', reviews: 'reviews', process: 'process', 'service-areas': 'area', faq: 'faq', 'closing-cta': 'contact', 'other-brands': 'other-brands',
}

// ------------------------------------------------------------------ text helpers
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = (s: string) => esc(s).replace(/"/g, '&quot;')
const norm = (s: string) => decode(s).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
const ownText = (el: HTMLElement) => el.childNodes.filter((c) => c.nodeType === 3).map((c) => c.rawText).join('')
const isCaps = (s: string) => /[A-Z]/.test(s) && !/[a-z]/.test(decode(s))
const elements = (root: HTMLElement) => root.querySelectorAll('*')
const textEls = (root: HTMLElement) => elements(root).filter((e) => e.childNodes.some((c) => c.nodeType === 3 && c.rawText.trim()))
const kids = (el: HTMLElement) => el.childNodes.filter((c): c is HTMLElement => c.nodeType === 1)
const has = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : v != null

/** Slots a section renderer filled itself; the auto map leaves them alone. */
let touched = new Set<HTMLElement>()

/** Replace an element's own text, keeping all-caps slots in caps. */
function setT(el: HTMLElement | null | undefined, value: unknown) {
  if (!el) throw new Error('brand page: missing slot')
  touched.add(el)
  let v = value == null ? '' : String(value)
  if (isCaps(ownText(el))) v = v.toUpperCase()
  el.childNodes.filter((c) => c.nodeType === 3).forEach((t, i) => { (t as any).rawText = i === 0 ? esc(v) : '' })
}
/** The element whose own text equals `text` (the nth match). */
function find(root: HTMLElement, text: string, nth = 0) {
  const k = norm(text)
  const hit = textEls(root).filter((e) => norm(ownText(e)) === k)[nth]
  if (!hit) throw new Error(`brand page: slot "${text}" #${nth} not found`)
  return hit
}
const tryFind = (root: HTMLElement, text: string, nth = 0) => { try { return find(root, text, nth) } catch { return null } }
const startsWith = (root: HTMLElement, text: string) => textEls(root).filter((e) => decode(ownText(e)).startsWith(text))
/** Climb from two sibling items to their common container. */
function items(a: HTMLElement, b: HTMLElement): [HTMLElement, HTMLElement] {
  const chainA: Node[] = []; for (let x: Node | null = a; x; x = x.parentNode) chainA.push(x)
  let y: Node | null = b
  while (y && !chainA.includes(y)) y = y.parentNode
  const container = y as HTMLElement
  return [container, chainA[chainA.indexOf(container) - 1] as HTMLElement]
}
function insertBefore(node: HTMLElement, ref: HTMLElement) {
  const p = ref.parentNode; const i = p.childNodes.indexOf(ref)
  node.parentNode = p; p.childNodes.splice(i, 0, node)
}
function insertAfter(node: HTMLElement, ref: HTMLElement) {
  const p = ref.parentNode; const i = p.childNodes.indexOf(ref)
  node.parentNode = p; p.childNodes.splice(i + 1, 0, node)
}
const clone = (el: HTMLElement) => kids(parse(el.toString()))[0]
/** Replace `count` items starting at `first` with one filled clone per data entry. */
function fillRun<T>(container: HTMLElement, first: HTMLElement, count: number, data: T[], fill: (el: HTMLElement, d: T, i: number) => void) {
  const all = kids(container); const start = all.indexOf(first)
  if (start < 0) throw new Error('brand page: list item not in container')
  const run = all.slice(start, start + count)
  data.forEach((d, i) => { const el = clone(first); fill(el, d, i); insertBefore(el, run[0]) })
  run.forEach((r) => r.remove())
}
const getPath = (o: any, p: string) => p.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((x, k) => (x == null ? undefined : x[k]), o)
/** A phone-layout override when the page has one, otherwise the value derived from the desktop copy. */
const mob = (p: BrandPageContent, path: string, fallback: unknown) => { const v = getPath(p, path); return has(v) ? v : fallback }

// ------------------------------------------------------------------ the auto map
// A slot whose American Standard text equals a field of the reference page takes that field.
const exLeaves: [string, string][] = []
;(function walk(o: any, p: string) {
  if (typeof o === 'string') exLeaves.push([p, o])
  else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${p}[${i}]`))
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k)
})(EXAMPLE, '')
const exByText = new Map<string, string[]>()
for (const [p, v] of exLeaves) { const k = norm(v); exByText.set(k, [...(exByText.get(k) || []), p]) }
const MODULE_KEYS: Record<string, string[]> = {hero: ['hero'], models: ['models'], services: ['services'], 'recent-jobs': ['recentJobs'], pricing: ['pricing'], 'service-plan': ['servicePlan', 'financing'], financing: ['financing'], 'who-you-call': ['whoYoureCalling'], reviews: ['reviews'], process: ['process'], 'service-areas': ['serviceArea'], faq: ['faq'], 'closing-cta': ['closingCta'], 'other-brands': ['siblingLinks']}
function exPath(module: string, text: string) {
  const all = exByText.get(norm(text)); if (!all) return undefined
  const keys = MODULE_KEYS[module] || []
  return all.find((p) => keys.includes(p.split(/[.[]/)[0])) || (keys.length ? undefined : all[0])
}

const join2 = (list: string[]) => {
  if (list.length <= 1) return [list.join('')]
  const h = Math.ceil(list.length / 2)
  return [list.slice(0, h).join(' · '), list.slice(h).join(' · ')]
}
const initial = (name: string) => (name.trim()[0] || '').toUpperCase()
const firstSentence = (s: string) => (s.split(/(?<=[.!?])\s/)[0] || s).trim()

// ------------------------------------------------------------------ interactivity helpers
/** Turn a design box into a link or another element, keeping its look. */
function retag(el: HTMLElement, tag: string, attrs: Record<string, string> = {}) {
  (el as any).rawTagName = tag
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  if (tag === 'a' || tag === 'button') el.setAttribute('style', `${el.getAttribute('style') || ''};cursor:pointer;text-decoration:none`)
  return el
}
/** The pill or card around a label: the nearest ancestor drawn as a rounded box. */
function pill(el: HTMLElement, levels = 3) {
  let x: HTMLElement | null = el
  for (let i = 0; i < levels && x; i++, x = x.parentNode as HTMLElement) if (/border-radius:(999px|10px|12px)/.test(x.getAttribute('style') || '')) return x
  return el
}
function link(root: HTMLElement, text: string, href: string, self = false) {
  const hits = textEls(root).filter((e) => norm(ownText(e)) === norm(text))
  for (const e of hits) {
    const box = self ? e : pill(e)
    if ((box as any).rawTagName === 'a') continue
    retag(box, 'a', {href, ...(/^https?:/.test(href) ? {target: '_blank', rel: 'noopener'} : {})})
  }
}
/** Swap-able tabs: tab boxes and panels share data-cs-tab indexes inside one data-cs-tabs group. */
function tabs(group: HTMLElement, tabEls: HTMLElement[], panels: HTMLElement[]) {
  group.setAttribute('data-cs-tabs', '')
  tabEls[0].parentNode.setAttribute('role', 'tablist')
  tabEls.forEach((t, i) => { retag(t, 'button', {type: 'button', 'data-cs-tab': String(i), 'aria-selected': i === 0 ? 'true' : 'false', role: 'tab'}) })
  panels.forEach((p, i) => { p.setAttribute('data-cs-panel', String(i)); p.setAttribute('role', 'tabpanel'); if (i) p.setAttribute('hidden', '') })
}

// ------------------------------------------------------------------ section renderers
type Ctx = {p: BrandPageContent; w: Words; published: Set<string>; reviewUrls: Record<string, string>}
const R: Record<string, (root: HTMLElement, ctx: Ctx) => void> = {}

const PAPER_LEDE = 'No heat, a blinking light, or a furnace that lights and shuts off? We repair, clean, tune and replace American Standard furnaces across Chicago, from older Silver models to the Platinum 95. Genuine parts on the van, the price agreed before we start, and your warranty kept intact.'

R.hero = (root, {p, w}) => {
  const h = p.hero
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  setT(find(root, 'Home  ›  Brands  ›  American Standard  ›  Furnace repair & service'), h.breadcrumb.join('  ›  '))
  setT(find(root, PAPER_LEDE), h.lede)
  setT(find(root, 'Furnace model (optional)'), mob(p, 'hero.modelFieldLabel', `${w.eq} model (optional)`))
  setT(find(root, 'e.g. Gold S9V2 · or “not sure”'), h.modelFieldPlaceholder)
  setT(find(m, "WHAT'S YOUR FURNACE DOING?"), mob(p, 'hero.mobile.symptomsHeading', `What's your ${w.eqL} doing?`))
  const chipsM = ['No heat', 'Blinking light', 'Lights, then shuts off', 'Tune-up'].map((t) => find(m, t))
  chipsM.forEach((el, i) => setT(el, mob(p, `hero.mobile.symptomChips[${i}]`, h.symptomChips[i])))
  const strip = EXAMPLE.hero.mobile.valueStrip.map((ex: any) => [find(m, ex.value), find(m, ex.label)])
  h.mobile.valueStrip.forEach((v: any, i: number) => { setT(strip[i][0], v.value); setT(strip[i][1], v.label) })

  // booking form (desktop): real fields posting to the lead API
  const card = find(d, EXAMPLE.hero.formTitle).parentNode.parentNode as HTMLElement
  retag(card, 'form', {id: 'book', novalidate: '', 'data-cs-form': 'booking', 'data-service': `${w.brand} ${w.eqL} ${w.serviceL}`})
  const box = (label: string) => find(card, label).nextElementSibling as HTMLElement
  const input = (el: HTMLElement, attrs: Record<string, string>, placeholderEl?: HTMLElement | null) => {
    const style = `${el.getAttribute('style') || ''};font:inherit;font-size:14px;color:var(--color-navy);background:#FFFFFF;width:100%;min-width:0;outline-color:var(--color-blue)`
    const ph = placeholderEl ? decode(ownText(placeholderEl)) : ''
    const icon = el.querySelector('svg')
    const field = `<input ${Object.entries({...attrs, ...(ph ? {placeholder: ph} : {})}).map(([k, v]) => `${k}="${attr(v)}"`).join(' ')} style="${attr(icon ? 'border:0;background:transparent;font:inherit;font-size:14px;color:var(--color-navy);flex:1;min-width:0;outline:none' : style)}">`
    if (icon) { el.set_content(`${icon.toString()}${field}`) } else { const n = kids(parse(field))[0]; insertBefore(n, el); el.remove() }
  }
  const nameBox = box('Name'), phoneBox = box('Phone')
  // email: Jobber needs one, so the form adds an Email field in the Name/Phone style
  const row = nameBox.parentNode.parentNode as HTMLElement
  const emailRow = clone(nameBox.parentNode as HTMLElement); setT(find(emailRow, 'Name'), 'Email')
  emailRow.setAttribute('style', `${emailRow.getAttribute('style') || ''};width:100%`)
  insertAfter(emailRow, row)
  input(nameBox, {name: 'name', type: 'text', autocomplete: 'name', required: '', 'aria-label': 'Name'})
  input(phoneBox, {name: 'phone', type: 'tel', autocomplete: 'tel', required: '', 'aria-label': 'Phone'})
  input(emailRow.querySelector('[style*="height:44px"]') as HTMLElement, {name: 'email', type: 'email', autocomplete: 'email', required: '', 'aria-label': 'Email'})
  const street = find(card, 'e.g. Belmont & Western'); input(street.parentNode as HTMLElement, {name: 'area', type: 'text', autocomplete: 'street-address', 'aria-label': 'Street or cross streets'}, street)
  const modelPh = find(card, h.modelFieldPlaceholder); const modelBox = modelPh.parentNode as HTMLElement
  const models = (p.models?.series || []).flatMap((s: any) => s.models || [])
  modelBox.querySelector('svg')?.remove()
  input(modelBox, {name: 'model', type: 'text', list: 'cs-models', 'aria-label': `${w.eq} model (optional)`}, modelPh)
  insertAfter(kids(parse(`<datalist id="cs-models">${models.map((x: string) => `<option value="${attr(x)}"></option>`).join('')}<option value="Not sure"></option></datalist>`))[0], card.querySelector('[name="model"]')!.parentNode as HTMLElement)
  // symptom chips become radio choices
  const chipBox = find(card, EXAMPLE.hero.symptomChips[0]).parentNode as HTMLElement
  const chipRow = chipBox.parentNode as HTMLElement
  const plainChip = kids(chipRow)[1]
  const plain = plainChip?.getAttribute('style') || ''
  const textStyle = kids(plainChip)[0]?.getAttribute('style') || ''
  kids(chipRow).forEach((chip, i) => {
    const text = String(h.symptomChips[i] ?? '')
    chip.setAttribute('style', plain)
    retag(chip, 'label', {class: 'cs31-choice'})
    chip.set_content(`<input type="radio" name="issue" value="${attr(text)}"${i === 0 ? ' checked' : ''}><span style="${attr(textStyle)}">${esc(text)}</span>`)
  })
  const submit = pill(find(card, 'BOOK A TECHNICIAN'))
  retag(submit, 'button', {type: 'submit'})
  submit.setAttribute('style', `${submit.getAttribute('style')};border:0;width:100%;font:inherit`)
  // buttons and links
  link(d, 'CALL (773) 238-3838', business.phoneHref); link(m, 'CALL (773) 238-3838', business.phoneHref)
  link(d, 'SCHEDULE SERVICE', '#book'); link(m, 'BOOK A TECHNICIAN', business.scheduleHref)
  link(root, '204 Google reviews', business.reviewsHref, true)
  const yelp = textEls(d).find((e) => norm(ownText(e)) === '4.9'); if (yelp) retag(yelp.parentNode as HTMLElement, 'a', {href: YELP, target: '_blank', rel: 'noopener'})
  // "On this page" chips and the phone section tabs
  const chipTargets: [string, string][] = [['Models we service', 'models'], ['Services we do', 'services'], ['Recent jobs', 'jobs'], ['What we charge', 'prices'], ['Service plan', 'plan'], ['Financing', 'financing'], ["Who you're calling", 'about'], ['What customers say', 'reviews'], ['What happens when you call', 'process'], ['Where we work', 'area'], ['Questions', 'faq'], ['Other brands & equipment', 'other-brands']]
  for (const [label, id] of chipTargets) { const e = tryFind(d, label); if (e) retag(e.parentNode as HTMLElement, 'a', {href: `#${id}`}) }
  for (const [label, id] of [['MODELS', 'models'], ['SERVICES', 'services'], ['JOBS', 'jobs'], ['PRICES', 'prices'], ['PLAN', 'plan'], ['REVIEWS', 'reviews']]) {
    const e = tryFind(m, label); if (e) retag(pill(e, 2), 'a', {href: `#${id}`})
  }
  retag(find(d, EXAMPLE.hero.h1), 'h1')
}

R.models = (root, {p}) => {
  const M = p.models, X = EXAMPLE.models
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  const chipsD = [['Platinum 95', 'Platinum 80'], ['Gold 95V · Gold 80V', 'S9V2'], ['Silver 95H · Silver 80H', 'S9X2 · S8X2'], ['Freedom 80 / 90', 'S8B1 · S9B1 · S8X1 · S9X1']]
  const slotsD = X.series.map((x: any, i: number) => ({tag: find(d, x.tag), name: find(d, x.name), summary: find(d, x.summary), weDo: x.weDo.map((t: string) => find(d, t)), chips: chipsD[i].map((t) => find(d, t))}))
  M.series.forEach((s: any, i: number) => {
    const sl = slotsD[i]
    setT(sl.tag, s.tag); setT(sl.name, s.name); setT(sl.summary, s.summary); sl.weDo.forEach((e: HTMLElement, j: number) => setT(e, s.weDo[j]))
    const [c1, c2] = Array.isArray(s.modelChips) && s.modelChips.filter(has).length ? s.modelChips.filter(has) : join2(s.models)
    setT(sl.chips[0], c1); if (c2) setT(sl.chips[1], c2); else pill(sl.chips[1], 2).remove()
  })
  const chipsM = ['Platinum 95 · Platinum 80', 'Gold 95V · Gold 80V · S9V2', 'Silver 95H · 80H · S9X2 · S8X2', 'Freedom 80/90 · S8B1 · S9B1 · S9X1']
  const weDoM = [['AccuLink control faults, read from the thermostat', 'Variable-speed blower motor and module repair', 'Modulating gas valve set-up'],
    ['Inducer motor and pressure switch repair', 'Both gas-valve stages checked and set', "Control board tested before it's replaced"],
    ['Ignitor and flame sensor, same visit', 'Overheating and limit-switch fixes', 'Burner and blower wheel cleaning'],
    ['Discontinued parts sourced, or a genuine fit', 'Heat exchanger and CO check every visit', 'Repair vs replace numbers, side by side']]
  const slotsM = X.series.map((x: any, i: number) => ({tag: find(m, x.tag), name: find(m, x.name), chips: find(m, chipsM[i]), weDo: weDoM[i].map((t) => find(m, t))}))
  M.series.forEach((s: any, i: number) => {
    const sl = slotsM[i]
    setT(sl.tag, s.tag); setT(sl.name, s.name)
    setT(sl.chips, mob(p, `models.mobile.series[${i}].models`, s.models.join(' · ')))
    sl.weDo.forEach((e: HTMLElement, j: number) => setT(e, mob(p, `models.mobile.series[${i}].weDo[${j}]`, s.weDo[j])))
  })
  setT(find(m, 'MODELS WE SERVICE · 4 SERIES'), mob(p, 'models.mobile.eyebrow', M.eyebrow))
  setT(find(m, "Find your series. Here's what we do for it."), mob(p, 'models.mobile.h2', M.h2))
  setT(find(m, 'Swipe for Gold, Silver, older'), mob(p, 'models.mobile.swipeHint', `Swipe for ${M.series.slice(1).map((s: any) => s.name).join(', ')}`))
  retag(find(d, X.h2), 'h2')
}

R.services = (root, {p}) => {
  const S = p.services, X = EXAMPLE.services
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  // desktop: the four tab boxes switch the four group panels (Paper keeps groups 2-4 hidden)
  const tabEls = X.groups.map((g: any) => pill(find(d, g.name, 0)))
  const panels = X.groups.map((g: any) => find(d, g.name, 1).parentNode.parentNode as HTMLElement)
  panels.forEach((pn: HTMLElement) => pn.setAttribute('style', (pn.getAttribute('style') || '').replace(/display:none/, 'display:flex')))
  tabs(tabEls[0].parentNode.parentNode as HTMLElement, tabEls, panels)
  // phone: short tab labels, then one list per group (Paper draws group 1 only)
  const tabsM = ['REPAIR & NO-HEAT', 'CLEANING & TUNE-UPS', 'SAFETY & PARTS', 'REPLACE'].map((t) => find(m, t))
  tabsM.forEach((e, i) => setT(e, mob(p, `services.mobile.tabs[${i}]`, S.groups[i].name)))
  const titlesM = ['No-heat emergency repair', 'Ignitor & flame sensor', 'Inducer & pressure switch', 'Board, gas valve & blower']
  const listM = find(m, titlesM[0]).parentNode.parentNode.parentNode as HTMLElement
  let prevList = listM
  const listsM = S.groups.map((g: any, gi: number) => {
    const list = gi === 0 ? listM : clone(listM)
    const rows = kids(list)
    g.services.forEach((sv: any, i: number) => {
      const row = rows[i]; const [t, dsc] = textEls(row)
      setT(t, gi === 0 ? mob(p, `services.mobile.titles[${i}]`, sv.title) : sv.title)
      setT(dsc, sv.mobileDescription || sv.description)
    })
    if (gi) { insertAfter(list, prevList); prevList = list }
    return list
  })
  tabs(pill(tabsM[0]).parentNode.parentNode as HTMLElement, tabsM.map((e) => pill(e)), listsM)
  retag(find(d, X.h2), 'h2')
}

R['recent-jobs'] = (root, {p}) => {
  const J = p.recentJobs
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  const where = ['Lakeview · January 2026', 'Portage Park · December 2025', 'Evanston · February 2026']
  const whereD = where.map((t) => find(d, t)), whereM = where.map((t) => find(m, t))
  const mText = ['Found a coated flame sensor. Cleaned it and the burners, then tested the flame signal.', 'Found a cracked ignitor. Fitted a genuine one from the van and checked the gas valve.', 'Snow over the vent and a failing inducer. Cleared it and replaced the inducer under warranty.'].map((t) => find(m, t))
  const mOut = [find(m, 'Fixed first visit', 0), find(m, 'Fixed first visit', 1), find(m, 'Part under warranty')]
  const photosD = startsWith(d, 'Job photo'), photosM = startsWith(m, 'Job photo')
  J.jobs.forEach((j: any, i: number) => {
    setT(whereD[i], `${j.neighborhood} · ${j.month}`); setT(whereM[i], `${j.neighborhood} · ${j.month}`)
    setT(mText[i], mob(p, `recentJobs.mobile.jobs[${i}].text`, `${j.found} ${j.weDid}`))
    setT(mOut[i], mob(p, `recentJobs.mobile.jobs[${i}].outcome`, j.outcome))
    if (has(j.photo)) for (const ph of [photosD[i], photosM[i]]) {
      const frame = ph?.parentNode as HTMLElement
      if (!frame) continue
      frame.setAttribute('style', `${frame.getAttribute('style') || ''};background-image:url(${attr(j.photo)});background-size:cover;background-position:50%`)
      frame.set_content('')
    }
  })
  setT(find(m, 'Furnaces we fixed this winter'), mob(p, 'recentJobs.mobile.h2', J.h2))
  retag(find(d, EXAMPLE.recentJobs.h2), 'h2')
}

R.pricing = (root, {p, w}) => {
  const P = p.pricing, X = EXAMPLE.pricing
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  setT(find(d, 'COMMON AMERICAN STANDARD REPAIRS'), `Common ${w.brand} repairs`)
  const [box, r0] = items(find(d, X.repairs[0].item), find(d, X.repairs[1].item))
  fillRun(box, r0, X.repairs.length, P.repairs, (el, r: any) => { setT(find(el, X.repairs[0].item), r.item); setT(find(el, X.repairs[0].note), r.note); setT(find(el, X.repairs[0].range), r.range) })
  const feeLabelsM = ['DIAGNOSTIC VISIT', 'TUNE-UP & CLEAN', 'AFTER HOURS'].map((t) => find(m, t))
  const feeNotesM = ['Credited when you go ahead', 'Any model, CO test included', 'Nights, weekends, holidays'].map((t) => find(m, t))
  P.fees.forEach((f: any, i: number) => {
    setT(feeLabelsM[i], mob(p, `pricing.mobile.fees[${i}].label`, f.label))
    setT(feeNotesM[i], mob(p, `pricing.mobile.fees[${i}].note`, firstSentence(f.note).replace(/\.$/, '')))
  })
  setT(find(m, 'Our prices, up front'), mob(p, 'pricing.mobile.h2', P.h2))
  // phone: every repair, the first four shown, the rest behind "See all"
  const repM = ['Flame sensor', 'Hot-surface ignitor', 'Pressure switch', 'Control board']
  const [boxM, m0] = items(find(m, repM[0]), find(m, repM[1]))
  fillRun(boxM, m0, 4, P.repairs, (el, r: any, i) => {
    setT(find(el, repM[0]), mob(p, `pricing.mobile.repairs[${i}]`, r.item)); setT(find(el, '$100–$250'), r.range)
    if (i >= 4) el.setAttribute('data-cs-more', '')
  })
  const seeAll = find(m, 'SEE ALL 7 REPAIR PRICES'); setT(seeAll, `See all ${P.repairs.length} repair prices`)
  if (P.repairs.length > 4) retag(pill(seeAll), 'button', {type: 'button', 'data-cs-show-more': ''}).setAttribute('style', `${pill(seeAll).getAttribute('style')};border:0;font:inherit;width:100%`)
  else pill(seeAll).remove()
  setT(find(m, 'Parts and labor · genuine parts · 1-year labor guarantee · under warranty, you pay labor only'), mob(p, 'pricing.mobile.included', P.included.join(' ')))
  link(d, 'GET A WRITTEN PRICE', '#book')
  retag(find(d, X.h2), 'h2')
}

R['service-plan'] = (root, {p, w}) => {
  const S = p.servicePlan, F = p.financing
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  setT(find(d, 'a month, or $179 a year'), `a month, or ${S.plan.priceYearly} a year`)
  setT(find(m, 'SERVICE PLAN & FINANCING'), mob(p, 'servicePlan.mobile.eyebrow', 'Service plan & financing'))
  setT(find(m, 'Keep it running, or spread the cost'), mob(p, 'servicePlan.mobile.h2', 'Keep it running, or spread the cost'))
  setT(find(m, 'COMFORT PLAN'), mob(p, 'servicePlan.mobile.planLabel', S.plan.name.replace(/^City & Suburban /, '')))
  setT(find(m, 'A tune-up every fall, first in line on no-heat calls, 15% off repairs, no after-hours fee.'), mob(p, 'servicePlan.mobile.planBody', S.body.split(/(?<=\.)\s/).slice(-1)[0]))
  setT(find(m, 'FINANCING A NEW FURNACE'), mob(p, 'servicePlan.mobile.financingLabel', `Financing a new ${w.eqL}`))
  setT(find(m, 'Approval on site, no hit to your credit score'), mob(p, 'servicePlan.mobile.approval', F.options[2].title))
  setT(find(m, 'REBATES'), mob(p, 'servicePlan.mobile.rebatesTitle', F.rebates.title))
  setT(find(m, 'On 95% furnaces. We fill in the forms.'), mob(p, 'servicePlan.mobile.rebatesBody', F.rebates.body))
  for (const el of [d, m]) { link(el, EXAMPLE.servicePlan.plan.cta.toUpperCase(), business.scheduleHref) }
  retag(find(d, EXAMPLE.servicePlan.h2), 'h2')
}

R.financing = (root) => {
  link(root, EXAMPLE.financing.rebates.cta.toUpperCase(), business.scheduleHref)
  retag(find(root.querySelector('.cs31-d')!, EXAMPLE.financing.h2), 'h2')
}

R['who-you-call'] = (root, {p}) => {
  const W = p.whoYoureCalling
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  setT(find(d, 'Nobody is on commission, so “your furnace is fine” means it\'s fine.'), W.whyFamily[2])
  setT(find(m, "Who you're actually calling"), mob(p, 'whoYoureCalling.mobile.h2', W.h2.replace(/\?$/, '')))
  setT(find(m, 'One family since 1952. Rob, the owner, still takes the calls and diagnoses the American Standard jobs that need it.'), mob(p, 'whoYoureCalling.mobile.intro', W.intro))
  const small = ['Owner, on the calls', 'Family owned, 2nd generation', 'American Standard, genuine parts', 'Call any time'].map((t) => find(m, t))
  small.forEach((e, i) => setT(e, mob(p, `whoYoureCalling.mobile.stats[${i}]`, W.stats[i].label)))
  link(root, '204 Google reviews, as of 31 Aug 2026', business.reviewsHref, true)
  const h2 = textEls(d).find((e) => norm(e.text) === norm("Who you'reactually calling?") || norm(e.text) === norm(EXAMPLE.whoYoureCalling.h2))
  if (h2) retag(h2, 'h2')
}

R.reviews = (root, {p, reviewUrls}) => {
  const V = p.reviews, X = EXAMPLE.reviews
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  const pct = ['44%', '29%', '21%', '14%']
  const statSlots = X.stats.map((s: any, i: number) => ({cd: find(d, String(s.count)), pd: find(d, pct[i]), cm: find(m, String(s.count))}))
  V.stats.forEach((s: any, i: number) => { setT(statSlots[i].cd, String(s.count)); setT(statSlots[i].pd, `${s.percent}%`); setT(statSlots[i].cm, String(s.count)) })
  // the bars under each stat follow the percentages
  for (const e of elements(root)) {
    const st = e.getAttribute('style') || ''
    const i = X.stats.findIndex((s: any) => st.includes(`width:round(${s.percent}%, 1px)`))
    if (i >= 0) e.setAttribute('style', st.replace(`width:round(${X.stats[i].percent}%, 1px)`, `width:round(${V.stats[i].percent}%, 1px)`))
  }
  const d2 = d, m2 = m
  const labelsM = ['name Rob, or dealt with the owner directly', 'mention a fast response or same-day visit', 'call the price fair, reasonable or competitive', 'mention honesty, trust or no upselling'].map((t) => tryFind(m2, t))
  labelsM.forEach((e, i) => { if (e) setT(e, mob(p, `reviews.mobile.stats[${i}]`, V.stats[i].label)) })
  setT(find(d2, 'Counted by keyword matching across all 204 Google reviews (export of 31 Aug 2026), so the numbers are approximate. 202 of the 204 are five stars.'), V.statsSource)
  // desktop review cards: 4–8, swipeable with the arrows
  const firstText = 'Rob and Carissa were soooo helpful!'
  const [track, c0] = items(startsWith(d2, firstText)[0], startsWith(d2, 'I had used City and Suburban')[0])
  fillRun(track, c0, 4, V.reviews, (el, r: any) => {
    setT(find(el, 'B'), initial(r.name)); setT(find(el, 'Brandi Clinch'), r.name)
    setT(find(el, 'Google review, 2026'), `${r.source} review, ${r.date}`)
    setT(startsWith(el, firstText)[0], r.text)
    setT(find(el, 'Condo AC repair'), r.tag)
    retag(find(el, 'Read more'), 'a', {href: r.url || reviewUrls[r.name] || business.reviewsHref, target: '_blank', rel: 'noopener'})
  })
  carousel(track, find(d2, '· 204 Google reviews').parentNode as HTMLElement)
  // phone: two quote cards
  const mq = textEls(m2).filter((e) => /^“/.test(decode(ownText(e))))
  const mInit = ['K', 'J'].map((t) => find(m2, t)), mName = ['Ken Davis', 'Jens Pfister'].map((t) => find(m2, t)), mTag = ['Condo furnace repair', 'Condo repairs'].map((t) => find(m2, t))
  const mDates = [find(m2, 'Google review, 2026', 0), find(m2, 'Google review, 2026', 1)]
  ;[0, 1].forEach((i) => {
    const pick = getPath(p, `reviews.mobile.reviews[${i}]`) as {name?: string; text?: string} | undefined
    const r = V.reviews.find((x: any) => has(pick?.name) && x.name === pick?.name) || V.reviews[i]
    setT(mq[i], `“${has(pick?.text) ? pick?.text : r.text}”`)
    setT(mInit[i], initial(r.name)); setT(mName[i], r.name); setT(mTag[i], r.tag); setT(mDates[i], `${r.source} review, ${r.date}`)
  })
  link(d2, 'write a review', business.reviewsHref, true); link(d2, 'Review on Google', business.reviewsHref); link(d2, 'Review on Yelp', YELP)
  link(root, '204 Google reviews', business.reviewsHref, true); link(d2, '· 204 Google reviews', business.reviewsHref, true)
  retag(find(d2, X.h2), 'h2')
}

/** A scrolling track with prev/next arrows: the two round buttons at the end of `controls`. */
function carousel(track: HTMLElement, controls: HTMLElement) {
  const wrap = track.parentNode as HTMLElement
  wrap.setAttribute('data-cs-carousel', '')
  track.setAttribute('data-cs-track', '')
  track.setAttribute('style', `${(track.getAttribute('style') || '').replace(/overflow:clip/, '')};overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none`)
  kids(track).forEach((k) => k.setAttribute('style', `${k.getAttribute('style') || ''};scroll-snap-align:start;flex-shrink:0`))
  const arrows = kids(controls).filter((k) => /height:36px/.test(k.getAttribute('style') || '')).slice(-2)
  if (arrows.length === 2) {
    retag(arrows[0], 'button', {type: 'button', 'data-cs-prev': '', 'aria-label': 'Previous'})
    retag(arrows[1], 'button', {type: 'button', 'data-cs-next': '', 'aria-label': 'Next'})
    arrows.forEach((a) => a.setAttribute('style', `${a.getAttribute('style')};padding:0;font:inherit`))
  }
}

R.process = (root, {p}) => {
  const P = p.process
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  const n = P.steps.length
  setT(find(d, 'THE PROCESS · 6 STEPS'), P.eyebrow)
  setT(find(d, 'From the first call to a warm house, in six steps'), P.intro)
  setT(find(d, '/ 06'), `/ ${String(n).padStart(2, '0')}`)
  setT(find(d, 'Swipe or use the arrows to see all 6 steps'), `Swipe or use the arrows to see all ${n} steps`)
  const dot = find(d, '6').parentNode as HTMLElement; const prev = dot.previousElementSibling; if (prev && !prev.childNodes.length) prev.remove(); dot.remove()
  const bodiesM = ['Read us the model number and what the light is doing.', '24/7, and no-heat goes to the front of the line.', 'We read the code and show you the failed part.', 'If the furnace has years left, we repair it.', 'On the spot when the part is on the van.'].map((t) => find(m, t))
  const titlesM = EXAMPLE.process.steps.map((s: any, i: number) => tryFind(m, i === 3 ? 'Written price first' : s.title))
  bodiesM.forEach((e, i) => setT(e, mob(p, `process.mobile.steps[${i}].body`, P.steps[i].body)))
  titlesM.forEach((e: HTMLElement | null, i: number) => { if (e) setT(e, mob(p, `process.mobile.steps[${i}].title`, P.steps[i].title)) })
  find(d, '01').setAttribute('data-cs-counter', '')
  const cards = startsWith(d, '01').map((e) => e.parentNode.parentNode as HTMLElement).find((c) => /width:280px/.test(c.getAttribute('style') || ''))
  if (cards) {
    const track = cards.parentNode as HTMLElement
    const controls = find(d, '/ 05').parentNode.parentNode as HTMLElement
    carousel(track, kids(controls).slice(-1)[0])
  }
  retag(find(d, EXAMPLE.process.h2), 'h2')
}

R['service-areas'] = (root, {p, w}) => {
  const A = p.serviceArea
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  textEls(d).filter((e) => norm(ownText(e)) === 'american standard units we see').forEach((e) => setT(e, `${w.brand} units we see`))
  const nbM = ['Lincoln Park, Lakeview, Ravenswood, Edgewater, Rogers Park', 'Logan Square, Irving Park, Portage Park, Jefferson Park', 'Wicker Park, Bucktown, Pilsen, Bridgeport, Hyde Park, Beverly', 'Evanston, Skokie, Oak Park, Berwyn, Park Ridge, Oak Lawn'].map((t) => find(m, t))
  nbM.forEach((e, i) => setT(e, mob(p, `serviceArea.mobile.areas[${i}].neighborhoods`, A.areas[i].neighborhoods.replace(/\.$/, ''))))
  setT(find(m, 'West & South'), mob(p, 'serviceArea.mobile.areas[2].name', A.areas[2].name))
  setT(find(m, 'WHERE WE WORK · 4 AREAS'), mob(p, 'serviceArea.mobile.eyebrow', `Where we work · ${A.areas.length} areas`))
  // the map placeholder becomes the map
  const src = has(A.mapEmbedUrl) ? A.mapEmbedUrl : MAP_FALLBACK
  for (const [layout, label] of [[d, 'Map of our Chicago service area'], [m, 'Map of our service area']] as const) {
    const frame = find(layout, label).parentNode as HTMLElement
    frame.setAttribute('style', `${frame.getAttribute('style') || ''};padding:0;overflow:hidden`)
    frame.set_content(`<iframe src="${attr(src)}" title="Map of the City &amp; Suburban service area" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="border:0;width:100%;height:100%;display:block"></iframe>`)
  }
  retag(find(d, EXAMPLE.serviceArea.h2), 'h2')
}

R.faq = (root, {p}) => {
  const F = p.faq
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  setT(find(d, 'Family owned, licensed, NATE-certified'), mob(p, 'faq.trustLine', 'Family owned, Rob on the calls'))
  link(d, 'CALL (773) 238-3838', business.phoneHref)
  link(d, '204 Google reviews', business.reviewsHref, true)
  // desktop accordion: every item drawn like the open first item, closed ones restyled by CSS
  const q0 = find(d, EXAMPLE.faq.items[0].question)
  const open = q0.parentNode.parentNode as HTMLElement
  const list = open.parentNode as HTMLElement
  const closedIcon = kids(kids(list)[1]).slice(-1)[0].toString()
  fillRun(list, open, 5, F.items, (el, item: any, i) => {
    el.setAttribute('class', `cs31-faq${i === 0 ? ' is-open' : ''}`)
    el.setAttribute('data-cs-faq', '')
    const [num] = kids(el); setT(num, String(i + 1).padStart(2, '0'))
    const [q, a] = textEls(kids(el)[1]); setT(q, item.question); setT(a, item.answer)
    retag(q, 'h3'); a.setAttribute('data-cs-answer', '')
    const icon = kids(el).slice(-1)[0]; icon.setAttribute('data-cs-icon-open', '')
    const ci = kids(parse(closedIcon))[0]; ci.setAttribute('data-cs-icon-closed', ''); insertAfter(ci, icon)
  })
  // phone accordion
  setT(find(m, 'Questions, answered'), mob(p, 'faq.mobile.h2', 'Questions, answered'))
  const mq0 = find(m, 'Will your repair affect my warranty?')
  const openM = mq0.parentNode.parentNode as HTMLElement
  const listM = openM.parentNode as HTMLElement
  fillRun(listM, openM, 5, F.items, (el, item: any, i) => {
    el.setAttribute('class', `cs31-faq${i === 0 ? ' is-open' : ''}`)
    el.setAttribute('data-cs-faq', '')
    const [q, sign] = textEls(kids(el)[0]); const a = kids(el)[1]
    setT(q, mob(p, `faq.mobile.items[${i}].question`, item.question)); setT(sign, i === 0 ? '−' : '+')
    sign.setAttribute('data-cs-sign', '')
    setT(a, i === 0 ? mob(p, 'faq.mobile.firstAnswer', item.answer) : item.answer); a.setAttribute('data-cs-answer', '')
  })
  retag(find(d, EXAMPLE.faq.h2), 'h2')
}

R['closing-cta'] = (root, {p}) => {
  const m = root.querySelector('.cs31-m')!
  setT(find(m, "Have the model number from the plate inside the lower door ready. We'll bring the right parts."), mob(p, 'closingCta.mobile.body', p.closingCta.body))
  link(root, 'CALL (773) 238-3838', business.phoneHref)
  link(root.querySelector('.cs31-d')!, 'SCHEDULE SERVICE', '#book')
  link(root, '204 Google reviews', business.reviewsHref, true)
  retag(find(root.querySelector('.cs31-d')!, EXAMPLE.closingCta.h2), 'h2')
}

R['other-brands'] = (root, {p, w, published}) => {
  const L = p.siblingLinks
  const d = root.querySelector('.cs31-d')!, m = root.querySelector('.cs31-m')!
  setT(find(d, 'NOT AN AMERICAN STANDARD FURNACE?'), `Not ${/^[aeiou]/i.test(w.brand) ? 'an' : 'a'} ${w.brand} ${w.eqL}?`)
  for (const el of [d, m]) {
    setT(find(el, 'Other American Standard equipment'), `Other ${w.brand} equipment`)
    setT(find(el, 'Furnace repair for other brands'), `${w.eq} ${w.serviceL} for other brands`)
  }
  // rows: this page's links; a row links only when that brand page is live, otherwise it stays a plain line
  const columns = kids(kids(kids(d)[0])[1])
  ;[L.otherEquipment, L.otherBrands].forEach((list: any[], ci: number) => {
    const rows = kids(columns[ci]).slice(1)
    fillRun(columns[ci], rows[0], rows.length, list, (row, r: any) => {
      setT(textEls(row)[0], r.label)
      if (published.has(r.url)) retag(row, 'a', {href: `/services${r.url}`})
    })
  })
  // phone: each heading opens its list (Paper draws the headings only)
  kids(kids(m)[0]).forEach((head, i) => {
    const col = columns[i]; if (!col) return
    const list = clone(col); kids(list)[0].remove()
    list.setAttribute('data-cs-answer', ''); list.setAttribute('style', `${list.getAttribute('style') || ''};padding-top:8px`)
    const item = kids(parse(`<div class="cs31-faq" data-cs-faq></div>`))[0]
    insertBefore(item, head); head.remove(); item.appendChild(head); item.appendChild(list)
  })
  retag(find(d, 'Other equipment and brands we service'), 'h2')
}

// ------------------------------------------------------------------ assemble
const DROP = /^CONFIRM:/

export function renderBrandPage(page: BrandPageContent, opts: {published?: Iterable<string>; reviewUrls?: Record<string, string>; chrome?: boolean} = {}): RenderedBrandPage {
  const w: Words = {brand: page.meta.brand, eq: page.meta.equipment, eqL: page.meta.equipment.toLowerCase(), service: page.meta.service, serviceL: page.meta.service.toLowerCase()}
  const ctx: Ctx = {p: page, w, published: new Set(opts.published || []), reviewUrls: opts.reviewUrls || {}}
  const sections = SECTIONS.filter((s) => opts.chrome || !CHROME.has(s.module)).map((s) => {
    const root = parse(s.html)
    for (const e of textEls(root)) if (DROP.test(decode(ownText(e)).trim())) (e.closest('[style*="border-style:dashed"]') || e).remove()
    const auto = textEls(root).map((e) => [e, exPath(s.module, ownText(e))] as const).filter(([, path]) => path && !path.startsWith('meta.'))
    touched = new Set()
    if (R[s.module]) R[s.module](root, ctx)
    const live = new Set(elements(root))
    for (const [e, path] of auto) {
      if (!live.has(e) || touched.has(e)) continue
      const v = getPath(page, path!)
      if (typeof v === 'string' && norm(ownText(e)) === norm(getPath(EXAMPLE, path!))) setT(e, v)
    }
    const section = kids(root)[0]
    if (SECTION_IDS[s.module]) section.setAttribute('id', SECTION_IDS[s.module])
    return {module: s.module, label: s.label, html: root.toString()}
  })
  return {sections, html: sections.map((s) => s.html).join('')}
}
