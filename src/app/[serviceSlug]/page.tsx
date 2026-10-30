import type {Metadata} from 'next'
import {notFound, permanentRedirect} from 'next/navigation'
import {NavigationLevelPage} from '@/components/navigation-level-page'
import {clusterPath, findNavigationLevel, prepareServiceNavigation, servicePath, type ServiceNavigationPayload} from '@/lib/service-navigation'
import {metadataClient} from '@/sanity/lib/client'
import {siteUrl} from '@/sanity/env'
import {sanityFetch} from '@/sanity/lib/live'
import {REFERENCE_NAVIGATION_QUERY, SERVICE_NAVIGATION_QUERY} from '@/sanity/lib/queries'
import {referenceCollectionSlug, referenceNavigation, referenceServices, referencePagePath, type ReferenceOverride} from '@/lib/reference-pages'
import {legacyReplacementPath} from '@/lib/legacy-service-replacements'
import {BrandLevelPage} from '@/components/brand-directory'
import {brandDirectoryPages, findDirectoryBrand, listWords} from '@/lib/brand-directory'

type Props = {params: Promise<{serviceSlug: string}>}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {serviceSlug: slug} = await params
  const overrides = await metadataClient.fetch(REFERENCE_NAVIGATION_QUERY).catch(() => [])
  const referenceCluster = referenceNavigation((overrides || []) as ReferenceOverride[]).find((item) => item.slug === referenceCollectionSlug(slug))
  if (referenceCluster) return {
    title: `${referenceCluster.name} Services in Chicago`,
    description: referenceCluster.description,
    alternates: {canonical: `${siteUrl.replace(/\/+$/, '')}/services${clusterPath(referenceCluster.slug)}`},
  }
  const data = await metadataClient.fetch(SERVICE_NAVIGATION_QUERY)
  const level = findNavigationLevel(prepareServiceNavigation((data || {}) as ServiceNavigationPayload), slug)
  const brand = !level && findDirectoryBrand(slug)
  if (brand) return {
    title: `${brand.name} HVAC Services in Chicago | City & Suburban`,
    description: `${brand.name} ${listWords(brand.equipment)}: repair, installation and maintenance in Chicago.`,
    alternates: {canonical: `${siteUrl.replace(/\/+$/, '')}/services/${brand.slug}/`},
  }
  if (!level) return {}
  if (level.kind === 'service') return {}
  return {
    title: `${level.cluster.name} Services in Chicago`,
    description: level.cluster.description,
    alternates: {canonical: `${siteUrl.replace(/\/+$/, '')}/services${clusterPath(level.cluster.slug)}`},
  }
}

export default async function NavigationPage({params}: Props) {
  const {serviceSlug: slug} = await params
  const replacement = legacyReplacementPath(slug)
  if (replacement) permanentRedirect(replacement.replace(/^\/services/, ''))
  const landing = referenceServices.find((page) => page.slug === slug || page.legacySlug === slug)
  if (landing) permanentRedirect(landing.livePath.replace(/^\/services/, ''))
  const result = await sanityFetch({query: REFERENCE_NAVIGATION_QUERY, stega: false}).catch(() => null)
  const cmsLanding = ((result?.data || []) as ReferenceOverride[]).find(page => page.slug === slug && referencePagePath(page))
  if (cmsLanding) permanentRedirect(referencePagePath(cmsLanding)!.replace(/^\/services/, ''))
  const referenceCluster = referenceNavigation((result?.data || []) as ReferenceOverride[]).find((item) => item.slug === referenceCollectionSlug(slug))
  if (referenceCluster) return <NavigationLevelPage cluster={referenceCluster} />
  const {data} = await sanityFetch({query: SERVICE_NAVIGATION_QUERY, stega: false})
  const level = findNavigationLevel(prepareServiceNavigation((data || {}) as ServiceNavigationPayload), slug)
  // A brand level (/services/<brand>/): the brand's pages from the brands directory
  const brand = !level && findDirectoryBrand(slug)
  if (brand) return <BrandLevelPage brand={brand} pages={await brandDirectoryPages(brand)} />
  if (!level) notFound()

  if (level.kind === 'service') permanentRedirect(servicePath(level.cluster.slug, level.service.slug))
  return <NavigationLevelPage cluster={level.cluster} />
}
