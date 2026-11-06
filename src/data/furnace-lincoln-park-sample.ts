import type {ServicePageData} from '@/types/content'

// Review sample assembled from the first matching row in each supplied workbook.
// Keeping the three sources separate makes the merge contract easy to audit before
// the same transformation is moved into the Sanity import workflow.
export const furnaceEquipmentRow = {
  slug: 'furnace',
  displayName: 'Furnace',
  displayNameLower: 'furnace',
  categoryGroup: 'Heating',
  categorySlug: 'heating',
  symptomWord: 'heat',
  permitFee: '$100',
  priceMin: 150,
  priceMax: 600,
  seasonalAdvice: 'Demand across Chicago spikes hard at the first sustained freeze. September and October are when maintenance gets dealt with calmly rather than urgently.',
  commonProblems: [
    {title: 'Short-cycling', summary: 'Furnace fires and shuts off repeatedly', detail: 'The furnace fires, satisfies the thermostat in eight minutes, shuts down, and repeats all evening. It is often oversized for the space it now serves.'},
    {title: 'Limit-switch failures', summary: 'Restricted airflow overheats the plenum', detail: 'Restricted airflow overheats the plenum, the high-limit safety trips, and after enough cycles the switch itself fails.'},
  ],
  priceTable: [
    {repair: 'Flame sensor or igniter', range: '$150–$350', context: 'The most common no-heat cause across Chicago.'},
    {repair: 'Limit switch', range: '$180–$420', context: 'Common when restricted returns overheat the plenum.'},
    {repair: 'Inducer motor', range: '$300–$600', context: 'Older retrofitted units often run harder and longer.'},
  ],
  genericFaq: {question: 'Do I need a permit for furnace repair?', answer: 'No. A straightforward repair does not require one. Replacing the furnace does and typically carries a $100 City of Chicago mechanical permit.'},
  contractorQuestions: [
    {question: 'Did you calculate the load, or match the old nameplate?', answer: 'In converted buildings the old size is frequently wrong.'},
    {question: 'Is the return air adequate for this equipment?', answer: 'If nobody mentions returns, they have not looked properly.'},
  ],
} as const

export const lincolnParkAreaRow = {
  slug: 'lincoln-park',
  displayName: 'Lincoln Park',
  zip: '60614',
  lat: 41.9214,
  lon: -87.6513,
  distanceMinutes: 15,
  distanceMiles: 3,
  exampleCrossStreets: 'Fullerton & Halsted',
  mapQuery: 'Lincoln Park, Chicago, IL 60614',
  housingStock: [
    '60614 is dominated by pre-war construction—greystones, brick two-flats and three-flats, and courtyard buildings.',
    'Practically, that means masonry construction with limited chase space and ductwork threaded through closets after the fact.',
  ],
  landmarkNote: 'Parts of Lincoln Park sit within Chicago landmark districts, restricting what can be mounted on a street-facing elevation.',
  boundaryDescription: 'Roughly bounded by Diversey to the north, North Avenue to the south, the lake to the east, and the river to the west.',
  parkingNote: 'Most of 60614 is permit-zone parking. Our technicians handle it.',
  populationNote: 'More than 60,000 residents live across a neighborhood that is far from uniform.',
  buildingTypes: [
    {name: 'Greystone', note: 'Often an original boiler or retrofitted forced air.'},
    {name: 'Brick two-flat', note: 'One system may serve both units, or each unit may have its own furnace.'},
    {name: 'Converted loft', note: 'Double-height space can create heat-stratification issues.'},
    {name: 'Lakefront high-rise', note: 'Central plant or fan-coil systems are often subject to association rules.'},
  ],
  subareas: [
    {name: 'DePaul & Sheffield Neighbors', note: 'Dense two-flat and three-flat stock, heavily converted to condos.'},
    {name: 'Wrightwood Neighbors & Park West', note: 'More single-family greystones and larger rehabbed homes.'},
  ],
  nearbyAreas: [
    {slug: 'old-town', name: 'Old Town'},
    {slug: 'bucktown', name: 'Bucktown'},
    {slug: 'wicker-park', name: 'Wicker Park'},
  ],
  genericFaq: {question: 'How fast can you get to Lincoln Park?', answer: 'Lincoln Park is about three miles from our shop and usually around fifteen minutes away outside rush hour.'},
} as const

