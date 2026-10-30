#!/usr/bin/env node
// Generate the brand page content fields (src/sanity/schemaTypes/brandPageContent.ts) from the brand page
// shape: the reference page (src/brand-pages/slot-reference.json), its character limits
// (src/brand-pages/field-spec.json) and the phone-layout fields below. Run again when the Paper design
// or the citysuburban-brand-service-pages skill adds a field.
//   node scripts/generate-brand-page-schema.mjs
import fs from 'node:fs'

const reference = JSON.parse(fs.readFileSync('src/brand-pages/slot-reference.json', 'utf8'))
const spec = JSON.parse(fs.readFileSync('src/brand-pages/field-spec.json', 'utf8')).fields

// Fields beyond the reference copy: images (illustrative photos, CC0 or public domain) and the phone layout,
// where Paper's phone artboard uses shorter copy (empty = derived from the desktop copy).
const phone = {
  meta: {imageSources: [{slot: '', url: '', license: '', title: '', source: ''}]},
  hero: {image: '', modelFieldLabel: '', mobile: {symptomsHeading: '', symptomChips: ['']}},
  models: {series: [{modelChips: ['']}], mobile: {eyebrow: '', h2: '', swipeHint: '', series: [{models: '', weDo: ['']}]}},
  services: {mobile: {tabs: [''], titles: ['']}},
  recentJobs: {mobile: {h2: '', jobs: [{text: '', outcome: ''}]}},
  pricing: {mobile: {h2: '', fees: [{label: '', note: ''}], repairs: [''], included: ''}},
  servicePlan: {mobile: {eyebrow: '', h2: '', planLabel: '', planBody: '', financingLabel: '', approval: '', rebatesTitle: '', rebatesBody: ''}},
  whoYoureCalling: {image: '', mobile: {h2: '', intro: '', stats: ['']}},
  reviews: {reviews: [{url: ''}], mobile: {stats: [''], reviews: [{name: '', text: ''}]}},
  process: {mobile: {steps: [{title: '', body: ''}]}},
  serviceArea: {mobile: {eyebrow: '', areas: [{name: '', neighborhoods: ''}]}},
  faq: {image: '', trustLine: '', mobile: {h2: '', items: [{question: ''}], firstAnswer: ''}},
  closingCta: {image: '', mobile: {body: ''}},
}
function merge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length && typeof a[0] === 'object' ? a.map((x) => merge(x, b[0])) : a
  if (a && typeof a === 'object' && b && typeof b === 'object') { const o = {...a}; for (const [k, v] of Object.entries(b)) o[k] = k in o ? merge(o[k], v) : v; return o }
  return a ?? b
}
const shape = merge(reference, phone)

// Studio tabs in the order of the Paper design (brand-service-landing-page layout, Oct 29 2026).
const SECTIONS = {
  meta: 'Page details & keywords', hero: 'Hero & booking form', services: 'Services we do', models: 'Models we service',
  modelTable: 'Services for each model (table)', parts: 'Parts we look after', comparison: 'Which one fits (comparison)', sizing: 'Sizing',
  estimateChecks: 'What we check before we quote', installations: 'Installations', recentJobs: 'Recent jobs',
  pricing: 'What we charge', servicePlan: 'Yearly service plan', financing: 'Financing', whoYoureCalling: "Who you're calling", reviews: 'Reviews',
  trustBand: 'Trust band', process: 'Process', serviceArea: 'Service area & map', faq: 'FAQ', closingCta: 'Closing call to action', siblingLinks: 'Other brands & equipment',
  library: 'Chicago heating library',
}
const LABELS = {
  h1Accent: 'H1 second line (accent colour)', secondaryCta: 'Second button', formTitleAccent: 'Form title, accent word', needOptions: '"What do you need?" options',
  modelChoices: 'Model chips in the form', modelChoicesLabel: 'Model chips question', onThisPage: '"On this page" chips', jumpTabs: 'Jump tabs (phone)',
  calloutTitle: 'Callout title', calloutBody: 'Callout text', drawing: 'Line drawing', countLabel: 'Count label', routesHeading: 'Routes heading', routesNote: 'Routes note',
  inThisGuide: '"In this guide" links', tilesSource: 'Tiles source line', sourceNote: 'Price source note', mapPins: 'Map pins', partnerBrands: 'Partner brand logos', relatedCards: 'Related service cards',
  footerLabel: 'Card footer label', h1: 'H1', h2: 'H2 heading', labels: 'Small labels (optional: empty keeps the design text)', weDo: 'What we do', seoTitle: 'SEO title', metaDescription: 'Meta description', mobile: 'Phone layout (optional: empty uses the desktop copy)',
  lede: 'Intro paragraph', cta: 'Button', url: 'Link', sourceRef: 'Invoice / job reference', mapEmbedUrl: 'Google Maps embed link', faq: 'FAQ',
  tag: 'Tag', modelFieldPlaceholder: 'Model field placeholder', modelFieldLabel: 'Model field label', valueStrip: 'Value strip', haveReady: 'Have these ready',
  whyFamily: 'Why a family company matters', whyFamilyHeading: 'Why family heading', unitsWeSee: 'Units we see', statsSource: 'Stats source',
  image: 'Image (https link)', photo: 'Photo (https link)', imageSources: 'Image sources (internal, never shown)', modelChips: 'Model chips (desktop, optional: up to 2 lines)', trustLine: 'Trust line under the rating (optional)', priceYearly: 'Price per year', priceMonthly: 'Price per month', priceDate: 'Prices as of', firstAnswer: 'First answer', swipeHint: 'Swipe hint',
}
const human = (k) => LABELS[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (m, c) => ' ' + c.toLowerCase())
const limit = (path) => spec[path]?.maxLen
const q = (s) => JSON.stringify(s)
const indent = (s, n) => s.split('\n').map((l) => ' '.repeat(n) + l).join('\n')

