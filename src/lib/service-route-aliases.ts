import catalog from '@/reference-pages/catalog.json'
import retained from '@/reference-pages/retained-catalog.json'
import migrations from '../../data/service-url-migrations.json'
import collections from '../../data/service-collection-aliases.json'
import taxonomy from '../../data/service-taxonomy.json'

/** Known page aliases only: unrelated WordPress URLs must not be captured. */
export function serviceRouteAliases(): Map<string, string> {
  const routes = new Map<string, string>([['/services', '/services/']])
  const categories = {...migrations.directoryCategories, ...collections, 'commercial': 'commercial', 'air-quality': 'air-quality', 'commercial-hvac': 'commercial'}
  for (const [slug, target] of Object.entries(categories)) routes.set(`/services/${slug}`, `/services/${target}/`)
  for (const page of [...catalog, ...retained]) {
    // previousSlug: the address the page had before the "-near-me" rename (permanent redirect).
    for (const slug of new Set([page.slug, page.legacySlug, page.previousSlug])) {
      for (const path of [`/services/${slug}`, `/services/${slug}/chicago`, `/services/${page.clusterSlug}/${slug}`, `/services/${page.clusterSlug}/${slug}/chicago`]) {
        routes.set(path, page.livePath)
      }
    }
  }
  for (const service of taxonomy.services) {
    const target = (migrations.overlaps as Record<string, string>)[service.slug]
    if (target) {
      for (const path of [`/services/${service.slug}`, `/services/${service.slug}/chicago`, `/services/${service.clusterSlug}/${service.slug}`, `/services/${service.clusterSlug}/${service.slug}/chicago`]) routes.set(path, target)
    }
  }
  return routes
}
