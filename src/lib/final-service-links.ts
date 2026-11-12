import {serviceRouteAliases} from './service-route-aliases'
import {legacyReplacementPath} from './legacy-service-replacements'

const aliases = serviceRouteAliases()
// A /services path on this site: absolute on citysuburbanheating.com, or relative (not part of another
// URL), ending at a quote, query, hash, space or tag. Asset paths (a "." in the last segment) never match.
const serviceLink = /(?:(https?:\/\/(?:www\.)?citysuburbanheating\.com)|(?<![\w.:/-]))(\/services(?:\/[a-z0-9-]+){1,4})\/?(?=["'?#\s<)\\]|$)/g

/** Where the site sends this path with a permanent redirect, if it does. */
function redirectTarget(path: string): string | undefined {
  // src/proxy.ts: a page's previous slugs and category aliases
  const alias = aliases.get(path)
  if (alias) return alias
  // app/[serviceSlug]/[areaSlug]/page.tsx: a removed or merged service, under any category
  const segments = path.split('/').slice(2)
  return segments.length === 2 ? legacyReplacementPath(segments[1]) : undefined
}

/**
 * Point internal links at the page's final address. The site answers an old address (a page's
 * previous slug, a removed page, a category alias) with a permanent redirect, and content written
 * before a URL change still links to it. A link changes only where the site would redirect.
 */
export function withFinalServiceLinks(text: string): string {
  return text.replace(serviceLink, (match, origin: string | undefined, path: string) => {
    const destination = redirectTarget(path)
    return destination && destination !== `${path}/` ? `${origin || ''}${destination}` : match
  })
}
