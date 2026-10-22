import type {CSSProperties, ReactNode} from 'react'
import Link from 'next/link'
import type {ExternalImage, Faq, Guide, ServicePageData} from '@/types/content'
import {GuideTabs} from './guide-tabs'
import {CenteredAreaRail} from './centered-area-rail'
import {LeadForm} from './lead-form'
import {CollectionFooter, CollectionHeader} from './collection-chrome'
import {questionHeading} from '@/lib/headings'
import {clusterPath, servicePath} from '@/lib/service-navigation'
import {getReferenceSnapshot, referenceServices} from '@/lib/reference-pages'
import {legacyReplacementPath} from '@/lib/legacy-service-replacements'
import {ReferenceLandingPage} from './reference-landing-page'
import {migrateServiceUrls} from '@/lib/service-base-path'
import {getWorkItems} from '@/lib/service-page-sections'

type Props = {data: ServicePageData}

const LIGHT_MARK_ON_DARK_TILE = new Set(['eaton', 'generac', 'siemens', 'sma'])
const AVAILABLE_BRAND_LOGOS = new Set([
  'a-o-smith', 'amana', 'american-standard', 'bosch', 'bradford-white', 'bryant', 'carrier',
  'comfortmaker', 'daikin', 'fujitsu', 'goodman', 'lennox', 'lochinvar', 'mitsubishi', 'navien',
  'noritz', 'rheem', 'rinnai', 'state', 'takagi', 'trane', 'york',
  'big-ass-fans', 'briggs-and-stratton', 'broan', 'canadian-solar', 'casablanca', 'challenger',
  'champion', 'cummins', 'cutler-hammer', 'ditek', 'eaton', 'emerson', 'enphase', 'federal-pacific',
  'fronius', 'ge', 'generac', 'hampton-bay', 'honeywell', 'hubbell', 'hunter', 'insinkerator',
  'intermatic', 'kichler', 'kitchenaid', 'kohler', 'legrand', 'leviton', 'lg', 'lutron', 'milbank',
  'minka-aire', 'moen', 'murray', 'pass-and-seymour', 'qcells', 'schneider', 'siemens', 'sma',
  'solaredge', 'square-d', 'tesla', 'waste-king', 'zinsco',
])

function imageUrl(image?: ExternalImage): string | undefined {
  const url = image?.resolvedUrl || image?.externalUrl
  return url ? migrateServiceUrls(url) : undefined
}

function imageStyle(image?: ExternalImage): CSSProperties | undefined {
  const url = imageUrl(image)
  return url ? {backgroundImage: `url(${JSON.stringify(url)})`} : undefined
}

function hasReferenceMedia(images?: ExternalImage[]): boolean {
  return Boolean(images?.some((image) => !/^City & Suburban Heating & Cooling\b/i.test(image.credit || '')))
}

