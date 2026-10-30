/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import {CollectionFooter, CollectionHeader} from '@/components/collection-chrome'
import {CollectionHero, CollectionTrustBand} from '@/components/collection-hero'
import {BrandServiceCollection} from '@/components/brand-service-collection'
import {brandDirectory, listWords, type DirectoryBrand, type DirectoryPage} from '@/lib/brand-directory'

function capitalized(items: string[]) {
  return items.map((item, index) => index ? item : item[0].toUpperCase() + item.slice(1))
}

/** /services/brands/: one cluster card per brand, in the live /services/ card design. */
export function BrandDirectoryPage() {
  const pageCount = brandDirectory.reduce((total, brand) => total + brand.pages.length, 0)
  return (
    <div className="collection-page">
      <CollectionHeader />
      <main>
        <nav className="collection-breadcrumb collection-wrap" aria-label="Breadcrumb">
          <ol>
            <li><a href="https://citysuburbanheating.com/">Home</a></li>
            <li><Link href="/">Services</Link></li>
            <li aria-current="page">Brands</li>
          </ol>
        </nav>
        <CollectionHero
          kicker="Family-owned HVAC company since 1952"
          title="HVAC brands we repair and install in Chicago"
          text={`Repair, installation and maintenance for ${brandDirectory.length} heating, cooling and water heater brands in Chicago homes and buildings.`}
          action="Explore brands"
          count={brandDirectory.length}
          countLabel={['brands', '']}
          panelKicker="Brands we service"
          panelNote={`${pageCount} brand services · Chicago`}
        />
        <section className="collection-directory cluster-directory" aria-labelledby="service-directory-title">
          <div className="collection-wrap">
            <div className="cluster-directory-heading">
              <div>
                <p className="cluster-directory-eyebrow">Find your brand</p>
                <h2 className="collection-kicker" id="service-directory-title">Explore by brand</h2>
              </div>
              <p>Choose your equipment&apos;s brand to see the repair and installation help available for it.</p>
            </div>
            <div className="cluster-card-grid">
              {brandDirectory.map((brand) => (
                <Link aria-label={`View all ${brand.name} services`} className="cluster-card" data-system={brand.slug} href={`/${brand.slug}/`} key={brand.slug}>
                  <span className={`cluster-card-media brand-media${brand.darkLogo ? ' is-dark' : ''}`}>
                    <img alt={`${brand.name} logo`} decoding="async" loading="lazy" src={brand.logo} />
                    <span className="cluster-card-count">{brand.pages.length} {brand.pages.length === 1 ? 'service' : 'services'}</span>
                  </span>
                  <span className="cluster-card-content">
                    <strong className="cluster-card-title">{brand.name}</strong>
                    <span className="cluster-card-description-text">{listWords(capitalized(brand.equipment))}.</span>
                    <span className="cluster-card-link">Explore services <span aria-hidden="true">→</span></span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <CollectionTrustBand />
      </main>
      <CollectionFooter />
    </div>
  )
}

/** /services/<brand>/: the brand's pages as service cards, linked once each page is published. */
export function BrandLevelPage({brand, pages}: {brand: DirectoryBrand; pages: DirectoryPage[]}) {
  const count = pages.length
  return (
    <div className="collection-page">
      <CollectionHeader />
      <main>
        <nav className="collection-breadcrumb collection-wrap" aria-label="Breadcrumb">
          <ol>
            <li><a href="https://citysuburbanheating.com/">Home</a></li>
            <li><Link href="/">Services</Link></li>
            <li><Link href="/brands/">Brands</Link></li>
            <li aria-current="page">{brand.name}</li>
          </ol>
        </nav>
        <section className="collection-level-hero">
          <div className="collection-wrap collection-level-hero-grid">
            <div>
              <p className="collection-hero-kicker">City &amp; Suburban services</p>
              <h1>{brand.name} services in Chicago</h1>
              <p>{brand.name} {listWords(brand.equipment)}: repair, installation and maintenance for Chicago homes.</p>
              <div className="collection-hero-actions">
                <a href="#service-directory-title">Browse {brand.name} services</a>
                <a href="https://citysuburbanheating.com/contact-us/">Schedule service</a>
              </div>
            </div>
            <div className="collection-level-stat brand-level-stat">
              <span>{brand.name}</span>
              <strong>{count}</strong>
              <h2>{count === 1 ? 'Service' : 'Services'} for this brand</h2>
              <div className={`brand-panel-logo${brand.darkLogo ? ' is-dark' : ''}`}><img alt={`${brand.name} logo`} src={brand.logo} /></div>
            </div>
          </div>
        </section>
        <BrandServiceCollection
          pages={pages}
          kicker={`${brand.name} directory`}
          heading={`Choose a ${brand.name} service`}
          description={`Pick the page for your ${brand.name} equipment, then the service that matches what it is doing: repair for a fault, maintenance for routine care, installation when the equipment needs replacing. If the right page is unclear, call (773) 238-3838 and describe the symptoms. If a carbon monoxide alarm sounds, you smell gas, or you see smoke, leave the building and call 911 from outside before calling for service.`}
        />
      </main>
      <CollectionFooter />
    </div>
  )
}