export const furnaceLincolnParkPageRow = {
  equipmentSlug: 'furnace',
  areaSlug: 'lincoln-park',
  metaDescriptionHook: 'We know the greystones, two-flats and courtyard buildings—and the landmark-district rules.',
  openingParagraph: 'Lincoln Park heating is not generic Chicago heating. Greystones with retrofitted ductwork, two-flats with one system serving two units, and condo conversions sharing a flue all change how a furnace problem should be diagnosed.',
  quickAnswer: 'Furnace repair in Lincoln Park typically costs $150 to $600, the same range as the rest of Chicago. What differs is the housing.',
  typicalFinds: 'We commonly find forced-air furnaces retrofitted into buildings originally heated by steam or hot water, along with undersized return-air paths because there was nowhere good to run them.',
  permitTotal: 83,
  permitEquipmentCount: 11,
  permitBrands: ['Carrier', 'Comfortmaker'],
  permitCommentary: 'Boilers are not a footnote here—boiler-related permits run at roughly two-thirds the volume of furnace permits.',
  guideIntro: 'Lincoln Park is not one housing type; it is four or five layered on top of each other.',
  customContractorQuestion: {question: 'Is my block in a landmark district?', answer: 'That matters the moment anything goes on a visible elevation.'},
  photoSlots: [
    {alt: 'Before and after—Lincoln Park furnace swap', note: 'A future Sanity image slot for local before-and-after proof.'},
    {alt: 'City & Suburban van outside a Lincoln Park greystone', note: 'A future Sanity image slot for unmistakably local proof.'},
  ],
  reviews: [
    {quote: "I'd give City & Suburban six stars if I could. My furnace went out during our first snowfall.", author: 'Jack S.', location: 'Goose Island—adjacent to Lincoln Park'},
    {quote: "Rob's service is always top notch.", author: 'Nick U.', location: 'Chicago'},
  ],
  customFaq: {question: 'My condo has one furnace for two units. Who pays for the repair?', answer: "That depends on the association's declarations and whether the furnace is defined as a common element or assigned to one unit."},
} as const

const commonProblemTypes = furnaceEquipmentRow.commonProblems.map((problem, index) => ({
  _key: `problem-${index + 1}`,
  name: problem.title,
  description: `${problem.summary}. ${problem.detail}`,
}))

const coverageAreas = [
  ...lincolnParkAreaRow.subareas.map((area, index) => ({_key: `subarea-${index + 1}`, name: area.name, note: area.note})),
  ...lincolnParkAreaRow.nearbyAreas.map((area, index) => ({_key: `nearby-${index + 1}`, name: area.name, note: 'Nearby City & Suburban service area'})),
]

