import type {Metadata} from 'next'
import {ClusterCollection} from '@/components/cluster-collection'
import {CollectionFooter, CollectionHeader} from '@/components/collection-chrome'
import {CollectionHero, CollectionTrustBand} from '@/components/collection-hero'
import {sanityFetch} from '@/sanity/lib/live'
import {REFERENCE_NAVIGATION_QUERY} from '@/sanity/lib/queries'
import {referenceNavigation, type ReferenceOverride} from '@/lib/reference-pages'

export const revalidate = 60
export const metadata: Metadata = {
  title: 'HVAC Services in Chicago | City & Suburban',
  description: 'Choose a heating, cooling, air quality or commercial HVAC service in Chicago. Family owned since 1952, rated 4.98 across 204 Google reviews.',
  alternates: {canonical: 'https://citysuburbanheating.com/services/'},
}

export default async function HomePage() {
  const result = await sanityFetch({query: REFERENCE_NAVIGATION_QUERY, stega: false}).catch(() => null)
  const clusters = referenceNavigation((result?.data || []) as ReferenceOverride[])
  return (
    <div className="collection-page">
      <CollectionHeader />
      <main>
        <CollectionHero
          kicker="Family-owned HVAC company since 1952"
          title="Trusted HVAC experts for Chicago homes"
          text="Explore dependable heating, cooling, indoor-air-quality, and commercial HVAC services for Chicago homes and buildings."
          action="Explore service categories"
          count={clusters.length}
          countLabel={['service', 'systems']}
          panelKicker="Whole-home comfort"
          panelNote="Heating · Cooling · Air quality"
        />
        <ClusterCollection clusters={clusters} />
        <CollectionTrustBand />
      </main>
      <CollectionFooter />
    </div>
  )
}
