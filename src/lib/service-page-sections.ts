// Extra sections for the service landing pages, added around the stored page HTML:
// - "<Service> Work We Handle": the auto-scrolling strip from the Highlights Chicago
//   service pages (same markup, timing and pause-on-hover), in City & Suburban colours.
// - A 24/7 band: any job, big or small, gets round-the-clock service.
// The equipment listing ("systems" section) is restyled in CSS to the Highlights
// "Parts of..." tiles; its copy is not touched.
// Shared copy comes from the Sanity Service-page template ("V1 design system: shared
// sections"); each page's items come from its own "Work We Handle strip" field, with
// src/data/work-we-handle.json as the fallback for pages not yet edited in Sanity.

import workItems from '@/data/work-we-handle.json'
import type {WorkIconName} from './work-icons'

export type WorkItem = {title: string; text: string; icon: string}

/** The template's shared section copy; any field left empty falls back to the default. */
export type ServiceSectionsDesign = {
  workEyebrow?: string
  workHeadingSuffix?: string
  workLede?: string
  workNote?: string
  equipmentLabel?: string
  allDayEyebrow?: string
  allDayHeading?: string
  allDayText?: string
  allDayPoints?: string[]
  allDayBadge?: string
  allDayBadgeLabel?: string
  phoneDisplay?: string
  phoneHref?: string
  requestLabel?: string
}

export const defaultServiceSections: Required<ServiceSectionsDesign> = {
  workEyebrow: 'Service types',
  workHeadingSuffix: 'Work We Handle',
  workLede: 'Common {service} jobs City & Suburban handles for Chicago homes and businesses.',
  workNote: 'Final recommendations follow the installed conditions, equipment instructions and applicable Chicago requirements.',
  equipmentLabel: 'Equipment types',
  allDayEyebrow: 'Open 24 hours, 7 days a week',
  allDayHeading: '24/7 service, whatever the size of the job',
  allDayText: 'A small fix or a full breakdown, City & Suburban answers around the clock, every day of the week. Call any time, day or night, and describe the problem.',
  allDayPoints: ['Big jobs and small jobs', 'Day, night and weekends', 'One number: {phone}'],
  allDayBadge: '24/7',
  allDayBadgeLabel: 'Always open',
  phoneDisplay: '(773) 238-3838',
  phoneHref: 'tel:+17732383838',
  requestLabel: 'Request service',
}

function resolveDesign(design?: ServiceSectionsDesign | null): Required<ServiceSectionsDesign> {
  const resolved = {...defaultServiceSections}
  for (const [key, value] of Object.entries(design || {}) as Array<[keyof ServiceSectionsDesign, unknown]>) {
    if (Array.isArray(value) ? value.some(item => typeof item === 'string' && item.trim()) : typeof value === 'string' && value.trim()) {
      (resolved as Record<string, unknown>)[key] = Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : value
    }
  }
  return resolved
}

