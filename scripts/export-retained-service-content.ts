/** Export only the existing service content used to adapt the standard design. */
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}
const client = createClient({projectId: process.env.NEXT_SANITY_PROJECT_ID || 'boolyxr0',
  dataset: process.env.NEXT_SANITY_DATASET || 'production', apiVersion: '2026-03-01',
  token: process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN, useCdn: false, perspective: 'raw'})

async function main() {
  const documents = await client.fetch<Array<{_type: string}>>(`*[_type in ["serviceDefinition","servicePage","serviceArea","siteSettings","servicePageTemplate"]]{
    ...,
    coverImage{...,"resolvedUrl":coalesce(image.asset->url,externalUrl)},
    gallery[]{...,"resolvedUrl":coalesce(image.asset->url,externalUrl)},
    workingPhotos[]{...,"resolvedUrl":coalesce(image.asset->url,externalUrl)},
    subAreas[]{...,photo{...,"resolvedUrl":coalesce(image.asset->url,externalUrl)}}
  }`)
  fs.writeFileSync(path.resolve('..', '.reference-preview', 'existing-service-content.json'), JSON.stringify(documents, null, 2))
  console.log(`Exported ${documents.filter((doc) => doc._type === 'serviceDefinition').length} service definitions and their existing page content.`)
}
main().catch((error) => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1})
