import {defineArrayMember, defineField, defineType} from 'sanity'
import {brandPageContentFields, brandPageContentGroups} from './brandPageContent'

const modules = [
  'utility-bar', 'site-header', 'hero', 'models', 'services', 'recent-jobs', 'pricing', 'service-plan', 'financing',
  'who-you-call', 'reviews', 'trust', 'process', 'service-areas', 'faq', 'closing-cta', 'other-brands', 'site-footer',
]

/**
 * Brand pages (one brand × equipment × service in Chicago) live apart from the service landing pages.
 * Every text slot of the Paper design is a field; the page at /services{path} is drawn from these fields.
 */
export const brandPage = defineType({
  name: 'brandPage',
  title: 'Brand pages',
  type: 'document',
  groups: [
    {name: 'identity', title: 'Page', default: true},
    ...brandPageContentGroups,
    {name: 'design', title: 'Design snapshot'},
  ],
  fields: [
    defineField({name: 'title', title: 'Page title', type: 'string', group: 'identity', description: 'The hero heading. Shown in Studio lists.', validation: (rule) => rule.required()}),
    defineField({name: 'slug', title: 'Studio slug', type: 'slug', group: 'identity', options: {source: 'title'}, validation: (rule) => rule.required()}),
    defineField({
      name: 'path', title: 'Page address', type: 'string', group: 'identity',
      description: 'The page is served at /services followed by this path, e.g. /brands/navien/tankless-water-heater-repair-chicago/.',
      validation: (rule) => rule.required().regex(/^\/brands\/[a-z0-9-]+\/[a-z0-9-]+\/$/, {name: 'path'}),
    }),
    defineField({name: 'metaTitle', title: 'Meta title', type: 'string', group: 'identity', validation: (rule) => rule.required().max(60)}),
    defineField({name: 'metaDescription', title: 'Meta description', type: 'text', rows: 3, group: 'identity', validation: (rule) => rule.required().max(160)}),
    defineField({name: 'designSource', title: 'Source design', type: 'url', group: 'identity', description: 'The Paper file this page follows.'}),
    ...brandPageContentFields,
    defineField({name: 'responsiveCss', title: 'Page styles', type: 'text', rows: 12, group: 'design', description: 'The design system styles. Leave empty to use the built-in Paper styles.'}),
    defineField({
      name: 'sections', title: 'Design snapshot (read only)', type: 'array', group: 'design', readOnly: true,
      description: 'The page as last rendered for review. The live page is drawn from the fields in the other tabs.',
      of: [defineArrayMember({
        type: 'object', name: 'brandPageSection', title: 'Page section',
        fields: [
          defineField({name: 'module', title: 'Section', type: 'string', options: {list: modules}}),
          defineField({name: 'label', title: 'Name in the design', type: 'string'}),
          defineField({name: 'html', title: 'Section design and content', type: 'text', rows: 16}),
        ],
        preview: {select: {title: 'label', subtitle: 'module'}},
      })],
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'path'}},
})