export const furnaceLincolnParkSample: ServicePageData = {
  serviceRoutes: [{serviceSlug: furnaceEquipmentRow.slug, areaSlug: lincolnParkAreaRow.slug}],
  settings: {
    companyName: 'City & Suburban Heating & Cooling',
    siteUrl: 'https://citysuburbanheating.com',
    phoneDisplay: '(773) 238-3838',
    phoneE164: '+17732383838',
    email: 'service@citysuburbanheating.com',
    address: {street: '1225 North Cleaver Street', city: 'Chicago', state: 'IL', zip: '60642'},
    schemaBusinessType: 'HVACBusiness',
    brand: {primary: '#09263A', dark: '#061B29', light: '#EEF4F7', secondary: '#0A4265', accent: '#DD382B', accentDark: '#B92E23'},
    google: {rating: 5, reviewCount: 190, reviewsUrl: 'https://www.google.com/search?q=City+%26+Suburban+Heating+%26+Cooling+reviews'},
    trustLines: ['Family-owned since 1952', 'NATE-certified technicians', '24/7 service'],
    trustHeading: 'Why do Chicago homeowners call City & Suburban?',
    trustLede: 'A neighborhood HVAC company with decades of local experience, transparent recommendations, and service vans prepared for common repairs.',
    trustMetrics: [
      {_key: 'years', value: '70+', label: 'Years serving Chicagoland'},
      {_key: 'availability', value: '24/7', label: 'Service availability'},
      {_key: 'certification', value: 'NATE', label: 'Certified technicians'},
      {_key: 'distance', value: '3 mi', label: 'From our shop to Lincoln Park'},
    ],
    trustCards: [
      {_key: 'diagnostics', title: 'What starts every service call?', body: 'A clear diagnosis before repair recommendations, so you understand the problem and the practical options.'},
      {_key: 'pricing', title: 'How is pricing handled?', body: 'Straightforward ranges and pressure-free recommendations, with no surprise work added without approval.'},
      {_key: 'local', title: 'Why does local building knowledge matter?', body: 'Greystones, two-flats, conversions, and shared systems each change access, airflow, venting, and responsibility.'},
    ],
    reviewsHeading: 'What do local customers say about our furnace service?',
    reviewsDisclaimer: 'Sample reviews are taken from the supplied City & Suburban page-specific content sheet. Source links can be attached in Sanity before production publishing.',
    formSubtitle: 'Tell us what your furnace is doing and where the property is located.',
    formNote: 'For urgent no-heat service, call us directly for the fastest response.',
  },
  page: {
    _id: 'sample-furnace-lincoln-park',
    title: 'Furnace Repair in Lincoln Park',
    seo: {
      title: 'Furnace Repair in Lincoln Park | City & Suburban',
      description: `Furnace repair for Lincoln Park greystones, two-flats and courtyard buildings. ${furnaceLincolnParkPageRow.metaDescriptionHook}`,
      canonicalUrl: 'https://citysuburbanheating.com/services/furnace/lincoln-park',
    },
    reviews: furnaceLincolnParkPageRow.reviews.map((review, index) => ({_key: `review-${index + 1}`, ...review})),
    gallery: [
      {_key: 'official-furnace', externalUrl: '/services/images/services/furnace-repair.png', alt: 'City & Suburban technician servicing an American Standard furnace'},
      ...furnaceLincolnParkPageRow.photoSlots.map((slot, index) => ({_key: `gallery-slot-${index + 1}`, alt: slot.alt, credit: slot.note})),
    ],
    workingPhotos: furnaceLincolnParkPageRow.photoSlots.map((slot, index) => ({_key: `work-slot-${index + 1}`, alt: slot.alt, credit: slot.note})),
    guides: [
      {
        _key: 'housing-guide',
        title: 'Lincoln Park homes and furnace access',
        legacyHtml: `<p>${furnaceLincolnParkPageRow.guideIntro}</p><p>${lincolnParkAreaRow.housingStock[0]}</p><p>${lincolnParkAreaRow.housingStock[1]}</p><p>${lincolnParkAreaRow.landmarkNote}</p>`,
      },
      {
        _key: 'permit-guide',
        title: 'What the local permit snapshot shows',
        legacyHtml: `<p>The supplied sample records ${furnaceLincolnParkPageRow.permitTotal} local permits, including ${furnaceLincolnParkPageRow.permitEquipmentCount} tied directly to furnace equipment. Brands named in the sample are ${furnaceLincolnParkPageRow.permitBrands.join(' and ')}.</p><p>${furnaceLincolnParkPageRow.permitCommentary}</p><p>These counts provide local context, not a quote. Final scope depends on diagnosis, access, venting, airflow, and whether equipment is repaired or replaced.</p>`,
      },
      {
        _key: 'neighborhood-guide',
        title: 'Lincoln Park service and neighborhood notes',
        legacyHtml: `<p>${lincolnParkAreaRow.boundaryDescription}</p><p>Typical reference point: ${lincolnParkAreaRow.exampleCrossStreets}. The neighborhood is about ${lincolnParkAreaRow.distanceMiles} miles from our shop, usually ${lincolnParkAreaRow.distanceMinutes} minutes outside rush hour.</p><p>${lincolnParkAreaRow.parkingNote}</p><p>${lincolnParkAreaRow.populationNote}</p>`,
      },
      {
        _key: 'furnace-guide',
        title: 'Furnace repair details for Lincoln Park',
        legacyHtml: `<p>${furnaceLincolnParkPageRow.quickAnswer}</p><p>${furnaceLincolnParkPageRow.typicalFinds}</p><p>${furnaceEquipmentRow.seasonalAdvice}</p>`,
      },
    ],
    localFaqOverrides: [
      {_key: 'page-faq', ...furnaceLincolnParkPageRow.customFaq},
      {_key: 'area-faq', ...lincolnParkAreaRow.genericFaq},
    ],
    template: {
      name: 'City & Suburban L4 service landing page',
      version: 'sample-1.0',
      active: true,
      sectionOrder: ['hero', 'types', 'brands', 'trust', 'reviews', 'why', 'workingArea', 'coverage', 'otherServices', 'pricing', 'faq', 'closingCta', 'guides'],
      presentation: {
        footerColor: '#09263A',
        accentColor: '#DD382B',
        accentDarkColor: '#B92E23',
        actionBlueColor: '#0A4265',
        equalHeightReviewCards: true,
        ratingAfterReviewText: true,
        coverageMapFirst: true,
        neighborhoodGrid: true,
        brandLogoCards: true,
        pricingHeadingAsQuestion: true,
      },
    },
    service: {
      serviceId: 1,
      name: 'Furnace Repair',
      slug: furnaceEquipmentRow.slug,
      parentName: furnaceEquipmentRow.categoryGroup,
      parentUrl: 'https://citysuburbanheating.com/services/heating/',
      hubUrl: 'https://citysuburbanheating.com/services/heating/heater-repair/',
      h1Prefix: 'Furnace Repair',
      heroLede: furnaceLincolnParkPageRow.openingParagraph,
      secondaryCta: 'Schedule furnace service',
      issueQuestion: 'What is your furnace doing?',
      issueOptions: ['No heat', 'Short-cycling', 'Breaker or limit switch keeps tripping', 'Strange noise or smell', 'Quote for replacement', 'Not sure'],
      typesHeading: 'What furnace problems do we commonly find in Lincoln Park?',
      typesLede: furnaceLincolnParkPageRow.quickAnswer,
      types: commonProblemTypes,
      typesFootnote: furnaceEquipmentRow.seasonalAdvice,
      brandsHeading: 'What furnace brands appear in the local sample',
      brandsLede: `The supplied page-specific row identifies ${furnaceLincolnParkPageRow.permitBrands.join(' and ')} in the local permit sample. City & Suburban diagnoses and services furnaces across major brands.`,
      brands: [...furnaceLincolnParkPageRow.permitBrands],
      brandsNote: furnaceLincolnParkPageRow.permitCommentary,
      whyHeading: 'What should you ask before approving furnace work?',
      whyLede: 'These questions merge the equipment-level contractor guidance with the page-specific Lincoln Park condition.',
      whyItems: [...furnaceEquipmentRow.contractorQuestions, furnaceLincolnParkPageRow.customContractorQuestion].map((item, index) => ({_key: `question-${index + 1}`, title: item.question, body: item.answer})),
      featuredCategory: {tag: 'Heating services', title: 'Complete heating service', description: 'Repair, maintenance, and replacement support for furnaces, boilers, heat pumps, and related comfort systems.', cta: 'Explore heating', url: 'https://citysuburbanheating.com/services/heating/'},
      otherServices: [
        {_key: 'heater-repair', name: 'Heater repair', description: 'Diagnosis and repair for furnaces, boilers, and other heating systems.', url: 'https://citysuburbanheating.com/services/heating/heater-repair/'},
        {_key: 'maintenance', name: 'Heating maintenance', description: 'Seasonal inspection and tune-up before peak winter demand.', url: 'https://citysuburbanheating.com/services/heating/'},
        {_key: 'ac-repair', name: 'Air-conditioning repair', description: 'Cooling diagnostics and repair for Chicago homes and businesses.', url: 'https://citysuburbanheating.com/services/cooling/'},
        {_key: 'air-quality', name: 'Indoor air quality', description: 'Filtration and air-quality options for healthier indoor comfort.', url: 'https://citysuburbanheating.com/services/air-quality/'},
      ],
      pricing: {
        heading: 'What does furnace repair cost',
        lede: furnaceLincolnParkPageRow.quickAnswer,
        caption: 'Sample ranges from the supplied furnace equipment sheet',
        column1: 'Common repair',
        column2: 'Typical range',
        column3: 'What changes the price',
        rows: furnaceEquipmentRow.priceTable.map((row, index) => ({_key: `price-${index + 1}`, job: row.repair, driver: row.range, permit: row.context})),
        note: `Straightforward repairs normally do not need a permit. Full furnace replacement generally does; the supplied equipment sheet lists a typical mechanical permit fee of ${furnaceEquipmentRow.permitFee}.`,
      },
      faqs: [{_key: 'service-faq', ...furnaceEquipmentRow.genericFaq}],
      ctaHeading: 'Need furnace repair',
      ctaBody: 'Tell us what the system is doing and what kind of Lincoln Park property you have. We will help you plan the right next step.',
    },
    area: {
      name: lincolnParkAreaRow.displayName,
      slug: lincolnParkAreaRow.slug,
      state: 'IL',
      heroEyebrow: `Lincoln Park, IL ${lincolnParkAreaRow.zip} · about ${lincolnParkAreaRow.distanceMiles} miles from our shop`,
      galleryLabel: 'Lincoln Park furnace-service photo plan',
      addressPlaceholder: `Street address or cross streets near ${lincolnParkAreaRow.exampleCrossStreets}`,
      buildingTypes: lincolnParkAreaRow.buildingTypes.map((item) => item.name),
      workingLede: furnaceLincolnParkPageRow.typicalFinds,
      areasHeading: 'Where do we work around Lincoln Park?',
      areasLede: `${lincolnParkAreaRow.boundaryDescription} We also serve the nearby areas shown below.`,
      areasNote: `${lincolnParkAreaRow.parkingNote} ${lincolnParkAreaRow.landmarkNote}`,
      subAreas: coverageAreas,
      mapQuery: lincolnParkAreaRow.mapQuery,
      libraryHeading: 'What should Lincoln Park homeowners know before furnace repair?',
      libraryLede: furnaceLincolnParkPageRow.guideIntro,
      localFaqs: [{_key: 'area-faq', ...lincolnParkAreaRow.genericFaq}],
    },
  },
}

export const furnaceLincolnParkCollectionItem = {
  _id: 'sample-furnace-lincoln-park',
  title: 'Furnace Repair in Lincoln Park',
  serviceSlug: furnaceEquipmentRow.slug,
  areaSlug: lincolnParkAreaRow.slug,
  serviceName: 'Furnace Repair',
  areaName: lincolnParkAreaRow.displayName,
  metaDescription: furnaceLincolnParkSample.page?.seo.description,
  cardImage: '/services/images/services/furnace-repair.png',
}

export function isFurnaceLincolnParkSample(serviceSlug: string, areaSlug: string) {
  return serviceSlug === furnaceEquipmentRow.slug && areaSlug === lincolnParkAreaRow.slug
}
