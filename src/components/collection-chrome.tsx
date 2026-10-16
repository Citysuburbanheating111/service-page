/* eslint-disable @next/next/no-img-element */

// Site header and footer. They mirror the live citysuburbanheating.com header and
// footer so the new pages sit seamlessly inside the main site. The only difference
// is the last menu item: "Services" (this app's collection > clusters > landing
// pages) replaces "Service Areas". It is a plain link with no dropdown: the
// collection page is the way into the cluster and landing-page layers.

import {LiveSiteFooter} from './live-site-footer'
import {SiteNavigation} from './site-navigation'

import {business, topBarLinks, LIVE_SITE} from '@/lib/site-navigation'

const icons = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z',
  calendar: 'M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm12 8H5v9h14v-9ZM7 12h4v4H7v-4Z',
  mail: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L4 7.3V17h16V7.3l-8 4.9Z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z',
  Facebook: 'M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z',
  Instagram: 'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm4.8-4.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  Yelp: 'M12.3 2.2c-.6-.3-4.8 1-5.4 1.4-.4.3-.5.9-.3 1.3l4.4 7.6c.6 1 1.7.6 1.7-.5V3c0-.4-.2-.7-.4-.8ZM20 9.8c-.3-.6-2.6-3.6-3.3-3.8-.4-.1-.9 0-1.2.4l-3 4.1c-.6.9.3 1.9 1.3 1.6l5.5-1.3c.6-.2.9-.6.7-1ZM20.4 15.4c.1-.6-1-4-1.5-4.4-.4-.3-.9-.3-1.2-.1l-4.6 2.7c-1 .6-.4 1.9.7 1.9l5.7.6c.5 0 .8-.3.9-.7ZM15.3 21c.6-.2 2.6-3.2 2.7-3.9 0-.4-.2-.8-.6-1l-4.7-2.4c-1-.5-1.9.5-1.4 1.4l3 5.4c.3.5.7.6 1 .5ZM9.7 13.3 4.8 11.5c-.6-.2-1.2.2-1.3.8-.2 1-.2 3.3.3 4.2.2.4.7.6 1.1.5l5-1.8c1-.4 1-1.6-.2-1.9Z',
} as const

function Icon({name, className}: {name: keyof typeof icons; className?: string}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d={icons[name]} />
    </svg>
  )
}

export function CollectionHeader() {
  return (
    <div className="site-header-stack">
      <div className="site-topbar">
        <div className="site-shell site-topbar-inner">
          <span className="site-topbar-text">Trusted HVAC Experts &apos;From City to Suburbs&apos;</span>
          <span className="site-topbar-text site-topbar-divided">Working Hours: 24/7</span>
          <a className="site-topbar-rating site-topbar-divided" href={business.reviewsHref} aria-label="Google rating 5.0 out of 5">
            <img src={business.googleRating} alt="" width={118} height={22} />
          </a>
          <nav className="site-topbar-links" aria-label="Company">
            {topBarLinks.map((link) => <a href={link.href} key={link.label}>{link.label}</a>)}
          </nav>
        </div>
      </div>

      <header className="site-header" data-module="site-header">
        <div className="site-shell site-header-inner">
          <a className="site-logo" href={`${LIVE_SITE}/`}>
            <img src={business.logo} alt="City Suburban Logo" width={190} height={67} />
          </a>

          <SiteNavigation />

          <div className="site-header-actions">
            <a className="site-call" href={business.phoneHref}>
              <Icon name="phone" className="site-call-icon" />
              <span><small>Call</small>{business.phoneDisplay}</span>
            </a>
            <a className="site-schedule" href={business.scheduleHref}>Schedule Service<Icon name="calendar" className="site-btn-icon" /></a>
          </div>

        </div>
      </header>

      <div className="site-mobile-actions" aria-label="Quick service actions">
        <a href={business.phoneHref}>Call Us</a>
        <a href={business.scheduleHref}>Schedule Service</a>
      </div>
    </div>
  )
}

export function CollectionFooter() {
  return <LiveSiteFooter />
}
