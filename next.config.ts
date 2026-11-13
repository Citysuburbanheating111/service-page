import type {NextConfig} from 'next'

// These values are intentionally public application configuration, but the
// Vercel variable names do not need a NEXT_PUBLIC_ prefix. Next.js injects only
// this explicit allowlist into the browser bundle for the embedded Studio.
const browserConfig = {
  NEXT_SANITY_PROJECT_ID: process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_SANITY_DATASET: process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET,
  NEXT_SANITY_API_VERSION: process.env.NEXT_SANITY_API_VERSION || process.env.NEXT_PUBLIC_SANITY_API_VERSION,
  NEXT_SANITY_STUDIO_URL: (process.env.NEXT_SANITY_STUDIO_URL || process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || '/services/studio').replace(/\/service(?=\/|$)/, '/services'),
  NEXT_SITE_URL: process.env.NEXT_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL,
}

const nextConfig: NextConfig = {
  // The app is served under the /services subdirectory of the main site, the same
  // directory as the live WordPress hub pages (/services/heating/).
  // basePath is compiled into the client bundle and is applied automatically to
  // routes, <Link> hrefs and configured redirects. fetch() calls and raw public
  // asset paths need an explicit prefix.
  basePath: '/services',
  // URLs end with a slash, like the live WordPress URLs (/services/heating/).
  trailingSlash: true,
  env: browserConfig,
  poweredByHeader: false,
  reactStrictMode: true,
  // Every visitor gets the same complete HTML, whatever the user agent. By default Next.js
  // builds the page differently for crawlers on its bot list (any "...-Google" agent, so
  // AdsBot-Google and Google's URL Inspection tool) than for browsers and Googlebot. The text
  // was the same, but a response that depends on the user agent is what Google Ads checks
  // for as cloaking. Matching every agent means no user-agent branch at all.
  htmlLimitedBots: /.*/,
  async redirects() {
    // Sources/destinations are base-relative; basePath re-adds the /services prefix.
    return [
      {
        // The bare origin root has no page under basePath. basePath:false keeps this
        // matching the literal "/" (not "/services") and redirecting to the literal
        // "/services/" collection. Only affects the direct Vercel URL; at the public
        // domain "/" is served by WordPress, not proxied here.
        source: '/',
        destination: '/services/',
        permanent: false,
        basePath: false,
      },
    ]
  },
}

export default nextConfig
