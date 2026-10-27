// Header and footer menus, mirroring the live citysuburbanheating.com menus.
//
// Labels, order and links are copied exactly from the live WordPress menu and footer
// (03/10/2026); links to service pages are relative (see app() below). These 24 dropdown keyword URLs are the exact paths in the approved
// GitHub directory. The production proxy rollout is managed separately.
// "Service Areas" is replaced by "Services", with the same two-column dropdown as
// the live home page menu: four other services and four main service areas.

export const LIVE_SITE = 'https://citysuburbanheating.com'

export type MenuLink = {label: string; href: string}
export type MenuGroup = MenuLink & {items: MenuLink[]}

const wp = (path: string) => `${LIVE_SITE}${path}`
// Service pages are this app, so their links stay relative: on the live site they
// open citysuburbanheating.com/services/..., and in a local or preview build they
// stay in that build. WordPress pages (home, about, service areas) use wp().
const app = (path: string) => path

export const liveMenu: MenuGroup[] = [
  {
    label: 'Heating',
    href: app('/services/heating/'),
    items: [
      {label: 'Heater repair', href: app('/services/heating/heater-repair-near-me/')},
      {label: 'Boiler Services', href: app('/services/heating/boiler-service-near-me/')},
      {label: 'Heat Pump', href: app('/services/heating/heat-pump-near-me/')},
      {label: 'Hybrid Heating Systems', href: app('/services/heating/hybrid-heating-systems-near-me/')},
      {label: 'HVAC Maintenance Plans', href: app('/services/heating/hvac-maintenance-plans-near-me/')},
      {label: 'Heater Installation', href: app('/services/heating/heater-installation-near-me/')},
      {label: 'Heater Maintenance', href: app('/services/heating/heater-maintenance-near-me/')},
    ],
  },
  {
    label: 'Cooling',
    href: app('/services/cooling/'),
    items: [
      {label: 'Ductless HVAC Services', href: app('/services/cooling/ductless-hvac-service-near-me/')},
      {label: 'Air Conditioning Repair', href: app('/services/cooling/air-conditioning-repair-near-me/')},
      {label: 'Air Conditioning Maintenance', href: app('/services/cooling/air-conditioning-maintenance-near-me/')},
      {label: 'Air Conditioning Installation', href: app('/services/cooling/air-conditioning-installation-near-me/')},
      {label: 'Cooling Maintenance Plans', href: app('/services/cooling/cooling-maintenance-plans-near-me/')},
      {label: 'Heat Pump Services', href: app('/services/cooling/heat-pump-services-near-me/')},
    ],
  },
  {
    label: 'Air Quality',
    href: app('/services/air-quality/'),
    items: [
      {label: 'Dehumidifier Installation', href: app('/services/air-quality/dehumidifier-installation-near-me/')},
      {label: 'Indoor Air Quality Test', href: app('/services/air-quality/indoor-air-quality-test-near-me/')},
      {label: 'Duct Repair', href: app('/services/air-quality/duct-repair-near-me/')},
      {label: 'Duct Maintenance', href: app('/services/air-quality/duct-maintenance-near-me/')},
      {label: 'Humidifier & Air Cleaner', href: app('/services/air-quality/humidifier-air-cleaner-near-me/')},
    ],
  },
  {
    label: 'Commercial',
    href: app('/services/commercial/'),
    items: [
      {label: 'Commercial HVAC System Installation', href: app('/services/commercial/commercial-hvac-system-installation-near-me/')},
      {label: 'Commercial HVAC System Replacement', href: app('/services/commercial/commercial-hvac-system-replacement-near-me/')},
      {label: 'Emergency & Routine Commercial HVAC Repairs', href: app('/services/commercial/emergency-routine-commercial-hvac-repairs-near-me/')},
      {label: 'Energy-Efficient HVAC Upgrades', href: app('/services/commercial/energy-efficient-hvac-upgrades-near-me/')},
      {label: 'Custom HVAC Maintenance Plan', href: app('/services/commercial/custom-hvac-maintenance-plan-near-me/')},
      {label: 'Ductwork Design & Repair Services', href: app('/services/commercial/ductwork-design-repair-services-near-me/')},
    ],
  },
]

