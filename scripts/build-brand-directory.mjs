// Builds src/data/brand-directory.json (the /services/brands/ cluster and /services/<brand>/ pages) and copies
// the brand logos and equipment photos into public/images/brand-directory/, from the brand cards preview repo
// (logeshmaximus/city-suburban-brand-pages). Usage: node scripts/build-brand-directory.mjs <path to that repo>
import fs from 'node:fs'
import path from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('Pass the path of the city-suburban-brand-pages checkout')
const root = path.resolve(import.meta.dirname, '..')
const imageDir = path.join(root, 'public/images/brand-directory')
fs.mkdirSync(imageDir, {recursive: true})

const brands = JSON.parse(fs.readFileSync(path.join(source, 'build/brands.json'), 'utf8'))
const status = JSON.parse(fs.readFileSync(path.join(source, 'build/status.json'), 'utf8'))
const hub = fs.readFileSync(path.join(source, 'index.html'), 'utf8')

// The logo each hub card shows, and whether it sits on the dark tile (white-only logos)
const cards = new Map()
for (const match of hub.matchAll(/data-system="([^"]+)"[^>]*><span class="cluster-card-media brand-media( is-dark)?"><img[^>]*src="assets\/([^"]+)"/g)) {
  cards.set(match[1], {file: match[3], dark: !!match[2]})
}

function copy(file) {
  fs.copyFileSync(path.join(source, 'assets', file), path.join(imageDir, file))
  return `/services/images/brand-directory/${file}`
}

const directory = brands.map((brand) => {
  const card = cards.get(brand.slug)
  if (!card) throw new Error(`No logo card for ${brand.name}`)
  return {
    name: brand.name,
    slug: brand.slug,
    logo: copy(card.file),
    darkLogo: card.dark,
    equipment: brand.equipmentPlural,
    pages: brand.pages.map((page) => {
      // C&S technician crops are copied; the site's own /services/ assets and Sanity CDN photos stay as they are
      const image = page.image?.startsWith('file:crops/') ? copy(page.image.slice('file:crops/'.length)) : page.image || null
      // Sanity slug and live path, e.g. carrier-air-conditioner-repair-chicago → /carrier/air-conditioner-repair-chicago/
      const slug = status[page.title]?.slug || `${brand.slug}-${page.equipment.replace(/\s+/g, '-')}-repair-chicago`
      return {
        title: page.title,
        description: page.description,
        image,
        slug,
        path: `/${brand.slug}/${slug.slice(brand.slug.length + 1)}/`,
      }
    }),
  }
})

fs.writeFileSync(path.join(root, 'src/data/brand-directory.json'), `${JSON.stringify(directory, null, 2)}\n`)
console.log(`${directory.length} brands, ${directory.reduce((n, b) => n + b.pages.length, 0)} pages`)
