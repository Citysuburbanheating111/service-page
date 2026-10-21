// Header and footer menus, mirroring the live citysuburbanheating.com menus.
//
// Labels, order and links are copied exactly from the live WordPress menu and footer
// (03/10/2026). These 24 dropdown keyword URLs are the exact paths in the approved
// GitHub directory. The production proxy rollout is managed separately.
// "Service Areas" is replaced by "Services", with the same two-column dropdown as
// the live home page menu: four other services and four main service areas.

export const LIVE_SITE = 'https://citysuburbanheating.com'

export type MenuLink = {label: string; href: string}
export type MenuGroup = MenuLink & {items: MenuLink[]}

const wp = (path: string) => `${LIVE_SITE}${path}`

export const liveMenu: MenuGroup[] = [
  {
    label: 'Heating',
    href: wp('/services/heating/'),
    items: [
      {label: 'Heater repair', href: wp('/services/heating/heater-repair/')},
      {label: 'Boiler Services', href: wp('/services/heating/boiler-service/')},
      {label: 'Heat Pump', href: wp('/services/heating/heat-pump/')},
      {label: 'Hybrid Heating Systems', href: wp('/services/heating/hybrid-heating-systems/')},
      {label: 'HVAC Maintenance Plans', href: wp('/services/heating/hvac-maintenance-plans/')},
      {label: 'Heater Installation', href: wp('/services/heating/heater-installation/')},
      {label: 'Heater Maintenance', href: wp('/services/heating/heater-maintenance/')},
    ],
  },
  {
    label: 'Cooling',
    href: wp('/services/cooling/'),
    items: [
      {label: 'Ductless HVAC Services', href: wp('/services/cooling/ductless-hvac-service/')},
      {label: 'Air Conditioning Repair', href: wp('/services/cooling/air-conditioning-repair/')},
      {label: 'Air Conditioning Maintenance', href: wp('/services/cooling/air-conditioning-maintenance/')},
      {label: 'Air Conditioning Installation', href: wp('/services/cooling/air-conditioning-installation/')},
      {label: 'Cooling Maintenance Plans', href: wp('/services/cooling/cooling-maintenance-plans/')},
      {label: 'Heat Pump Services', href: wp('/services/cooling/heat-pump-services/')},
    ],
  },
  {
    label: 'Air Quality',
    href: wp('/services/air-quality/'),
    items: [
      {label: 'Dehumidifier Installation', href: wp('/services/air-quality/dehumidifier-installation/')},
      {label: 'Indoor Air Quality Test', href: wp('/services/air-quality/indoor-air-quality-test/')},
      {label: 'Duct Repair', href: wp('/services/air-quality/duct-repair/')},
      {label: 'Duct Maintenance', href: wp('/services/air-quality/duct-maintenance/')},
      {label: 'Humidifier & Air Cleaner', href: wp('/services/air-quality/humidifier-air-cleaner/')},
    ],
  },
  {
    label: 'Commercial',
    href: wp('/services/commercial/'),
    items: [
      {label: 'Commercial HVAC System Installation', href: wp('/services/commercial/commercial-hvac-system-installation/')},
      {label: 'Commercial HVAC System Replacement', href: wp('/services/commercial/commercial-hvac-system-replacement/')},
      {label: 'Emergency & Routine Commercial HVAC Repairs', href: wp('/services/commercial/emergency-routine-commercial-hvac-repairs/')},
      {label: 'Energy-Efficient HVAC Upgrades', href: wp('/services/commercial/energy-efficient-hvac-upgrades/')},
      {label: 'Custom HVAC Maintenance Plan', href: wp('/services/commercial/custom-hvac-maintenance-plan/')},
      {label: 'Ductwork Design & Repair Services', href: wp('/services/commercial/ductwork-design-repair-services/')},
    ],
  },
]

export type ServicesColumn = {heading: string; items: MenuLink[]; all: MenuLink}

// Copied from the live home page "Services" menu (21/10/2026).
export const servicesMenu: MenuLink & {columns: ServicesColumn[]} = {
  label: 'Services',
  href: '/services/',
  columns: [
    {
      heading: 'Other services',
      items: [
        {label: 'Radiator & Radiant Heat Service', href: wp('/services/heating/radiator-radiant-heat-repair-installation/')},
        {label: 'Window & Portable AC Installation & Repair', href: wp('/services/cooling/window-portable-ac-installation-repair/')},
        {label: 'Air Duct Cleaning, Repair & Sealing', href: wp('/services/indoor-air-quality-ventilation/air-duct-cleaning-repair/')},
        {label: 'Commercial Refrigeration & Ice Machine Service', href: wp('/services/commercial-specialty/commercial-refrigeration-repair-maintenance/')},
      ],
      all: {label: 'All services →', href: wp('/services/')},
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
  {label: 'Heating', href: wp('/services/heating/')},
  {label: 'Cooling', href: wp('/services/cooling/')},
  {label: 'Air Quality', href: wp('/services/air-quality/')},
  {label: 'Commercial', href: wp('/services/commercial/')},
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
