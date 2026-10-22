import {defineArrayMember, defineField, defineType} from 'sanity'
import {WORK_ICON_NAMES, WORK_ITEM_COUNT} from '../../lib/work-icons'

const modules = [
  'site-header', 'hero', 'trust', 'quick-facts', 'problems', 'pricing',
  'pricing-block', 'repair-replace', 'systems', 'brands', 'install', 'process', 'reviews',
  'service-areas', 'faq', 'guide', 'related', 'cta', 'site-footer',
]

export const referenceServicePage = defineType({
  name: 'referenceServicePage',
  title: 'Service landing pages · October design',
  type: 'document',
  groups: [
    {name: 'identity', title: 'Service & card', default: true},
    {name: 'seo', title: 'SEO & keywords'},
    {name: 'design', title: 'Design sections'},
    {name: 'review', title: 'Review status'},
  ],
  fields: [
    defineField({name: 'name', title: 'Service card title', type: 'string', group: 'identity', validation: (rule) => rule.required()}),
    defineField({name: 'clusterSlug', title: 'URL category', type: 'string', group: 'identity', options: {list: ['heating', 'cooling', 'air-quality', 'commercial', 'hvac-systems', 'indoor-air-quality-ventilation', 'fireplace-chimney', 'commercial-specialty']}, validation: (rule) => rule.required()}),
    defineField({name: 'directoryClusterSlug', title: 'Collection category', type: 'string', group: 'identity', options: {list: ['heating', 'cooling', 'air-quality', 'commercial']}}),
    defineField({name: 'template', title: 'Standard design template', type: 'reference', to: [{type: 'servicePageTemplate'}], group: 'identity'}),
    defineField({name: 'slug', title: 'Service URL slug', type: 'slug', group: 'identity', options: {source: 'name'}, validation: (rule) => rule.required()}),
    defineField({name: 'livePath', title: 'Exact landing page path', type: 'string', group: 'identity', description: 'Leave blank for a new page: its path is /services/{URL category}/{Service URL slug}/. A supplied path must match those fields.', validation: (rule) => rule.regex(/^\/services\/[^/]+\/[^/]+\/$/).custom((value, context) => {
      const category = context.document?.clusterSlug
      const slug = (context.document?.slug as {current?: string} | undefined)?.current
      return !value || !category || !slug || value === `/services/${category}/${slug}/` || 'Path must match the URL category and service slug, or be left blank.'
    })}),
    defineField({name: 'cardImage', title: 'Service card image', type: 'image', group: 'identity', options: {hotspot: true}}),
    defineField({name: 'cardImageUrl', title: 'Reference card image URL', type: 'string', group: 'identity', description: 'Local image used until a Sanity image is selected.'}),
    defineField({name: 'cardDescription', title: 'Service card description', type: 'text', rows: 3, group: 'identity'}),
    defineField({name: 'metaTitle', title: 'Meta title', type: 'string', group: 'seo', validation: (rule) => rule.required()}),
    defineField({name: 'metaDescription', title: 'Meta description', type: 'text', rows: 3, group: 'seo', validation: (rule) => rule.required()}),
    defineField({name: 'canonicalUrl', title: 'Canonical URL', type: 'url', group: 'seo'}),
    defineField({name: 'keyPhrases', title: 'Primary and existing high-value key phrases', type: 'array', of: [defineArrayMember({type: 'string'})], group: 'seo'}),
    defineField({name: 'structuredData', title: 'Page structured data (JSON-LD)', type: 'text', rows: 8, group: 'seo'}),
    defineField({name: 'previewUrl', title: 'Source design URL', type: 'url', group: 'review', readOnly: true}),
    defineField({name: 'qcStatus', title: 'Reference review status', type: 'string', group: 'review', options: {list: ['PASS', 'NEEDS-PHOTO', 'RETAINED']}, readOnly: true}),
    defineField({name: 'sourcePage', title: 'Retained source content', type: 'reference', to: [{type: 'servicePage'}], group: 'review', readOnly: true}),
    defineField({name: 'scopeStatus', title: 'Existing service scope', type: 'string', group: 'review', readOnly: true}),
    defineField({name: 'photoStatus', title: 'Reference image review', type: 'string', group: 'review', readOnly: true}),
    defineField({
      name: 'workWeHandle', title: 'Work We Handle strip', type: 'array', group: 'design',
      description: `V1 design system. Exactly ${WORK_ITEM_COUNT} items, each taken from this page's own copy: no new claims, prices or promises. Leave empty for work City & Suburban refers out; the page then shows neither the strip nor the 24/7 band. The strip's heading, intro and the 24/7 band are shared in the Service-page template.`,
      of: [defineArrayMember({
        type: 'object', name: 'workItem', title: 'Work item',
        fields: [
          defineField({name: 'title', title: 'Title', type: 'string', description: '2 to 5 words, sentence case.', validation: (rule) => rule.required().max(40)}),
          defineField({name: 'text', title: 'One-line description', type: 'string', description: 'About 40 to 60 characters.', validation: (rule) => rule.required().max(70)}),
          defineField({name: 'icon', title: 'Icon', type: 'string', options: {list: [...WORK_ICON_NAMES]}, initialValue: 'clipboard', validation: (rule) => rule.required()}),
        ],
        preview: {select: {title: 'title', subtitle: 'text'}},
      })],
      validation: (rule) => rule.custom((items?: unknown[]) => !items?.length || items.length === WORK_ITEM_COUNT || `Add exactly ${WORK_ITEM_COUNT} items, or leave the strip empty.`),
    }),
    defineField({name: 'responsiveCss', title: 'Responsive design CSS', type: 'text', rows: 8, group: 'design', validation: (rule) => rule.required()}),
    defineField({
      name: 'sections', title: 'Landing page sections, in display order', type: 'array', group: 'design',
      description: 'Edit copy and images in the native content fields. Navigation uses the shared live-site menu on every collection and landing page. The site-header section records that shared design; its menu is managed centrally.',
      of: [defineArrayMember({
        type: 'object', name: 'referencePageSection', title: 'Page section',
        fields: [
          defineField({name: 'module', title: 'Section', type: 'string', options: {list: modules}, validation: (rule) => rule.required()}),
          defineField({name: 'contentFields', title: 'Section copy & images', type: 'array', readOnly: ({parent}) => parent?.module === 'site-header', of: [defineArrayMember({type: 'object', name: 'referenceContentField', fields: [
            defineField({name: 'label', title: 'Field', type: 'string', readOnly: true}),
            defineField({name: 'target', title: 'Design element ID', type: 'string', hidden: true}),
            defineField({name: 'kind', title: 'Field type', type: 'string', hidden: true}),
            defineField({name: 'value', title: 'Content', type: 'text', rows: 3}),
          ], preview: {select: {title: 'label', subtitle: 'value'}}})]}),
          defineField({name: 'html', title: 'Section design and content', type: 'text', rows: 16, readOnly: ({parent}) => parent?.module === 'site-header', validation: (rule) => rule.required()}),
        ],
        preview: {select: {title: 'module'}},
      })],
      validation: (rule) => rule.required().min(10),
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'clusterSlug'}},
})
