'use client'

import {useMemo, useState} from 'react'
import type {DirectoryPage} from '@/lib/brand-directory'

type Props = {pages: DirectoryPage[]; kicker: string; heading: string; description: string}

/** A brand's service cards with the live collection search. Unpublished pages show where they stand instead of a link. */
export function BrandServiceCollection({pages, kicker, heading, description}: Props) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return pages.filter((page) => !term || `${page.title} ${page.description}`.toLowerCase().includes(term))
  }, [query, pages])

  return (
    <section className="collection-directory service-directory" aria-labelledby="service-directory-title">
      <div className="collection-wrap">
        <div className="collection-directory-heading">
          <div>
            <p className="collection-kicker">{kicker}</p>
            <h2 id="service-directory-title">{heading}</h2>
          </div>
          <p>{description}</p>
        </div>
        <div className="collection-toolbar">
          <label>
            <span>Search services</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by equipment or service" type="search" />
          </label>
          <p className="collection-result-count" aria-live="polite">Showing <strong>{filtered.length}</strong> of {pages.length} {pages.length === 1 ? 'service' : 'services'}</p>
        </div>
        {filtered.length === 0 && <div className="collection-empty"><h3>No matching services</h3><p>Try a broader service name or clear the search.</p><button type="button" onClick={() => setQuery('')}>Clear filters</button></div>}
        <div className="collection-card-grid">
          {filtered.map((page) => {
            const content = <>
              <span className={`collection-card-media${page.image ? '' : ' collection-card-media-empty'}`} style={page.image ? {backgroundImage: `linear-gradient(180deg, rgba(9,38,58,0) 45%, rgba(9,38,58,.14)), url("${page.image}")`} : undefined} role="img" aria-label={`${page.title} in Chicago`}>
                {!page.image && <span aria-hidden="true">CS</span>}
              </span>
              <span className="collection-card-arrow" aria-hidden="true">→</span>
              <span className="collection-card-content">
                <strong>{page.title}</strong>
                <span className="collection-card-description">{page.description}</span>
                {!page.href && <span className="collection-card-description brand-card-soon">Page coming soon.</span>}
              </span>
            </>
            return page.href
              ? <a className="collection-card brand-service-card" data-card-image={page.image || undefined} href={page.href} key={page.slug}>{content}</a>
              : <div className="collection-card brand-service-card is-soon" data-card-image={page.image || undefined} key={page.slug}>{content}</div>
          })}
        </div>
      </div>
    </section>
  )
}