function brandSlug(brand: string): string {
  return brand
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function brandLogoPath(brand: string): string {
  return `/services/images/brands/${brandSlug(brand)}.png`
}

function BrandMark({brand}: {brand: string}) {
  const slug = brandSlug(brand)
  if (!AVAILABLE_BRAND_LOGOS.has(slug)) {
    return <span className="brand-mark brand-wordmark" role="img" aria-label={`${brand} wordmark`}>{brand}</span>
  }
  const filter = LIGHT_MARK_ON_DARK_TILE.has(slug) ? 'brand-light-on-dark-filter' : 'brand-dark-on-light-filter'
  return <span className={`brand-mark brand-mark--${slug}`} role="img" aria-label={`${brand} logo`}><svg viewBox="0 0 64 40" aria-hidden="true"><image href={brandLogoPath(brand)} x="0" y="0" width="64" height="40" preserveAspectRatio="xMidYMid meet" filter={`url(#${filter})`} /></svg></span>
}

function BrandLogoFilter() {
  return <svg className="brand-filter-defs" aria-hidden="true"><defs><filter id="brand-dark-on-light-filter" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .88  0 0 0 0 .9  0 0 0 0 .92  -.333 -.333 -.333 1 0" /><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 1 1" /></feComponentTransfer></filter><filter id="brand-light-on-dark-filter" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .88  0 0 0 0 .9  0 0 0 0 .92  .333 .333 .333 0 0" /><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 1 1" /></feComponentTransfer></filter></defs></svg>
}

function asQuestion(value: string | undefined, area: string): string {
  const heading = `${value || 'What This Work Costs'} in ${area}`.trim()
  return heading.endsWith('?') ? heading : `${heading}?`
}

function serviceHref(url: string | undefined, routes: ServicePageData['serviceRoutes']) {
  if (!url) return '/services/'
  url = migrateServiceUrls(url)
  try {
    const parsed = new URL(url, 'https://citysuburbanheating.com')
    if (!/(^|\.)(citysuburbanheating|highlightschicago)\.com$/i.test(parsed.hostname)) return url
    const match = parsed.pathname.match(/^\/services?\/([^/]+)\/?$/)
    if (!match) return url
    const route = routes?.find((candidate) => candidate.serviceSlug === match[1])
    return route?.clusterSlug ? `/services${servicePath(route.clusterSlug, match[1])}` : `/services/${match[1]}/`
  } catch {
    return url
  }
}

function guideText(guide: Guide): string[] {
  if (Array.isArray(guide.body) && guide.body.length) {
    return guide.body.map((block) => {
      if (!block || typeof block !== 'object' || !('children' in block)) return ''
      const children = (block as {children?: Array<{text?: string}>}).children || []
      return children.map((child) => child.text || '').join('')
    }).filter(Boolean)
  }
  if (!guide.legacyHtml) return []
  return guide.legacyHtml
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function GoogleMark({large = false}: {large?: boolean}) {
  return (
    <span className={`mark${large ? ' mark-lg' : ''}`} title="Google">
      <svg viewBox="0 0 48 48" aria-label="Google" role="img">
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.6h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z" />
        <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8 41.3 15.4 46 24 46z" />
        <path fill="#FBBC04" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.6z" />
        <path fill="#EA4335" d="M24 10.3c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C35 3.8 30 1.8 24 1.8 15.4 1.8 8 6.5 4.5 13.9l7.3 5.7c1.7-5.2 6.5-9.3 12.2-9.3z" />
      </svg>
    </span>
  )
}

function Rating({rating, count, compact = false, largeMark = false}: {rating: number; count?: number; compact?: boolean; largeMark?: boolean}) {
  const style = {'--pct': `${Math.max(0, Math.min(100, rating * 20))}%`} as CSSProperties
  return (
    <span className={`rating src-google${compact ? ' rating-sm' : ''}`}>
      <GoogleMark large={largeMark} />
      <span className="num">{rating}</span><span className="out">/5</span>
      <span className="stars" style={style} aria-hidden="true">★★★★★</span>
      {count !== undefined && <span className="cnt">{count} reviews</span>}
    </span>
  )
}

function EquipmentIcon({index}: {index: number}) {
  const icons: ReactNode[] = [
    <><rect x="12" y="8" width="24" height="32" rx="3" /><path className="ln" d="M18 16h12M18 22h12M18 28h12" /></>,
    <><rect x="12" y="8" width="24" height="32" rx="3" /><path className="ln" d="M18 18h12M18 26h12M24 8v32" /></>,
    <><rect x="12" y="8" width="24" height="32" rx="3" /><circle className="ln" cx="24" cy="18" r="3" /><path className="ln" d="M18 28h12" /></>,
    <><rect x="12" y="8" width="24" height="32" rx="3" /><path className="ln" d="M26 14l-6 10h8l-6 10" /></>,
    <><rect x="8" y="6" width="32" height="36" rx="3" /><path className="ln" d="M16 14h16M16 22h16M16 30h16M24 6v4" /></>,
    <><rect x="10" y="8" width="28" height="32" rx="3" /><circle className="ln" cx="19" cy="18" r="3" /><circle className="ln" cx="29" cy="18" r="3" /><circle className="ln" cx="19" cy="29" r="3" /><circle className="ln" cx="29" cy="29" r="3" /></>,
    <><rect x="12" y="8" width="24" height="32" rx="3" /><path className="ln" d="M17 15l14 18M31 15L17 33" /></>,
    <><rect x="14" y="10" width="20" height="28" rx="3" /><path className="ln" d="M19 18h10M19 25h10M24 4v6M10 24h4M34 24h4" /></>,
  ]
  return <svg viewBox="0 0 48 48" aria-hidden="true">{icons[index % icons.length]}</svg>
}

function EmptyImageIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="11" width="34" height="27" rx="3" /><circle cx="18" cy="21" r="4" /><path d="M9 34l10-8 7 6 5-4 8 6" /></svg>
}

function reviewDate(value?: string): string | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const [, year, month, day] = match
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
  )
}

