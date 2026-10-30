/** The /services/ hub hero (copy, actions and the count panel), shared with the brands hub. */
export function CollectionHero({kicker, title, text, action, count, countLabel, panelKicker, panelNote}: {
  kicker: string; title: string; text: string; action: string
  count: number; countLabel: [string, string]; panelKicker: string; panelNote: string
}) {
  return (
    <section className="collection-hero">
      <div className="collection-wrap collection-hero-grid">
        <div>
          <p className="collection-hero-kicker">{kicker}</p>
          <h1>{title}</h1>
          <p>{text}</p>
          <div className="collection-hero-actions">
            <a href="#service-directory-title">{action}</a>
            <a href="https://citysuburbanheating.com/contact-us/">Schedule service</a>
          </div>
        </div>
        <div className="collection-hero-panel" aria-label={`${count} ${countLabel.filter(Boolean).join(' ')}`}>
          <span className="collection-hero-panel-kicker">{panelKicker}</span>
          <div className="collection-hero-panel-count">
            <strong>{count}</strong>
            <span>{countLabel[0]}{countLabel[1] && <><br />{countLabel[1]}</>}</span>
          </div>
          <svg className="collection-hero-svg" viewBox="0 0 340 250" aria-hidden="true">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle className="collection-hero-orbit" cx="204" cy="124" r="91" />
              <circle className="collection-hero-orbit collection-hero-orbit-inner" cx="204" cy="124" r="68" />
              <path className="collection-hero-home" d="m151 116 53-43 53 43v62h-106Z" />
              <path className="collection-hero-roof" d="m141 119 63-51 63 51" />
              <path className="collection-hero-divider" d="M204 81v88" />
              <path className="collection-hero-flame" d="M182 151c-13-9-17-21-9-33 3 7 8 9 11 2 4-9-1-17-1-17 17 10 24 23 18 36-4 8-10 12-19 12Z" />
              <g className="collection-hero-snowflake">
                <path d="M229 105v47M209 117l40 23M209 140l40-23" />
                <path d="m229 105-6 8m6-8 6 8m-6 39-6-8m6 8 6-8M209 117l10 1m-10-1 4 9m36 14-10-1m10 1-4-9M209 140l4-9m-4 9 10-1m30-22-4 9m4-9-10 1" />
              </g>
              <g className="collection-hero-nodes">
                <circle cx="204" cy="24" r="8" />
                <circle cx="291" cy="74" r="8" />
                <circle cx="291" cy="174" r="8" />
                <circle cx="204" cy="224" r="8" />
                <circle cx="117" cy="174" r="8" />
                <circle cx="117" cy="74" r="8" />
              </g>
            </g>
          </svg>
          <p>{panelNote}</p>
          <a href="tel:+17732383838">Call (773) 238-3838 <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  )
}

export function CollectionTrustBand() {
  return (
    <section className="collection-trust-band">
      <div className="collection-wrap">
        <p>Why City & Suburban</p>
        <div><strong>1952</strong><span>Family-owned since</span></div>
        <div><strong>24/7</strong><span>Service availability</span></div>
        <div><strong>4.98</strong><span>Across 204 Google reviews</span></div>
        <a href="https://citysuburbanheating.com/about-us/">Meet the company <span aria-hidden="true">→</span></a>
      </div>
    </section>
  )
}