// `all` closes the column in red; `more` adds red links under it (Brand services → the brands cluster)
export type ServicesColumn = {heading: string; items: MenuLink[]; all: MenuLink; more?: MenuLink[]}

// Copied from the live home page "Services" menu (21/10/2026).
export const servicesMenu: MenuLink & {columns: ServicesColumn[]} = {
  label: 'Services',
  href: '/services/',
  columns: [
    {
      heading: 'Other services',
      items: [
        {label: 'Radiator & Radiant Heat Service', href: app('/services/heating/radiator-radiant-heat-repair-installation-near-me/')},
        {label: 'Window & Portable AC Installation & Repair', href: app('/services/cooling/window-portable-ac-installation-repair-near-me/')},
        {label: 'Air Duct Cleaning, Repair & Sealing', href: app('/services/indoor-air-quality-ventilation/air-duct-cleaning-repair-near-me/')},
        {label: 'Commercial Refrigeration & Ice Machine Service', href: app('/services/commercial-specialty/commercial-refrigeration-repair-maintenance-near-me/')},
      ],
      all: {label: 'All services →', href: app('/services/')},
      more: [{label: 'Brand services →', href: app('/services/brands/')}],
    },
    {
      heading: 'Service areas',
      items: [
        {label: 'West Loop', href: wp('/service-area/west-loop/')},
        {label: 'Lincoln Park', href: wp('/service-area/lincoln-park/')},
        {label: 'Wicker Park', href: wp('/service-area/wicker-park/')},
        {label: 'Lakeview', href: wp('/service-area/lakeview/')},
      ],
      all: {label: 'All service areas →', href: wp('/service-areas/')},
    },
  ],
}

export const topBarLinks: MenuLink[] = [
  {label: 'Finance', href: 'https://retailservices.wellsfargo.com/pl/0024376626'},
  {label: 'About Us', href: wp('/about-us/')},
  {label: 'Contact Us', href: wp('/contact-us/')},
]

export const footerServiceLinks: MenuLink[] = [
  {label: 'Heating', href: app('/services/heating/')},
  {label: 'Cooling', href: app('/services/cooling/')},
  {label: 'Air Quality', href: app('/services/air-quality/')},
  {label: 'Commercial', href: app('/services/commercial/')},
]

export const business = {
  phoneDisplay: '(773) 238-3838',
  phoneShort: '773-238-3838',
  phoneHref: 'tel:+17732383838',
  email: 'service@citysuburbanheating.com',
  address: '1225 North Cleaver Street, Chicago, Illinois 60642, United States',
  mapsHref: 'https://maps.app.goo.gl/vAjkqcNb4BBPs41aA',
  reviewsHref: 'https://www.google.com/maps/place/City+%26+Suburban+Heating+%26+Cooling/@41.90408,-87.6634153,17z/data=!4m8!3m7!1s0x880fd302d5248501:0xb1c6abfab8cf849b!8m2!3d41.9042251!4d-87.6635221!9m1!1b1',
  financeHref: 'https://retailservices.wellsfargo.com/pl/0024376626',
  scheduleHref: wp('/contact-us/'),
  logo: wp('/wp-content/uploads/2025/05/city-suburban-transparent-logo.png'),
  googleRating: wp('/wp-content/uploads/2025/05/google-rating-image.png'),
  socials: [
    {label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61576251038690'},
    {label: 'Instagram', href: 'https://www.instagram.com/city_suburban_heating_cooling'},
    {label: 'Yelp', href: 'https://www.yelp.com/biz/city-and-suburban-heating-and-cooling-chicago'},
  ],
} as const