function PhotoPlaceholder({image}: {image: ExternalImage}) {
  return <><EmptyImageIcon />{image.alt && <span className="photo-slot-label">{image.alt}</span>}</>
}

function JsonLd({data}: Props) {
  const {page, settings} = data
  if (!page || !settings) return null
  const {service, area} = page
  const canonicalUrl = service.cluster?.slug
    ? `${settings.siteUrl.replace(/\/+$/, '')}/services${servicePath(service.cluster.slug, service.slug)}`
    : page.seo.canonicalUrl
  const faqs: Faq[] = [...(service.faqs || []), ...(page.localFaqOverrides?.length ? page.localFaqOverrides : area.localFaqs || [])]
  const graph = [
    {
      '@type': settings.schemaBusinessType || 'Electrician',
      '@id': `${settings.siteUrl}/#business`,
      name: settings.companyName,
      telephone: settings.phoneE164 || settings.phoneDisplay,
      url: settings.siteUrl,
      email: settings.email,
      address: {'@type': 'PostalAddress', streetAddress: settings.address?.street, addressLocality: settings.address?.city, addressRegion: settings.address?.state, postalCode: settings.address?.zip, addressCountry: 'US'},
      geo: settings.shopLocation ? {'@type': 'GeoCoordinates', latitude: settings.shopLocation.lat, longitude: settings.shopLocation.lng} : undefined,
      aggregateRating: settings.google?.rating ? {'@type': 'AggregateRating', ratingValue: settings.google.rating, reviewCount: settings.google.reviewCount} : undefined,
    },
    {'@type': 'Service', name: `${service.h1Prefix} in ${area.name}`, url: canonicalUrl, serviceType: service.name, provider: {'@id': `${settings.siteUrl}/#business`}, areaServed: {'@type': 'City', name: `${area.name}, ${area.state}`}},
    {'@type': 'BreadcrumbList', itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Home', item: settings.siteUrl},
      {'@type': 'ListItem', position: 2, name: 'Services', item: `${settings.siteUrl}/services/`},
      ...(service.cluster?.name && service.cluster?.slug ? [{'@type': 'ListItem', position: 3, name: service.cluster.name, item: `${settings.siteUrl}/services/${service.cluster.slug}`}] : []),
      {'@type': 'ListItem', position: service.cluster?.slug ? 4 : 3, name: `${service.name} in ${area.name}`, item: canonicalUrl},
    ]},
    ...(faqs.length ? [{'@type': 'FAQPage', mainEntity: faqs.map((faq) => ({'@type': 'Question', name: faq.question, acceptedAnswer: {'@type': 'Answer', text: faq.answer}}))}] : []),
  ]
  const json = JSON.stringify({'@context': 'https://schema.org', '@graph': graph}).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html: json}} />
}

