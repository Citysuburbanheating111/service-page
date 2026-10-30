// Brand pages share the two-part address with the service landing pages:
// /services/<brand>/<landing page>/ (e.g. /services/navien/tankless-water-heater-repair-chicago/).
// The [serviceSlug]/[areaSlug] route asks here when the address is not a service landing page.
import type {Metadata} from 'next'
import {BrandLandingPage} from '@/components/brand-landing-page'
import {renderBrandPage, type BrandPageContent} from '@/lib/brand-page/render'
import {DESIGN_CSS, INTERACTION_CSS} from '@/lib/brand-page/styles'
import {business} from '@/lib/site-navigation'
import {metadataClient} from '@/sanity/lib/client'
import {sanityFetch} from '@/sanity/lib/live'
import {siteUrl} from '@/sanity/env'
import {BRAND_PAGE_PATHS_QUERY, BRAND_PAGE_QUERY} from '@/sanity/lib/queries'

type BrandPageDocument = BrandPageContent & {title?: string; path: string; metaTitle?: string; metaDescription?: string; responsiveCss?: string}

export const brandPagePath = (brand: string, page: string) => `/${brand}/${page}/`
const canonical = (path: string) => `${siteUrl.replace(/\/+$/, '')}/services${path}`

/** The brand page at this address, drafts included in draft mode; null when there is none. */
async function findBrandPage(path: string) {
  const {data} = await sanityFetch({query: BRAND_PAGE_QUERY, params: {path}, stega: false}).catch(() => ({data: null}))
  const doc = data as BrandPageDocument | null
  return doc?.hero && doc.meta ? doc : null
}

export async function brandPageMetadata(path: string): Promise<Metadata | null> {
  const doc = await findBrandPage(path)
  if (!doc) return null
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

/** The brand page at this address, ready to render; null when there is none. */
export async function brandPageElement(path: string) {
  const [doc, published] = await Promise.all([findBrandPage(path), metadataClient.fetch(BRAND_PAGE_PATHS_QUERY).catch(() => [] as string[])])
  if (!doc) return null
  const rendered = renderBrandPage(doc, {published: published as string[]})
  return <BrandLandingPage
    html={rendered.html}
    // the design system lives in the code, so a style fix reaches every brand page at once;
    // the "Page styles" copy in Sanity is only kept for the older Studio schema
    style={`${DESIGN_CSS}\n${INTERACTION_CSS}`}
    schema={structuredData(doc)}
    serviceName={`${doc.meta.brand} ${doc.meta.equipment.toLowerCase()} ${doc.meta.service.toLowerCase()}`} />
}
