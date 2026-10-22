'use client'

import {visionTool} from '@sanity/vision'
import {defineConfig, type ResolveProductionUrlContext} from 'sanity'
import {presentationTool} from 'sanity/presentation'
import {structureTool} from 'sanity/structure'
import {resolve} from './src/sanity/presentation'
import {schemaTypes} from './src/sanity/schemaTypes'
import {defaultDocumentNode, structure} from './src/sanity/structure'
import {migrateServiceUrls} from './src/lib/service-base-path'

const projectId = process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0'
const dataset = process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const siteUrl = (process.env.NEXT_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

async function resolveProductionUrl(previousUrl: string | undefined, context: ResolveProductionUrlContext) {
  const {document, getClient} = context
  if (document._type === 'referenceServicePage') {
    const slug = (document.slug as {current?: string} | undefined)?.current
    const clusterSlug = document.clusterSlug as string | undefined
    const livePath = document.livePath as string | undefined
    return livePath ? `${siteUrl}${migrateServiceUrls(livePath)}` : slug && clusterSlug ? `${siteUrl}/services/${clusterSlug}/${slug}/` : previousUrl
  }
  if (document._type === 'serviceCluster' || document._type === 'serviceDefinition') {
    const slug = (document.slug as {current?: string} | undefined)?.current
    return slug ? `${siteUrl}/services/${slug}` : previousUrl
  }
  if (document._type !== 'servicePage') return previousUrl

  const serviceId = String((document.service as {_ref?: string} | undefined)?._ref || '').replace(/^drafts\./, '')
  const areaId = String((document.area as {_ref?: string} | undefined)?._ref || '').replace(/^drafts\./, '')
  if (!serviceId || !areaId) return previousUrl

  const {serviceSlug, areaSlug} = await getClient({apiVersion: '2026-03-01'}).fetch<{
    serviceSlug?: string
    areaSlug?: string
  }>(`{
    "serviceSlug": coalesce(
      *[_id == "drafts." + $serviceId][0].slug.current,
      *[_id == $serviceId][0].slug.current
    ),
    "areaSlug": coalesce(
      *[_id == "drafts." + $areaId][0].slug.current,
      *[_id == $areaId][0].slug.current
    )
  }`, {serviceId, areaId})

  return serviceSlug && areaSlug ? `${siteUrl}/services/${serviceSlug}/${areaSlug}` : previousUrl
}

export default defineConfig({
  name: 'default',
  title: 'City & Suburban Service Pages',
  projectId,
  dataset,
  basePath: '/services/studio',
  plugins: [
    structureTool({structure, defaultDocumentNode}),
    presentationTool({
      resolve,
      // No origin: the preview loads from the Studio's own origin (this same app), so the
      // draft-mode cookie and the Studio connection work. citysuburbanheating.com could not connect.
      previewUrl: {
        initial: '/services/',
        previewMode: {enable: '/services/api/draft-mode/enable/'},
      },
    }),
    visionTool(),
  ],
  document: {productionUrl: resolveProductionUrl},
  schema: {types: schemaTypes},
})