function field(key, value, path) {
  const title = human(key)
  const max = limit(path)
  const desc = max ? `, description: ${q(`Up to ${max} characters.`)}` : ''
  if (typeof value === 'boolean') return `defineField({name: ${q(key)}, title: ${q(title)}, type: 'boolean'})`
  if (typeof value === 'number') return `defineField({name: ${q(key)}, title: ${q(title)}, type: 'number'})`
  if (typeof value === 'string') {
    const long = (max && max >= 120) || value.length > 100
    return `defineField({name: ${q(key)}, title: ${q(title)}, type: ${long ? "'text', rows: 3" : "'string'"}${desc}})`
  }
  if (Array.isArray(value)) {
    const first = value.find((x) => x != null)
    const count = spec[path]?.count ? `, description: ${q(`${spec[path].count} items.`)}` : ''
    if (first && typeof first === 'object') {
      const all = value.reduce((o, x) => merge(o, x), {})
      const keys = Object.keys(all)
      const titleKey = keys.find((k) => typeof all[k] === 'string') || keys[0]
      return `defineField({name: ${q(key)}, title: ${q(title)}, type: 'array'${count}, of: [defineArrayMember({type: 'object', name: ${q(key.replace(/s$/, '') + 'Item')}, fields: [\n${indent(keys.map((k) => field(k, all[k], `${path}[].${k}`)).join(',\n'), 2)}\n], preview: {select: {title: ${q(titleKey)}}}})]})`
    }
    const long = (limit(`${path}[]`) || 0) >= 120 || (typeof first === 'string' && first.length > 100)
    return `defineField({name: ${q(key)}, title: ${q(title)}, type: 'array'${count}, of: [defineArrayMember({type: ${long ? "'text'" : "'string'"}})]})`
  }
  if (value && typeof value === 'object') {
    return `defineField({name: ${q(key)}, title: ${q(title)}, type: 'object', options: {collapsible: true, collapsed: ${key === 'mobile'}}, fields: [\n${indent(Object.entries(value).map(([k, v]) => field(k, v, `${path}.${k}`)).join(',\n'), 2)}\n]})`
  }
  return `defineField({name: ${q(key)}, title: ${q(title)}, type: 'string'})`
}

const groups = Object.entries(SECTIONS).map(([name, title]) => `{name: ${q(name)}, title: ${q(title)}}`)
const fields = Object.keys(SECTIONS).map((key) => field(key, shape[key], key).replace(/^defineField\(\{/, `defineField({group: ${q(key)}, `))
const out = `// Generated by scripts/generate-brand-page-schema.mjs from the brand page shape. Do not edit by hand.
import {defineArrayMember, defineField} from 'sanity'

/** One Studio tab per section of the Paper brand page design. */
export const brandPageContentGroups = [
${indent(groups.join(',\n'), 2)},
]

/** Every text slot of the design, in the shape the citysuburban-brand-service-pages skill writes. */
export const brandPageContentFields = [
${indent(fields.join(',\n'), 2)},
]
`
fs.writeFileSync('src/sanity/schemaTypes/brandPageContent.ts', out)
console.log('wrote src/sanity/schemaTypes/brandPageContent.ts', out.length, 'chars,', (out.match(/defineField\(/g) || []).length, 'fields')
