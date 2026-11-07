# Generic Cloudflare /services proxy

This supersedes the keyword allowlist. Every request for `/services` or `/services/...` goes to Vercel with the same path and query string. No keyword list or Worker regeneration is needed when publishing a new page. The rest of the website stays on WordPress.

## Setup

1. Keep apex and `www` DNS records pointing to the existing WordPress origin, with Cloudflare proxying enabled (orange cloud).
2. Open Workers & Pages and the existing service Worker. Save its previous code for rollback.
3. Replace the Worker code with `cloudflare/services-proxy-worker.mjs` and deploy.
4. Under Settings > Domains & Routes > Add > Route, attach both patterns to this Worker:

```text
citysuburbanheating.com/services*
www.citysuburbanheating.com/services*
```

Also attach these six routes to the same Worker. They serve three old Google Ads URLs directly (no redirect): `/service/heating/` shows `/services/heating/`, `/service/cooling/` shows `/services/cooling/` and `/hvac_service` shows `/services/` (`AD_PAGES` in the Worker). Any other path under them passes to WordPress unchanged.

```text
citysuburbanheating.com/service/heating*
www.citysuburbanheating.com/service/heating*
citysuburbanheating.com/service/cooling*
www.citysuburbanheating.com/service/cooling*
citysuburbanheating.com/hvac_service*
www.citysuburbanheating.com/hvac_service*
```

The broader pattern includes slashless `/services`; the code only proxies the exact `/services` prefix, so `/services-other` stays on WordPress. `/services/*` works for slash-ending/nested URLs, but misses the bare `/services` URL.

Use Worker Routes. A dashboard URL Rewrite Rule alone cannot fetch an external Vercel hostname. [Cloudflare routes](https://developers.cloudflare.com/workers/configuration/routing/routes/), [URL Rewrite Rules](https://developers.cloudflare.com/rules/transform/url-rewrite/).

5. Inspect existing redirect/rewrite rules and more specific Worker routes for conflicts with `/services`. Remove only conflicting matches. Extra `/service*` compatibility routes from the earlier guide are not needed by this generic plural-only Worker; requests outside `/services` pass to WordPress.
6. In WordPress Appearance > Menus (or the theme's Navigation editor), rename the old Service Areas item to Services and set its URL to `https://citysuburbanheating.com/services/`. Keep top-level Heating/Cooling/Air Quality/Commercial labels; their category and child service links must point to their matching `/services/.../` app URLs. Save the menu.
7. Purge affected service URL and WordPress menu caches. Exclude app HTML, Studio and API responses from conflicting Cache Everything rules. Static assets keep their normal cache headers; the Worker streams responses without changing the body or forcing an HTML cache.
8. Verify the collection, all current navbar links, an extra keyword page, images, forms and both hosts. Run `node cloudflare/verify-service-origin.mjs https://citysuburbanheating.com` for the 41 imported pages. App responses contain `X-CitySuburban-Proxy: vercel`.

## What changes

| URL | Behavior |
| --- | --- |
| `/services/` | Vercel Services collection |
| `/services/{category}/` | Vercel category collection |
| `/services/{category}/{slug}/` | Vercel landing page, same public URL |
| Future `/services/...` URL | Automatically reaches Vercel; no Worker edit |
| API, Studio and assets inside `/services/` | Vercel; methods, bodies and cookies forwarded |
| Consolidated old keyword alias inside `/services/` | App's permanent redirect, query preserved |
| Missing `/services/...` page | Vercel's 404; no WordPress fallback |
| `/service-area/...`, `/service-areas/`, `/service/...` and other outside paths | WordPress behavior |

Navbar labels do not control routing: their actual link URLs do. A neighborhood page outside `/services` needs its own migration and URL mapping before replacing its content. Renaming the old Service Areas menu item does not move neighborhood pages.

## Future Sanity pages

Published `referenceServicePage` documents are discovered dynamically by URL category and slug. They render from their CMS sections and shared template styles and appear in the chosen collection automatically. A new page needs its own name, category, slug, SEO/content fields and complete design sections. Set its collection category when its URL category differs from the four public collection groups.

The optional exact livePath field may be left blank; the route is `/services/{clusterSlug}/{slug}/`. A supplied path must match those fields. Existing imported pages retain their exact finalized URLs. Public landing pages allow search indexing and appear in the service sitemap automatically; there is no indexing approval field. Newly added WordPress menu items still need their corresponding link added in WordPress.

The signed Sanity webhook URL is:

```text
https://citysuburbanheating.com/services/api/revalidate/
```

Configure its payload as `{ "documentType": _type }` for content events; the handler invalidates service routes including collections and sitemap. Keep the existing shared secret. Confirm Sanity live updates and the signed webhook are enabled so published edits refresh cached collections and sitemap. Studio is `/services/studio/`; the app sitemap is `/services/sitemap.xml`.

Vercel production configuration remains:

```text
NEXT_SITE_URL=https://citysuburbanheating.com
NEXT_SANITY_STUDIO_URL=/services/studio
```

## Verification and rollback

Run `node cloudflare/services-proxy-worker.test.mjs` and `pnpm test:reference` before rollout. These test future-page routing, current pages, forwarded query/body/headers, binary data, redirects and dynamic CMS rendering/navigation without publishing a test page or sending a real lead.

Restore the saved Worker code/routes and prior menu links to roll back. Retain WordPress content. This repository update does not install the Worker or change the WordPress menu itself.