// 48 x 48 line icons in the Highlights style: a filled base shape plus `ln` strokes.
const icons: Record<WorkIconName, string> = {
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

export function workWeHandleSection(serviceName: string, items: WorkItem[], design?: ServiceSectionsDesign | null): string {
  const d = resolveDesign(design)
  const heading = `${titleCase(serviceName)} ${d.workHeadingSuffix}`
  const item = (work: WorkItem, clone: boolean) => `<div class="cs-work-item"${clone ? ' aria-hidden="true"' : ''}><svg viewBox="0 0 48 48" aria-hidden="true">${icons[work.icon as WorkIconName] || icons.clipboard}</svg><b>${escapeHtml(work.title)}</b><span>${escapeHtml(work.text)}</span></div>`
  return `<section data-module="work-we-handle" class="cs-work" id="work-we-handle"><div class="cs-work-wrap">`
    + `<p class="cs-work-eyebrow">${escapeHtml(d.workEyebrow)}</p><h2>${escapeHtml(heading)}</h2>`
    + `<p class="cs-work-lede">${escapeHtml(d.workLede).replaceAll('{service}', escapeHtml(serviceName.toLowerCase()))}</p>`
    + `<div class="cs-work-strip" aria-label="${escapeHtml(heading)}"><div class="cs-work-track">`
    + items.map(work => item(work, false)).join('') + items.map(work => item(work, true)).join('')
    + `</div></div><p class="cs-work-note">${escapeHtml(d.workNote)}</p></div></section>`
}

export function allDaySection(design?: ServiceSectionsDesign | null): string {
  const d = resolveDesign(design)
  const phone = escapeHtml(d.phoneDisplay)
  return `<section data-module="service-24-7" class="cs-247" id="open-24-7"><div class="cs-247-wrap">`
    + `<div class="cs-247-copy"><p class="cs-247-eyebrow">${escapeHtml(d.allDayEyebrow)}</p>`
    + `<h2>${escapeHtml(d.allDayHeading)}</h2>`
    + `<p>${escapeHtml(d.allDayText)}</p>`
    + `<ul class="cs-247-points">${d.allDayPoints.map(point => `<li>${escapeHtml(point).replaceAll('{phone}', phone)}</li>`).join('')}</ul></div>`
    + `<div class="cs-247-side"><div class="cs-247-badge"><b>${escapeHtml(d.allDayBadge)}</b><span>${escapeHtml(d.allDayBadgeLabel)}</span></div>`
    + `<a class="cs-247-call" href="${escapeHtml(d.phoneHref)}">Call ${phone}</a><a class="cs-247-book" href="#book">${escapeHtml(d.requestLabel)}</a></div>`
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
export function withEquipmentTypesLabel(html: string, label = defaultServiceSections.equipmentLabel): string {
  return html.replace(/(<section\b[^>]*\bdata-module="systems"[^>]*>\s*<div\b[^>]*>\s*<p\b[^>]*>)[\s\S]*?(<\/p>)/, (_match, open: string, close: string) => open + escapeHtml(label) + close)
}

// Symptom rows ("Match the symptom"): a warning triangle reads like a site error, so rows get a
// magnifying glass (symptom check) and emergency rows a siren on a solid red circle.
const symptomIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9302A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>'
const emergencyIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14"/><path d="M12 3v1M4.9 5.9l.7.7M19.1 5.9l-.7.7M3 12h1M20 12h1"/></svg>'
const TRIANGLE = /<svg\b[^>]*>\s*<path d="M12 3l10 18H2z"><\/path>[\s\S]*?<\/svg>/

// Note boxes: safety notes (gas, carbon monoxide, hazards) get the siren; other notes an info mark.
const noteInfoIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9302A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: 0 0 auto;"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
const noteSafetyIcon = '<span aria-hidden="true" style="flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; background: #C9302A; display: inline-flex; align-items: center; justify-content: center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14"/><path d="M12 3v1M4.9 5.9l.7.7M19.1 5.9l-.7.7M3 12h1M20 12h1"/></svg></span>'
const SAFETY = /\bgas\b|carbon monoxide|\bCO\b|hazard|safety|electrical warning|\bstop\b/i
const NOTE = /(<div role="note"[^>]*>\s*)<svg\b[^>]*>\s*<path d="M12 3l10 18H2z"><\/path>[\s\S]*?<\/svg>([\s\S]*?<\/div>)/g

export function withSymptomIcons(html: string): string {
  const notes = html.replace(NOTE, (_match, open: string, rest: string) =>
    open + (SAFETY.test(rest.replace(/<[^>]+>/g, ' ')) ? noteSafetyIcon : noteInfoIcon) + rest)
  return notes.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/g, summary => {
    if (!TRIANGLE.test(summary)) return summary
    const emergency = />\s*Emergency\s*</.test(summary)
    const marked = emergency ? summary.replace(/<span aria-hidden="true" style="/, '<span aria-hidden="true" data-symptom="emergency" style="') : summary
    return marked.replace(TRIANGLE, emergency ? emergencyIcon : symptomIcon)
  })
}

/** Add the work strip after the quick facts and the 24/7 band after the pricing section.
 * Pages without work items (services City & Suburban refers out) get neither. */
export function withServicePageSections(html: string, serviceName: string, items?: WorkItem[], design?: ServiceSectionsDesign | null): string {
  const labelled = withSymptomIcons(withEquipmentTypesLabel(html, resolveDesign(design).equipmentLabel))
  if (!items?.length) return labelled
  return insertAfterModule(insertAfterModule(labelled, 'quick-facts', workWeHandleSection(serviceName, items, design)), 'pricing', allDaySection(design))
}

/** A page's own Sanity strip wins; pages not yet edited in Sanity use the bundled items. */
export function resolveWorkItems(cmsItems: WorkItem[] | null | undefined, clusterSlug: string, slug: string): WorkItem[] | undefined {
  const own = cmsItems?.filter(item => item?.title?.trim() && item?.text?.trim())
  if (own?.length) return own.map(({title, text, icon}) => ({title, text, icon: icon || 'clipboard'}))
  return getWorkItems(clusterSlug, slug)
}
