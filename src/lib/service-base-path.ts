/** Upgrade stored URL fields while keeping neighborhood paths and content intact. */
export function migrateServiceUrls(value: string): string {
  return value
    .replace(/\/services?\/(heating-services|cooling-services|air-quality-service|commercial-hvac-service)(?=\/|$|[?#"'])/g,
      (_match, slug: string) => `/services/${({
        'heating-services': 'heating', 'cooling-services': 'cooling',
        'air-quality-service': 'air-quality', 'commercial-hvac-service': 'commercial',
      } as Record<string, string>)[slug]}`)
    .replace(/\/service(?=\/|$|[?#"'])/g, '/services')
}

/** Keep links to service pages inside this app (relative), so a local or preview build
 * stays in that build. On the live site they resolve to the same citysuburbanheating.com page. */
export function withAppServiceLinks(html: string): string {
  return html.replaceAll('href="https://citysuburbanheating.com/services/', 'href="/services/')
}

export function migrateServiceContent<T>(value: T): T {
  if (typeof value === 'string') return migrateServiceUrls(value) as T
  if (Array.isArray(value)) return value.map(item => migrateServiceContent(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, migrateServiceContent(item)])) as T
  }
  return value
}
