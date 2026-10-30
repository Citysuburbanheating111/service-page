import directory from '@/data/brand-directory.json'
import {sanityFetch} from '@/sanity/lib/live'
import {BRAND_PAGE_LINKS_QUERY} from '@/sanity/lib/queries'

// Built by scripts/build-brand-directory.mjs from the brand cards preview (49 brands, the sheet's "Brand Pages" rows)
export type DirectoryBrand = (typeof directory)[number]
export type DirectoryPage = DirectoryBrand['pages'][number] & {href: string | null}

export const brandDirectory: DirectoryBrand[] = directory
export const BRANDS_PATH = '/brands/'

export function findDirectoryBrand(slug: string) {
  return brandDirectory.find((brand) => brand.slug === slug)
}

/** "a, b and c" */
export function listWords(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} and ${items.at(-1)}`
}

/** A brand's pages, each linked to its live address once the Sanity page is published (drafts in draft mode). */
export async function brandDirectoryPages(brand: DirectoryBrand): Promise<DirectoryPage[]> {
  const result = await sanityFetch({query: BRAND_PAGE_LINKS_QUERY, stega: false}).catch(() => null)
  const published = (result?.data || []) as {slug?: string; path: string}[]
  return brand.pages.map((page) => {
    const match = published.find((doc) => doc.slug === page.slug || doc.path === page.path)
    return {...page, href: match ? `/services${match.path}` : null}
  })
}