export function ServiceLandingPage({data}: Props) {
  const {page, settings} = data
  if (!page || !settings) return null
  const {service, area} = page
  const replacement = legacyReplacementPath(service.slug)
  const approved = referenceServices.find((item) => item.livePath === replacement || item.slug === service.slug)
  const currentDesign = approved && getReferenceSnapshot(approved.clusterSlug, approved.slug)
  if (approved && currentDesign) return <ReferenceLandingPage snapshot={{style: currentDesign.style, html: currentDesign.html, schema: currentDesign.schema}} serviceName={approved.name} workItems={getWorkItems(approved.clusterSlug, approved.slug)} />
  const localFaqs = page.localFaqOverrides?.length ? page.localFaqOverrides : area.localFaqs
  const rating = settings.google?.rating
  const reviewCount = settings.google?.reviewCount
  const presentation = page.template?.presentation
  const coverageMapFirst = presentation?.coverageMapFirst !== false
  const equalHeightReviews = presentation?.equalHeightReviewCards !== false
  const heroGalleryImageCount = presentation?.heroGalleryImageCount || 3
  const workingPhotoCount = presentation?.workingPhotoCount || 3
  const heroGalleryHasReferenceMedia = hasReferenceMedia(page.gallery)
  const workingPhotosHaveReferenceMedia = hasReferenceMedia(page.workingPhotos)
  const footerColor = presentation?.footerColor || '#09263A'
  const accentColor = presentation?.accentColor || '#DD382B'
  const accentDarkColor = presentation?.accentDarkColor || '#B92E23'
  const actionBlueColor = presentation?.actionBlueColor || '#0A4265'
  const brandStyle = {
    '--brand': footerColor,
    '--brand-dk': '#061B29',
    '--brand-lt': '#EEF4F7',
    '--brand-2': actionBlueColor,
    '--accent': accentColor,
    '--accent-dk': accentDarkColor,
    '--footer': footerColor,
  } as CSSProperties
  const equipment = service.types || []
  const brands = service.brands || []
  const trustMetrics = page.trustMetrics?.length ? page.trustMetrics : settings.trustMetrics || []
  const aPlusIndex = trustMetrics.findIndex((metric) => metric.value.trim().toUpperCase() === 'A+' || /\bBBB\b/i.test(metric.label))
  const aPlusMetric = aPlusIndex >= 0 ? trustMetrics[aPlusIndex] : undefined
  const remainingTrustMetrics = trustMetrics.filter((_, index) => index !== aPlusIndex)
  const orderedTrustMetrics = aPlusMetric
    ? [...remainingTrustMetrics.slice(0, 2), aPlusMetric, ...remainingTrustMetrics.slice(2)]
    : trustMetrics
  const guideItems = (page.guides || []).map((guide) => ({title: guide.title, paragraphs: guideText(guide)}))
  const coverageMap = area.mapQuery ? <div className="area-map"><iframe title={`${area.name} service area map`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(area.mapQuery)}&output=embed`} /></div> : null
  const coverageAreas = <CenteredAreaRail label={`${area.name} service locations`}>{area.subAreas?.map((subArea) => <a className="area-chip" role="listitem" href="#quote" key={subArea._key || subArea.name}><span className="area-img" style={imageStyle(subArea.photo)}>{!imageUrl(subArea.photo) && <EmptyImageIcon />}</span><b>{subArea.name}</b><span>{subArea.note}</span></a>)}</CenteredAreaRail>

  return (
    <div className="site-chrome">
      <CollectionHeader />
      <main className="service-landing" style={brandStyle}>
      <nav className="crumbs wrap" aria-label="Breadcrumb"><ol><li><a href={settings.siteUrl}>Home</a></li><li><Link href="/">Services</Link></li>{service.cluster?.slug && <li><Link href={clusterPath(service.cluster.slug)}>{service.cluster.name}</Link></li>}<li aria-current="page">{service.name} in {area.name}</li></ol></nav>

      <header className="hero"><div className="wrap hero-grid"><div>
        <p className="eyebrow">{area.heroEyebrow}</p><h1>{questionHeading(`${service.h1Prefix} in ${area.name}`)}</h1><p className="lede">{service.heroLede}</p>
        <div className="trustbar">{settings.trustLines?.map((line) => <span className="trust-item" key={line}>◆ {line}</span>)}{rating && <Rating rating={rating} count={reviewCount} />}</div>
        <div className="btn-row"><a className="btn btn-primary" href={`tel:${settings.phoneE164}`}>Call {settings.phoneDisplay}</a><a className="btn btn-secondary" href="#quote">{service.secondaryCta || 'Request service'}</a></div>
        <div className="cs-gallery"><div className="cs-gallery-rail">{page.gallery?.slice(0, heroGalleryImageCount).map((photo, index) => <a className="cs-shot" href="#working-in-area" key={photo._key || index} aria-label={photo.alt || `${service.name} project ${index + 1}`}><span className="cs-shot-img" style={imageStyle(photo)}>{!imageUrl(photo) && <PhotoPlaceholder image={photo} />}</span></a>)}</div><div className="cs-gallery-head"><p className="eyebrow">{heroGalleryHasReferenceMedia ? `${service.name} reference images` : area.galleryLabel}</p><a href="#working-in-area">See more →</a></div></div>
      </div><LeadForm service={service.name} area={area.name} issueQuestion={service.issueQuestion} issueOptions={service.issueOptions} buildingTypes={area.buildingTypes} addressPlaceholder={area.addressPlaceholder} subtitle={page.formSubtitle || settings.formSubtitle} note={page.formNote || settings.formNote} /></div></header>

      <section className="wrap" id="equipment"><h2>{questionHeading(service.typesHeading)}</h2><p className="lede narrow">{service.typesLede}</p><div className="equip-strip" aria-label={service.typesHeading}><div className="equip-track">{[...equipment, ...equipment].map((item, index) => <div className="equip" key={`${item._key || item.name}-${index}`} aria-hidden={index >= equipment.length || undefined}><EquipmentIcon index={index} /><b>{item.name}</b><span>{item.description}</span></div>)}</div></div>{service.typesFootnote && <p className="small muted section-note">{service.typesFootnote}</p>}</section>

      <section className="brands-section" id="brands"><BrandLogoFilter /><div className="wrap"><h2>{questionHeading(`${service.brandsHeading} in ${area.name}`)}</h2><p className="lede narrow">{service.brandsLede}</p><div className="brand-strip" aria-label={`${service.brandsHeading} in ${area.name}`}><div className="brand-track">{[0, 1].map((copy) => <div className="brand-sequence" aria-hidden={copy === 1 || undefined} key={copy}>{brands.map((brand) => <div className="brand-tile" key={`${copy}-${brand}`}><BrandMark brand={brand} /><strong>{brand}</strong></div>)}</div>)}</div></div>{service.brandsNote && <p className="small section-note">{service.brandsNote}</p>}</div></section>

      <section className="wrap" id="trust"><h2>{questionHeading(settings.trustHeading)}</h2><p className="lede narrow">{settings.trustLede}</p><div className="trust-strip">{orderedTrustMetrics.map((metric) => <div className="trust-cell" key={metric._key || metric.label}><b>{metric.value}</b><span>{metric.label}</span></div>)}{rating && <div className="trust-cell google-proof-cell"><b><Rating rating={rating} largeMark /></b>{settings.google?.reviewsUrl ? <a className="google-review-total" href={settings.google.reviewsUrl} target="_blank" rel="noreferrer">{reviewCount} Google reviews</a> : <span>{reviewCount} Google reviews</span>}</div>}</div><div className="grid grid-3 trust-cards">{settings.trustCards?.map((item) => <article className="card" key={item._key || item.title}><h3>{questionHeading(item.title)}</h3><p className="small">{item.body}</p></article>)}</div></section>

      <section className="section-tint" id="reviews"><div className="wrap"><h2>{questionHeading(settings.reviewsHeading)}</h2><div className={`grid grid-2 reviews-grid${equalHeightReviews ? ' reviews-grid-equal' : ''}`}>{page.reviews?.map((review, index) => { const date = reviewDate(review.date || review.location); const body = <><blockquote>“{review.quote}”</blockquote>{review.summary && <p className="review-summary">{review.summary}</p>}{rating && <div className="rev-rating"><Rating rating={rating} compact /></div>}<footer className="rev-meta"><span><strong>{review.author}</strong>{date && <> · {date}</>}</span><span className="rev-src">{review.sourceUrl ? 'View source →' : 'Content-sheet sample'}</span></footer></>; return review.sourceUrl ? <a className="rev-card" href={review.sourceUrl} target="_blank" rel="noreferrer" key={review._key || index}>{body}</a> : <article className="rev-card" key={review._key || index}>{body}</article> })}</div>{settings.google?.reviewsUrl && <div className="rev-cta"><a className="rev-cta-btn" href={settings.google.reviewsUrl} target="_blank" rel="noreferrer">Read all {reviewCount ? `${reviewCount} ` : ''}reviews →</a></div>}{settings.reviewsDisclaimer && <p className="small muted review-note">{settings.reviewsDisclaimer}</p>}</div></section>

      <section className="wrap" id="why-us"><h2>{questionHeading(service.whyHeading)}</h2><p className="lede narrow">{service.whyLede}</p><div className="why-grid">{service.whyItems?.map((item) => <article className="why-item" key={item._key || item.title}><h3 className="why-title">{questionHeading(item.title)}</h3><p className="why-body">{item.body}</p></article>)}</div></section>

      <section className="section-tint" id="working-in-area"><div className="wrap"><h2>{questionHeading(workingPhotosHaveReferenceMedia ? `What Does ${service.name} Involve` : `Our Work in ${area.name}`)}</h2><p className="lede narrow">{workingPhotosHaveReferenceMedia ? 'These licensed reference images illustrate equipment and service scope; they are not represented as City & Suburban project photos.' : area.workingLede}</p><div className="photo-grid">{page.workingPhotos?.slice(0, workingPhotoCount).map((photo, index) => <div className="ph" key={photo._key || index} style={imageStyle(photo)} role="img" aria-label={photo.alt || `${service.name} work in ${area.name} ${index + 1}`}>{!imageUrl(photo) && <PhotoPlaceholder image={photo} />}</div>)}</div></div></section>

      <section className="wrap" id="areas"><h2 className="single-line-mobile">{questionHeading(area.areasHeading)}</h2><p className="lede narrow">{area.areasLede}</p><div className="coverage-stack">{coverageMapFirst ? <>{coverageMap}{coverageAreas}</> : <>{coverageAreas}{coverageMap}</>}</div>{area.areasNote && <p className="small muted coverage-note">{area.areasNote}</p>}</section>

      <section className="wrap" id="other-services"><h2>{questionHeading(`Our other services in ${area.name}`)}</h2><div className="svc-split">{service.featuredCategory?.title && <a className="svc-feature" href={serviceHref(service.featuredCategory.url, data.serviceRoutes)}><span className="svc-feature-tag">{service.featuredCategory.tag}</span><h3>{questionHeading(service.featuredCategory.title)}</h3><p>{service.featuredCategory.description}</p><span className="svc-feature-tag">{service.featuredCategory.cta} →</span></a>}<div className="svc-four">{service.otherServices?.slice(0, 4).map((item) => <a className="svc-mini" href={serviceHref(item.url, data.serviceRoutes)} key={item._key || item.name}><b>{item.name}</b><span>{item.description}</span></a>)}</div></div></section>

      <section className="section-tint" id="pricing"><div className="wrap"><h2>{questionHeading(presentation?.pricingHeadingAsQuestion === false ? `${service.pricing?.heading} in ${area.name}` : asQuestion(service.pricing?.heading, area.name))}</h2><p className="lede narrow">{service.pricing?.lede}</p><div className="table-wrap" tabIndex={0} aria-label={`${service.name} pricing table, scroll horizontally to view all columns`}><table><caption>{service.pricing?.caption}</caption><thead><tr><th>{service.pricing?.column1}</th><th>{service.pricing?.column2}</th><th>{service.pricing?.column3}</th></tr></thead><tbody>{service.pricing?.rows?.map((row) => <tr key={row._key || row.job}><td>{row.job}</td><td>{row.driver}</td><td>{row.permit}</td></tr>)}</tbody></table></div>{service.pricing?.note && <p className="small muted section-note">{service.pricing.note}</p>}</div></section>

      <section className="wrap" id="faq"><h2>{questionHeading(`${service.name} in ${area.name} — FAQs`)}</h2><div className="faq">{[...(service.faqs || []), ...(localFaqs || [])].map((faq) => <details key={faq._key || faq.question}><summary><span>{faq.question}</span><span className="faq-chevron" aria-hidden="true" /></summary><div className="faq-body"><p>{faq.answer}</p></div></details>)}</div></section>

      <section className="wrap closing-cta-section"><div className="cta-final"><h2 className="cta-heading">{questionHeading(`${service.ctaHeading} in ${area.name}?`)}</h2><p>{service.ctaBody}</p><div className="btn-row centered"><a className="btn btn-primary" href={`tel:${settings.phoneE164}`}>Call {settings.phoneDisplay}</a><a className="btn btn-secondary" href="#quote">{service.secondaryCta}</a></div></div></section>

      {guideItems.length > 0 && <section className="section-tint library-section" id="guides"><div className="wrap"><h2>{questionHeading(area.libraryHeading)}</h2><p className="lede narrow">{area.libraryLede}</p><GuideTabs guides={guideItems} /></div></section>}

      <div className="callbar"><a className="c-call" href={`tel:${settings.phoneE164}`}>Call {settings.phoneDisplay}</a><a className="c-form" href="#quote">Book service</a></div>
      <JsonLd data={data} />
      </main>
      <CollectionFooter />
    </div>
  )
}
