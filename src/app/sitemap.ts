import type {MetadataRoute} from 'next'
import {metadataClient} from '@/sanity/lib/client'
import {siteUrl} from '@/sanity/env'
import {BRAND_PAGE_PATHS_QUERY, REFERENCE_NAVIGATION_QUERY} from '@/sanity/lib/queries'
import {referenceNavigation, type ReferenceOverride} from '@/lib/reference-pages'
import {clusterPath} from '@/lib/service-navigation'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl.replace(/\/+$/, '')
  const lastModified = new Date()
  const published = await metadataClient.fetch(REFERENCE_NAVIGATION_QUERY).catch(() => []) as ReferenceOverride[]
  const clusters = referenceNavigation(published)
  const brandPaths = await metadataClient.fetch(BRAND_PAGE_PATHS_QUERY).catch(() => []) as string[]
  return [
    {url: `${base}/services/`, lastModified, changeFrequency: 'weekly', priority: 1},
    ...clusters.map((cluster) => ({
      url: `${base}/services${clusterPath(cluster.slug)}`,
      lastModified, changeFrequency: 'weekly' as const, priority: 0.9,
    })),
    // Include every public landing page: imported snapshots and new published CMS pages.
    ...clusters.flatMap((cluster) => cluster.pages.map((page) => ({
      url: `${base}${page.livePath}`,
      lastModified, changeFrequency: 'weekly' as const, priority: 0.85,
    }))),
    // Published brand pages (brand × equipment × service)
    ...brandPaths.map((path) => ({url: `${base}/services${path}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8})),
  ]
}
