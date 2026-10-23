import type {DefaultDocumentNodeResolver, StructureResolver} from 'sanity/structure'
import {DesignPreview, ServicePagePreview} from './preview-pane'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('City & Suburban')
    .items([
      S.listItem()
        .title('Site settings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.listItem()
        .title('Service-page template')
        .child(S.document().schemaType('servicePageTemplate').documentId('servicePageTemplate-standard-v1')),
      S.divider(),
      S.documentTypeListItem('serviceCluster').title('Service clusters'),
      S.documentTypeListItem('serviceDefinition').title('Service definitions'),
      S.documentTypeListItem('serviceArea').title('Service areas'),
      S.documentTypeListItem('referenceServicePage').title('Service landing pages · finalized design'),
      S.documentTypeListItem('servicePage').title('Original service content · preserved'),
      S.divider(),
      S.documentTypeListItem('brandPage').title('Brand pages'),
    ])

/** Service landing pages and brand pages open with a "Preview" tab beside the editor. */
export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) =>
  schemaType === 'referenceServicePage'
    ? S.document().views([S.view.form(), S.view.component(ServicePagePreview).title('Preview')])
    : schemaType === 'brandPage'
      ? S.document().views([S.view.form(), S.view.component(DesignPreview).title('Preview')])
      : S.document()
