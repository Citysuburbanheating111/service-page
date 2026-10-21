// Extra sections for the service landing pages, added around the stored page HTML:
// - "<Service> Work We Handle": the auto-scrolling strip from the Highlights Chicago
//   service pages (same markup, timing and pause-on-hover), in City & Suburban colours.
// - A 24/7 band: any job, big or small, gets round-the-clock service.
// The equipment listing ("systems" section) is restyled in CSS to the Highlights
// "Parts of..." tiles; its copy is not touched.

import workItems from '@/data/work-we-handle.json'

export type WorkItem = {title: string; text: string; icon: string}

const PHONE_HREF = 'tel:+17732383838'
const PHONE_DISPLAY = '(773) 238-3838'

// 48 x 48 line icons in the Highlights style: a filled base shape plus `ln` strokes.
const icons: Record<string, string> = {
  furnace: '<rect x="12" y="8" width="24" height="32" rx="3"/><path class="ln" d="M18 15h12M18 21h12"/><circle class="ln" cx="24" cy="31" r="3"/>',
  flame: '<path d="M24 8c4 6 10 10 10 18a10 10 0 0 1-20 0c0-5 3-8 5-11 1 4 3 5 5 5-2-4-1-8 0-12z"/>',
  fan: '<circle cx="24" cy="24" r="15"/><path class="ln" d="M24 24c0-6 3-9 7-8M24 24c-6 0-9 3-8 7M24 24c6 0 9-3 8-7M24 24c0 6-3 9-7 8"/>',
  thermostat: '<rect x="11" y="11" width="26" height="26" rx="13"/><path class="ln" d="M24 17v7l4 3"/>',
  gauge: '<circle cx="24" cy="26" r="14"/><path class="ln" d="M24 26l7-7M17 34h14"/>',
  wrench: '<path d="M31 8a8 8 0 0 0-7 11L11 32a3 3 0 0 0 5 5l13-13a8 8 0 0 0 11-7l-5 3-4-1-1-4z"/>',
  pipe: '<rect x="8" y="18" width="32" height="12" rx="3"/><path class="ln" d="M16 18v12M32 18v12"/>',
  drop: '<path d="M24 8c6 9 11 14 11 20a11 11 0 0 1-22 0c0-6 5-11 11-20z"/><path class="ln" d="M19 29a5 5 0 0 0 5 5"/>',
  snowflake: '<circle cx="24" cy="24" r="5"/><path class="ln" d="M24 8v32M10 16l28 16M10 32l28-16"/>',
  filter: '<rect x="10" y="10" width="28" height="28" rx="3"/><path class="ln" d="M17 10v28M24 10v28M31 10v28"/>',
  duct: '<rect x="8" y="16" width="32" height="16" rx="2"/><path class="ln" d="M14 16v16M34 16v16M20 24h8"/>',
  bolt: '<rect x="12" y="8" width="24" height="32" rx="3"/><path class="ln" d="M26 14l-6 10h8l-6 10"/>',
  clipboard: '<rect x="12" y="8" width="24" height="32" rx="3"/><path class="ln" d="M18 16h12M18 22h12M18 28h12"/>',
  shield: '<path d="M24 8l13 5v10c0 9-6 15-13 18-7-3-13-9-13-18V13z"/><path class="ln" d="M18 24l4 4 8-8"/>',
  building: '<rect x="12" y="9" width="24" height="31" rx="2"/><path class="ln" d="M18 16h4M26 16h4M18 22h4M26 22h4M18 28h4M26 28h4M22 40v-6h4v6"/>',
  home: '<path d="M8 24 24 10l16 14v16H8z"/><path class="ln" d="M20 40V30h8v10"/>',
  clock: '<circle cx="24" cy="24" r="15"/><path class="ln" d="M24 15v9l6 4"/>',
  vent: '<rect x="10" y="12" width="28" height="24" rx="3"/><path class="ln" d="M16 19h16M16 24h16M16 29h16"/>',
  radiator: '<rect x="10" y="12" width="28" height="24" rx="3"/><path class="ln" d="M17 16v16M24 16v16M31 16v16"/>',
  plug: '<rect x="16" y="18" width="16" height="14" rx="3"/><path class="ln" d="M20 18v-8M28 18v-8M24 32v8"/>',
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const smallWords = new Set(['a', 'an', 'and', 'or', 'of', 'the', 'for', 'to', 'in', 'on'])
function titleCase(name: string) {
  return name.split(' ').map((word, index) => index && smallWords.has(word.toLowerCase())
    ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function getWorkItems(clusterSlug: string, slug: string): WorkItem[] | undefined {
  return (workItems as Record<string, WorkItem[]>)[`${clusterSlug}/${slug}`]
}

export function workWeHandleSection(serviceName: string, items: WorkItem[]): string {
  const heading = `${titleCase(serviceName)} Work We Handle`
  const item = (work: WorkItem, clone: boolean) => `<div class="cs-work-item"${clone ? ' aria-hidden="true"' : ''}><svg viewBox="0 0 48 48" aria-hidden="true">${icons[work.icon] || icons.clipboard}</svg><b>${escapeHtml(work.title)}</b><span>${escapeHtml(work.text)}</span></div>`
  return `<section data-module="work-we-handle" class="cs-work" id="work-we-handle"><div class="cs-work-wrap">`
    + `<p class="cs-work-eyebrow">Service types</p><h2>${escapeHtml(heading)}</h2>`
    + `<p class="cs-work-lede">Common ${escapeHtml(serviceName.toLowerCase())} jobs City &amp; Suburban handles for Chicago homes and businesses.</p>`
    + `<div class="cs-work-strip" aria-label="${escapeHtml(heading)}"><div class="cs-work-track">`
    + items.map(work => item(work, false)).join('') + items.map(work => item(work, true)).join('')
    + `</div></div><p class="cs-work-note">Final recommendations follow the installed conditions, equipment instructions and applicable Chicago requirements.</p></div></section>`
}

export function allDaySection(): string {
  return `<section data-module="service-24-7" class="cs-247" id="open-24-7"><div class="cs-247-wrap">`
    + `<div class="cs-247-copy"><p class="cs-247-eyebrow">Open 24 hours, 7 days a week</p>`
    + `<h2>24/7 service, whatever the size of the job</h2>`
    + `<p>A small fix or a full breakdown, City &amp; Suburban answers around the clock, every day of the week. Call any time, day or night, and describe the problem.</p>`
    + `<ul class="cs-247-points"><li>Big jobs and small jobs</li><li>Day, night and weekends</li><li>One number: ${PHONE_DISPLAY}</li></ul></div>`
    + `<div class="cs-247-side"><div class="cs-247-badge"><b>24/7</b><span>Always open</span></div>`
    + `<a class="cs-247-call" href="${PHONE_HREF}">Call ${PHONE_DISPLAY}</a><a class="cs-247-book" href="#book">Request service</a></div>`
    + `</div></section>`
}

/** Insert `extra` right after the section whose data-module is `module` (unchanged if it is missing). */
export function insertAfterModule(html: string, module: string, extra: string): string {
  const start = new RegExp(`<section\\b[^>]*\\bdata-module="${module}"[^>]*>`, 'i').exec(html)
  if (!start) return html
  const tags = /<\/?section\b[^>]*>/gi
  tags.lastIndex = start.index
  let depth = 0
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += /^<\//.test(tag[0]) ? -1 : 1
    if (depth === 0) return html.slice(0, tags.lastIndex) + extra + html.slice(tags.lastIndex)
  }
  return html
}

/** The equipment listing's eyebrow label reads "Equipment types" on every page. */
export function withEquipmentTypesLabel(html: string): string {
  return html.replace(/(<section\b[^>]*\bdata-module="systems"[^>]*>\s*<div\b[^>]*>\s*<p\b[^>]*>)[\s\S]*?(<\/p>)/, '$1Equipment types$2')
}

/** Add the work strip after the quick facts and the 24/7 band after the pricing section.
 * Pages without work items (services City & Suburban refers out) get neither. */
export function withServicePageSections(html: string, serviceName: string, items?: WorkItem[]): string {
  const labelled = withEquipmentTypesLabel(html)
  if (!items?.length) return labelled
  return insertAfterModule(insertAfterModule(labelled, 'quick-facts', workWeHandleSection(serviceName, items)), 'pricing', allDaySection())
}
