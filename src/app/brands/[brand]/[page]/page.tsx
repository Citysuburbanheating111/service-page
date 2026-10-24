import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {BrandLandingPage} from '@/components/brand-landing-page'
import {renderBrandPage, type BrandPageContent} from '@/lib/brand-page/render'
import {DESIGN_CSS, INTERACTION_CSS} from '@/lib/brand-page/styles'
import {business} from '@/lib/site-navigation'
import {metadataClient} from '@/sanity/lib/client'
import {sanityFetch} from '@/sanity/lib/live'
import {siteUrl} from '@/sanity/env'
import {BRAND_PAGE_PATHS_QUERY, BRAND_PAGE_QUERY} from '@/sanity/lib/queries'

type Props = {params: Promise<{brand: string; page: string}>}
type BrandPageDocument = BrandPageContent & {title?: string; path: string; metaTitle?: string; metaDescription?: string; responsiveCss?: string}

const pathOf = (brand: string, page: string) => `/brands/${brand}/${page}/`
const canonical = (path: string) => `${siteUrl.replace(/\/+$/, '')}/services${path}`

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {brand, page} = await params
  // Draft-aware, so the Studio preview shows the draft's title too
  const {data} = await sanityFetch({query: BRAND_PAGE_QUERY, params: {path: pathOf(brand, page)}, stega: false}).catch(() => ({data: null}))
  const doc = data as BrandPageDocument | null
  if (!doc?.hero) return {}
  return {
    title: {absolute: doc.metaTitle || doc.meta?.seoTitle || doc.title || ''},
    description: doc.metaDescription || doc.meta?.metaDescription,
    alternates: {canonical: canonical(doc.path)},
    robots: {index: true, follow: true},
  }
}

/** Structured data from the page's own fields: the business, this service, the FAQ and the breadcrumb. */
function structuredData(doc: BrandPageDocument) {
  const url = canonical(doc.path)
  const name = `${doc.meta.brand} ${doc.meta.equipment.toLowerCase()} ${doc.meta.service.toLowerCase()}`
  const businessNode = {
    '@type': 'HVACBusiness', '@id': 'https://citysuburbanheating.com/#business', name: 'City & Suburban Heating & Cooling',
    url: 'https://citysuburbanheating.com/', telephone: '+1-773-238-3838', foundingDate: '1952',
    address: {'@type': 'PostalAddress', streetAddress: '1225 N Cleaver St', addressLocality: 'Chicago', addressRegion: 'IL', postalCode: '60642', addressCountry: 'US'},
    aggregateRating: {'@type': 'AggregateRating', ratingValue: '4.98', reviewCount: '204'},
    sameAs: [business.reviewsHref, 'https://www.yelp.com/biz/city-and-suburban-heating-and-cooling-chicago'],
  }
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      businessNode,
      {'@type': 'Service', '@id': `${url}#service`, name: doc.hero.h1, serviceType: name, brand: {'@type': 'Brand', name: doc.meta.brand}, provider: {'@id': businessNode['@id']}, areaServed: {'@type': 'City', name: 'Chicago'}, url},
      {'@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: (doc.faq?.items || []).map((item: {question: string; answer: string}) => ({'@type': 'Question', name: item.question, acceptedAnswer: {'@type': 'Answer', text: item.answer}}))},
      {'@type': 'BreadcrumbList', itemListElement: (doc.hero.breadcrumb || []).map((label: string, i: number, all: string[]) => ({'@type': 'ListItem', position: i + 1, name: label, ...(i === 0 ? {item: 'https://citysuburbanheating.com/'} : i === all.length - 1 ? {item: url} : {})}))},
    ],
  })
}

export default async function BrandPage({params}: Props) {
  const {brand, page} = await params
  const path = pathOf(brand, page)
  const [{data}, published] = await Promise.all([
    sanityFetch({query: BRAND_PAGE_QUERY, params: {path}, stega: false}).catch(() => ({data: null})),
    metadataClient.fetch(BRAND_PAGE_PATHS_QUERY).catch(() => [] as string[]),
  ])
  const doc = data as BrandPageDocument | null
  if (!doc?.hero || !doc.meta) notFound()
  const rendered = renderBrandPage(doc, {published: published as string[]})
  return <BrandLandingPage
    html={rendered.html}
    style={`${doc.responsiveCss || DESIGN_CSS}\n${INTERACTION_CSS}`}
    schema={structuredData(doc)}
    serviceName={`${doc.meta.brand} ${doc.meta.equipment.toLowerCase()} ${doc.meta.service.toLowerCase()}`} />
}
