import {LIVE_SITE} from './site-navigation'

const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
const MAX_CONTEXTUAL_SERVICE_LINKS = 3
type Module = {name: string; tag: string; start: number; end: number; html: string}

/** Imported modules use both section and div wrappers, including nested divs. */
function pageModules(html: string): Module[] {
  const opening = /<(section|div|header|footer)\b[^>]*\bdata-module=["']([^"']+)["'][^>]*>/gi
  const modules: Module[] = []
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const tag = match[1]
    const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi')
    tags.lastIndex = opening.lastIndex
    let depth = 1
    for (let next = tags.exec(html); next; next = tags.exec(html)) {
      depth += /^<\//.test(next[0]) ? -1 : 1
      if (depth) continue
      modules.push({name: match[2], tag, start: match.index, end: tags.lastIndex, html: html.slice(match.index, tags.lastIndex)})
      opening.lastIndex = tags.lastIndex
      break
    }
  }
  return modules
}

function internalPath(attributes: string): string | undefined {
  const href = attributes.match(/\shref\s*=\s*(["'])(.*?)\1/i)?.[2]
  if (!href || href.startsWith('#')) return undefined
  try {
    const url = new URL(href.replaceAll('&amp;', '&'), LIVE_SITE)
    if (url.hash) return undefined
    if (!['http:', 'https:'].includes(url.protocol) || !['citysuburbanheating.com', 'www.citysuburbanheating.com'].includes(url.hostname)) return undefined
    return url.pathname.replace(/\/?$/, '/')
  } catch {return undefined}
}

/** Keep the same visible copy and styling when a repeated link becomes text. */
function asText(attributes: string, content: string) {
  const preserved = attributes.replace(/\s+(?:href|target|rel|download|hreflang|referrerpolicy|tabindex|role)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  return `<span${preserved}>${content}</span>`
}

/** Content links only. Menus, breadcrumbs, footer, CTAs and redirect routes are unchanged. */
export function refineServicePageLinks(html: string): string {
  const modules = pageModules(html)
  const related = new Set<string>()
  for (const section of modules) {
    if (section.name !== 'related') continue
    for (const anchor of section.html.matchAll(anchorPattern)) {
      const path = internalPath(anchor[1])
      if (path) related.add(path)
    }
  }
  const contextual = new Set(related)
  let contextualServiceLinks = 0
  function refine(section: string, name: string, tag: string) {
    if (name === 'service-areas') {
      let locations = 0
      let directoryPresent = false
      const updated = section.replace(anchorPattern, (anchor: string, attributes: string, content: string) => {
        const path = internalPath(attributes)
        if (path === '/service-areas/') directoryPresent = true
        if (!path || !/^\/service-area\/[^/]+\/$/.test(path)) return anchor
        locations++
        return asText(attributes, content)
      })
      if (!locations || directoryPresent) return updated
      return updated.replace(new RegExp(`</${tag}>$`, 'i'), `<p class="service-area-directory-link"><a href="https://citysuburbanheating.com/service-areas/">View all service areas</a></p></${tag}>`)
    }
    if (['hero', 'related', 'cta', 'site-header', 'site-footer'].includes(name)) return section
    return section.replace(anchorPattern, (anchor: string, attributes: string, content: string) => {
      const path = internalPath(attributes)
      if (!path || !path.startsWith('/services/')) return anchor
      // The menu and breadcrumb already provide the collection links.
      const collection = /^\/services\/(?:[^/]+\/)?$/.test(path)
      if (collection || contextual.has(path) || contextualServiceLinks >= MAX_CONTEXTUAL_SERVICE_LINKS) return asText(attributes, content)
      contextual.add(path)
      contextualServiceLinks++
      return anchor
    })
  }
  let cursor = 0
  const output: string[] = []
  for (const entry of modules) {
    output.push(html.slice(cursor, entry.start), refine(entry.html, entry.name, entry.tag))
    cursor = entry.end
  }
  output.push(html.slice(cursor))
  return output.join('')
}
