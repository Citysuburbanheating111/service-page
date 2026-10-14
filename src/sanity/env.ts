function usableSecret(value: string | undefined): string | undefined {
  if (!value || /^(PASTE_|your_)/i.test(value)) return undefined
  return value
}

// These are public Sanity identifiers, not credentials. Keep stable defaults so
// Vercel Preview builds do not fail when variables are scoped to Production only.
export const projectId = process.env.NEXT_SANITY_PROJECT_ID || 'boolyxr0'
export const dataset = process.env.NEXT_SANITY_DATASET || 'production'
export const apiVersion = process.env.NEXT_SANITY_API_VERSION || '2026-03-01'
export const studioUrl = (process.env.NEXT_SANITY_STUDIO_URL || '/services/studio').replace(/\/service(?=\/|$)/, '/services')
export const siteUrl = process.env.NEXT_SITE_URL || 'http://localhost:3000'
export const readToken = usableSecret(process.env.SANITY_API_READ_TOKEN)
