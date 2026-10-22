import catalog from '@/reference-pages/catalog.json'
import retainedCatalog from '@/reference-pages/retained-catalog.json'
import migrations from '../../data/service-url-migrations.json'
import {referenceSnapshots} from '@/reference-pages'
import type {ReferenceSnapshot} from '@/reference-pages/types'
import type {PreparedCluster} from './service-navigation'
import type {ReferenceContentField} from './reference-content-fields'
import {migrateServiceContent} from './service-base-path'
import {legacyReplacementPath} from './legacy-service-replacements'
import type {ServiceSectionsDesign, WorkItem} from './service-page-sections'

export type ReferenceService = (typeof catalog)[number] | (typeof retainedCatalog)[number]

const clusterDetails: Record<string, {name: string; description: string}> = {
  heating: {name: 'Heating', description: 'Heating repair, installation, maintenance, heat pumps, boilers and system plans for Chicago homes.'},
  cooling: {name: 'Cooling', description: 'Air conditioning, ductless systems, heat pumps and maintenance for Chicago homes.'},
  'air-quality': {name: 'Air Quality', description: 'Ductwork, humidity control and indoor air quality services in Chicago.'},
  commercial: {name: 'Commercial HVAC', description: 'Commercial HVAC installation, repair, replacement, ductwork and maintenance.'},
}

export const referenceServices: ReferenceService[] = [...catalog, ...retainedCatalog]

export function referenceCollectionSlug(slug: string): string {
  return slug === 'commercial-hvac' ? 'commercial' : (migrations.directoryCategories as Record<string, string>)[slug] || slug
}

export type ReferenceOverride = {name?: string; clusterSlug?: string; directoryClusterSlug?: string; slug?: string; livePath?: string; canonicalUrl?: string; cardDescription?: string; cardImage?: string; metaDescription?: string; qcStatus?: string}
export type ReferenceDocument = ReferenceOverride & {
  metaTitle?: string
  responsiveCss?: string
  structuredData?: string
  sections?: Array<{_key?: string; module: string; html: string; contentFields?: ReferenceContentField[]}>
  workWeHandle?: WorkItem[] | null
  serviceSections?: ServiceSectionsDesign | null
}

export function getReferenceService(clusterSlug: string, slug: string): ReferenceService | undefined {
  return referenceServices.find((item) => item.clusterSlug === clusterSlug && (item.slug === slug || item.legacySlug === slug || item.previousSlug === slug))
}

/** Sanity slugs that identify a catalog page: the current "-near-me" slug, then the slug it had before. */
export function referenceSlugs(service: ReferenceService | undefined, requested: string): string[] {
  return service ? [...new Set([service.slug, service.previousSlug].filter(Boolean))] : [requested]
}

/** A canonical left on the slug a page had before the "-near-me" rename is replaced by the catalog's. */
export function currentCanonical(service: ReferenceService, cmsCanonical?: string): string {
  const stale = !cmsCanonical || new URL(cmsCanonical, 'https://citysuburbanheating.com').pathname === `/services/${service.clusterSlug}/${service.previousSlug}/`
  return stale ? service.canonicalUrl : cmsCanonical
}

export function getReferenceSnapshot(clusterSlug: string, slug: string): ReferenceSnapshot | undefined {
  const service = getReferenceService(clusterSlug, slug)
  return service && referenceSnapshots[`${clusterSlug}/${service.slug}`]
}

// Preserve the first collection layer's category images independently of service cards.
const clusterImages: Record<string, string> = {
  heating: '/services/reference-assets/svc-heating-repair.jpg',
  cooling: '/services/reference-assets/svc-ductless.jpg',
  'air-quality': '/services/reference-assets/svc-heating-maintenance.jpg',
  commercial: '/services/reference-assets/as-gold-14-hybrid-comfort-packaged-system.jpg',
}

/** CMS pages need no entry in the imported reference catalog. */
export function referencePagePath(page: ReferenceOverride): string | undefined {
  if (!page.clusterSlug || !page.slug || !/^[a-z0-9-]+$/.test(page.clusterSlug) || !/^[a-z0-9-]+$/.test(page.slug)) return undefined
  return getReferenceService(page.clusterSlug, page.slug)?.livePath || `/services/${page.clusterSlug}/${page.slug}/`
}

export function referenceNavigation(overrides: ReferenceOverride[] = []): PreparedCluster[] {
  overrides = migrateServiceContent(overrides)
  return Object.entries(clusterDetails).map(([slug, details], index) => {
    const services = referenceServices.filter((item) => ('directoryClusterSlug' in item ? item.directoryClusterSlug : item.clusterSlug) === slug)
    const extraPages = overrides.filter(row => referencePagePath(row) && row.name && !legacyReplacementPath(row.slug || '') &&
      !getReferenceService(row.clusterSlug || '', row.slug || '') &&
      referenceCollectionSlug(row.directoryClusterSlug || row.clusterSlug || '') === slug)
      .filter((row, position, rows) => rows.findIndex(other => referencePagePath(other) === referencePagePath(row)) === position)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    const pages = services.map((item) => {
      const override = overrides.find((row) => row.clusterSlug === item.clusterSlug && row.slug === item.slug)
        || overrides.find((row) => row.clusterSlug === item.clusterSlug && row.slug === item.previousSlug)
      return ({
      _id: `reference-${slug}-${item.slug}`,
      serviceSlug: item.slug,
      livePath: item.livePath,
      areaSlug: 'chicago',
      serviceName: override?.name || item.name,
      areaName: 'Chicago',
      metaDescription: override?.cardDescription || override?.metaDescription || item.description,
      cardImage: override?.cardImage || item.cardImage || undefined,
    })}).concat(extraPages.map(page => ({
      _id: `reference-${page.clusterSlug}-${page.slug}`,
      serviceSlug: page.slug!, livePath: referencePagePath(page)!, areaSlug: 'chicago',
      serviceName: page.name!, areaName: 'Chicago',
      metaDescription: page.cardDescription || page.metaDescription || '',
      cardImage: page.cardImage || undefined,
    })))
    return {
      id: `reference-${slug}`,
      slug,
      name: details.name,
      description: details.description,
      displayOrder: index + 1,
      sourceServiceCount: pages.length,
      requiresScopeReview: services.some((item) => item.qcStatus !== 'PASS') || extraPages.some(page => Boolean(page.qcStatus) && page.qcStatus !== 'PASS'),
      pages,
      services: pages.map((page) => ({slug: page.serviceSlug, name: page.serviceName, description: page.metaDescription, cardImage: page.cardImage, pages: [page]})),
      cardImage: clusterImages[slug],
    }
  })
}
