import {referenceSnapshots} from '@/reference-pages'
import type {ReferenceSnapshot} from '@/reference-pages/types'
import {applyReferenceContentFields, synchronizeVisibleSchema} from './reference-content-fields'
import type {ReferenceDocument} from './reference-pages'
import {migrateServiceContent} from './service-base-path'

function htmlAttributes(attributes: Record<string, string>) {
  return Object.entries(attributes).map(([name, value]) => `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join(' ')
}

/** Existing snapshots are fallbacks; new published pages render from CMS sections. */
export function renderReferencePage(document: ReferenceDocument | null, fallback?: ReferenceSnapshot): Pick<ReferenceSnapshot, 'style' | 'html' | 'schema'> | undefined {
  const updated = migrateServiceContent(document)
  if (!updated?.sections?.length) return fallback
  const standard = fallback || referenceSnapshots['heating/heater-repair']
  const html = `<main ${htmlAttributes(standard.mainAttributes)}><div ${htmlAttributes(standard.wrapperAttributes)}>${updated.sections.map(section => applyReferenceContentFields(section.html, section.contentFields)).join('')}</div></main>`
  return {
    style: updated.responsiveCss || standard.style,
    html,
    schema: synchronizeVisibleSchema(updated.structuredData || fallback?.schema || '', html),
  }
}
