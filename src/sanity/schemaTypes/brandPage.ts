import {defineArrayMember, defineField, defineType} from 'sanity'

const modules = [
  'utility-bar', 'site-header', 'hero', 'models', 'services', 'recent-jobs', 'pricing', 'service-plan', 'financing',
  'who-you-call', 'reviews', 'trust', 'process', 'service-areas', 'faq', 'closing-cta', 'other-brands', 'site-footer',
]

/** Brand pages (e.g. American Standard furnaces) live apart from the service landing pages. */
export const brandPage = defineType({
  name: 'brandPage',
  title: 'Brand pages',
  type: 'document',
  groups: [
    {name: 'identity', title: 'Page', default: true},
    {name: 'seo', title: 'SEO'},
    {name: 'design', title: 'Design sections'},
  ],
  fields: [
    defineField({name: 'title', title: 'Page title', type: 'string', group: 'identity', validation: (rule) => rule.required()}),
    defineField({name: 'slug', title: 'URL slug', type: 'slug', group: 'identity', options: {source: 'title'}, validation: (rule) => rule.required()}),
    defineField({name: 'designSource', title: 'Source design', type: 'url', group: 'identity', description: 'The Paper file this page was built from.'}),
    defineField({name: 'metaTitle', title: 'Meta title', type: 'string', group: 'seo', validation: (rule) => rule.required()}),
    defineField({name: 'metaDescription', title: 'Meta description', type: 'text', rows: 3, group: 'seo', validation: (rule) => rule.required()}),
    defineField({name: 'responsiveCss', title: 'Page styles', type: 'text', rows: 12, group: 'design', validation: (rule) => rule.required()}),
    defineField({
      name: 'sections', title: 'Page sections, in display order', type: 'array', group: 'design',
      description: 'One block per section, holding the desktop and the phone layout as designed.',
      of: [defineArrayMember({
        type: 'object', name: 'brandPageSection', title: 'Page section',
        fields: [
          defineField({name: 'module', title: 'Section', type: 'string', options: {list: modules}, validation: (rule) => rule.required()}),
          defineField({name: 'label', title: 'Name in the design', type: 'string'}),
          defineField({name: 'html', title: 'Section design and content', type: 'text', rows: 16, validation: (rule) => rule.required()}),
        ],
        preview: {select: {title: 'label', subtitle: 'module'}},
      })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'slug.current'}},
})
