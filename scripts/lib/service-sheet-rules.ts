/**
 * The "Service pages" tab of the City Suburban writing sheet: referenceServicePage documents in Sanity project
 * boolyxr0. Used by the Apps Script build and its test. No Node or Sanity imports: it is bundled into the sheet.
 */
import type {SheetOptions} from './sheet'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- free-form Sanity documents

const SITE = 'https://citysuburbanheating.com'

/**
 * Each section (its design HTML and its editable copy) is one JSON cell, spilling into up to 3 more cells: the
 * largest section on 03/11/2026 was 122,298 characters and a cell holds 50,000. Lists have the longest list in the
 * dataset plus 2 spare (17 sections, 55 key phrases, 7 work items).
 */
export const SERVICE_SHEET_OPTIONS: SheetOptions = {
  json: ['sections'],
  jsonParts: {sections: 4},
  capacity: {sections: 19, keyPhrases: 57, workWeHandle: 9},
}

/** Fields a page cannot be pushed without (required in the Studio). */
export const REQUIRED_FIELDS = ['name', 'clusterSlug', 'slug', 'metaTitle', 'metaDescription', 'responsiveCss']

const slugOf = (doc: Json) => String(doc.slug?.current || '')
const pathOf = (doc: Json) => (doc.clusterSlug && slugOf(doc) ? `/services/${doc.clusterSlug}/${slugOf(doc)}/` : '')

/** Existing pages keep their ID; a new page gets reference-service-<category>-<slug without "-near-me">. */
export function serviceIdOf(doc: Json, idCell: string): string {
  if (idCell) return idCell
  return doc.clusterSlug && slugOf(doc) ? `reference-service-${doc.clusterSlug}-${slugOf(doc).replace(/-near-me$/, '')}` : ''
}

export function checkServiceRow(doc: Json, idCell: string): {errors: string[]; warnings: string[]} {
  const errors: string[] = []
  const warnings: string[] = []
  for (const field of REQUIRED_FIELDS) if (!doc[field]) errors.push(`${field} is required`)
  const slug = slugOf(doc)
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push(`slug "${slug}" must be lowercase words joined by hyphens`)
  if (idCell && doc.clusterSlug && !idCell.startsWith(`reference-service-${doc.clusterSlug}-`)) errors.push(`_id ${idCell} does not match the URL category (expected reference-service-${doc.clusterSlug}-...)`)
  const path = pathOf(doc)
  if (doc.livePath && path && doc.livePath !== path) errors.push(`livePath ${doc.livePath} must be ${path}`)
  if (doc.canonicalUrl && path && doc.canonicalUrl !== `${SITE}${path}`) errors.push(`canonicalUrl must be ${SITE}${path}`)
  const sections: Json[] = Array.isArray(doc.sections) ? doc.sections : []
  if (!sections.length) errors.push('sections: the page has no sections')
  sections.forEach((section, i) => {
    if (!section?.module || !section?.html) errors.push(`sections[${i + 1}] needs a module and its html`)
  })
  const work: Json[] = Array.isArray(doc.workWeHandle) ? doc.workWeHandle : []
  if (work.length && work.length !== 7) errors.push(`workWeHandle has ${work.length} items; the strip needs exactly 7 (or none)`)
  work.forEach((item, i) => { if (!item.title || !item.text || !item.icon) errors.push(`workWeHandle[${i + 1}] needs a title, text and icon`) })
  if ((doc.metaTitle || '').length > 60) warnings.push(`metaTitle is ${doc.metaTitle.length} characters (aim for 60 or fewer)`)
  const confirm = JSON.stringify(doc).match(/\[CONFIRM[^\]]*\]/g) || []
  if (confirm.length) warnings.push(`${confirm.length} [CONFIRM] item(s) still to answer`)
  return {errors, warnings}
}

export const serviceProject = {
  type: 'referenceServicePage',
  prefix: 'servicePages',
  menu: 'Service pages → Sanity',
  tokenKey: 'CITY_SUBURBAN_SERVICE_PAGES_SANITY_TOKEN',
  order: 'clusterSlug asc, name asc',
  idOf: serviceIdOf,
  checkRow: checkServiceRow,
  /** Two pages may not have the same category and slug (that is the URL). */
  ownerKey: pathOf,
  urlOf: (doc: Json) => (pathOf(doc) ? `${SITE}${pathOf(doc)}` : ''),
}
