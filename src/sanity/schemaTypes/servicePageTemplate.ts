import {defineArrayMember, defineField, defineType} from 'sanity'

const sections = [
  'site-header', 'quick-facts', 'problems', 'repair-replace', 'systems', 'install', 'process', 'service-areas', 'guide', 'related', 'cta', 'site-footer',
  'hero', 'types', 'brands', 'trust', 'reviews', 'why', 'workingArea',
  'coverage', 'otherServices', 'pricing', 'faq', 'closingCta', 'guides',
]

export const servicePageTemplate = defineType({
  name: 'servicePageTemplate',
  title: 'Service-page template',
  type: 'document',
  fields: [
    defineField({name: 'name', title: 'Template name', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'version', title: 'Version', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'active', title: 'Active', type: 'boolean', initialValue: true}),
    defineField({name: 'designVersion', title: 'Landing page design', type: 'string', options: {list: [
      {title: 'Finalized October 2026 design', value: 'october-2026'},
      {title: 'V1 design system: Work We Handle strip, 24/7 band, equipment tiles, symptom cards', value: 'v1-2026-10'},
    ]}, initialValue: 'v1-2026-10'}),
    defineField({
      name: 'serviceSections', title: 'V1 design system: shared sections',
      description: 'Shared by every service landing page that uses this template. Each page adds its own seven "Work We Handle" items; a page without items (work City & Suburban refers out) shows neither the strip nor the 24/7 band.',
      type: 'object', options: {collapsible: true},
      fields: [
        defineField({name: 'workEyebrow', title: 'Work strip eyebrow', type: 'string', initialValue: 'Service types'}),
        defineField({name: 'workHeadingSuffix', title: 'Work strip heading, after the service name', type: 'string', initialValue: 'Work We Handle'}),
        defineField({name: 'workLede', title: 'Work strip intro', type: 'text', rows: 2, description: '{service} is replaced by the service name in lower case.', initialValue: 'Common {service} jobs City & Suburban handles for Chicago homes and businesses.'}),
        defineField({name: 'workNote', title: 'Work strip footnote', type: 'text', rows: 2, initialValue: 'Final recommendations follow the installed conditions, equipment instructions and applicable Chicago requirements.'}),
        defineField({name: 'equipmentLabel', title: 'Equipment tiles eyebrow', type: 'string', initialValue: 'Equipment types'}),
        defineField({name: 'allDayEyebrow', title: '24/7 band eyebrow', type: 'string', initialValue: 'Open 24 hours, 7 days a week'}),
        defineField({name: 'allDayHeading', title: '24/7 band heading', type: 'string', initialValue: '24/7 service, whatever the size of the job'}),
        defineField({name: 'allDayText', title: '24/7 band text', type: 'text', rows: 3, initialValue: 'A small fix or a full breakdown, City & Suburban answers around the clock, every day of the week. Call any time, day or night, and describe the problem.'}),
        defineField({name: 'allDayPoints', title: '24/7 band points', type: 'array', of: [defineArrayMember({type: 'string'})], description: '{phone} is replaced by the phone number.', initialValue: ['Big jobs and small jobs', 'Day, night and weekends', 'One number: {phone}']}),
        defineField({name: 'allDayBadge', title: '24/7 badge', type: 'string', initialValue: '24/7'}),
        defineField({name: 'allDayBadgeLabel', title: '24/7 badge label', type: 'string', initialValue: 'Always open'}),
        defineField({name: 'phoneDisplay', title: 'Phone number as shown', type: 'string', initialValue: '(773) 238-3838'}),
        defineField({name: 'phoneHref', title: 'Phone link', type: 'string', initialValue: 'tel:+17732383838', validation: (rule) => rule.regex(/^tel:\+?\d+$/)}),
        defineField({name: 'requestLabel', title: 'Request button', type: 'string', initialValue: 'Request service'}),
      ],
    }),
    defineField({name: 'responsiveCss', title: 'Shared responsive landing page styles', type: 'text', rows: 12}),
    defineField({
      name: 'presentation', title: 'Shared presentation rules', type: 'object',
      description: 'Reusable design rules applied to every service page that references this template.',
      fields: [
        defineField({name: 'footerColor', title: 'City & Suburban navy', type: 'string', initialValue: '#09263A'}),
        defineField({name: 'accentColor', title: 'City & Suburban red', type: 'string', initialValue: '#DD382B'}),
        defineField({name: 'accentDarkColor', title: 'Red hover color', type: 'string', initialValue: '#B92E23'}),
        defineField({name: 'actionBlueColor', title: 'Schedule-service blue', type: 'string', initialValue: '#0A4265'}),
        defineField({name: 'equalHeightReviewCards', title: 'Equal-height review cards', type: 'boolean', initialValue: true}),
        defineField({name: 'ratingAfterReviewText', title: 'Rating after review text', type: 'boolean', initialValue: true}),
        defineField({name: 'coverageMapFirst', title: 'Coverage map before neighborhoods', type: 'boolean', initialValue: true}),
        defineField({name: 'neighborhoodGrid', title: 'Neighborhood grid without scrollbar', type: 'boolean', initialValue: true}),
        defineField({name: 'brandLogoCards', title: 'Equipment brand logo cards', type: 'boolean', initialValue: true}),
        defineField({name: 'pricingHeadingAsQuestion', title: 'Pricing heading ends with a question mark', type: 'boolean', initialValue: true}),
        defineField({name: 'separateCollectionCover', title: 'Separate collection-card cover', type: 'boolean', initialValue: true}),
        defineField({name: 'heroGalleryImageCount', title: 'Hero gallery image count', type: 'number', initialValue: 3, validation: (rule) => rule.required().integer().min(1).max(6)}),
        defineField({name: 'workingPhotoCount', title: 'Working-area image count', type: 'number', initialValue: 3, validation: (rule) => rule.required().integer().min(1).max(6)}),
        defineField({name: 'locationPhotoCards', title: 'Location cards include photos', type: 'boolean', initialValue: true}),
      ],
    }),
    defineField({
      name: 'sectionOrder', title: 'Section order', type: 'array',
      of: [defineArrayMember({type: 'string', options: {list: sections.map((value) => ({title: value, value}))}})],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'version'}},
})
