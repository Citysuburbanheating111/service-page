# Sanity, Vercel, and repository setup

## Current state

- Sanity project: `boolyxr0`
- Sanity organization: `o3xwsz6oj`
- Dataset: `production`
- The dataset exists, allows public reads, and was empty when checked on 2026-08-27.
- The embedded Studio is mounted at `/studio`.
- GitHub repository: `https://github.com/HighlightsChicago111/Service-Pages.git`.

## 1. Fill `.env.local`

The repository contains an ignored `.env.local` with placeholders and a committed `.env.example`. Paste token values directly into `.env.local`; never paste secrets into chat or commit that file.

```dotenv
NEXT_SANITY_PROJECT_ID=boolyxr0
NEXT_SANITY_DATASET=production
NEXT_SANITY_API_VERSION=2026-03-01
NEXT_SANITY_STUDIO_URL=/studio
NEXT_SITE_URL=http://localhost:3000
SANITY_ORGANIZATION_ID=o3xwsz6oj
SANITY_API_READ_TOKEN=PASTE_SANITY_VIEWER_TOKEN_HERE
SANITY_API_WRITE_TOKEN=PASTE_SANITY_EDITOR_TOKEN_HERE
SANITY_AUTH_TOKEN=PASTE_SANITY_EDITOR_TOKEN_HERE
SANITY_REVALIDATE_SECRET=PASTE_RANDOM_REVALIDATION_SECRET_HERE
RESEND_API_KEY=PASTE_RESEND_SENDING_API_KEY_HERE
LEAD_FROM_EMAIL=City & Suburban Heating & Cooling <leads@your-verified-domain.com>
LEAD_NOTIFICATION_EMAIL=YOUR_LEAD_INBOX@example.com
```

Create two Sanity project tokens in **manage.sanity.io → project boolyxr0 → API → Tokens**:

1. A Viewer token for `SANITY_API_READ_TOKEN`. It supports authenticated previews and Visual Editing without write authority.
2. An Editor token for local-only `SANITY_API_WRITE_TOKEN` and `SANITY_AUTH_TOKEN`. The import script and Sanity CLI can use the same Editor token. Remove or rotate it after migration if it is no longer needed.

Generate the revalidation secret as a random value of at least 32 characters. It must match the secret configured on the Sanity webhook.

## 2. Install, validate, and import

```powershell
pnpm install
pnpm source:extract
pnpm source:validate
pnpm content:import
pnpm dev
```

The import is deterministic and currently creates/replaces 23 documents: one site settings singleton, one standard template, ten service definitions, one service area, and ten service pages.

Do not run `content:import` until the Editor token is present. The script refuses placeholder tokens.

## 3. Sanity CORS

In **manage.sanity.io → API → CORS origins**, add exact origins and enable credentials where Studio/Visual Editing requires them:

- `http://localhost:3000`
- Your final production Vercel/custom domain, for example `https://service-pages.example.com`
- Any stable preview domain you explicitly choose to support

Do not add a wildcard `*.vercel.app` origin with credentials. Add only origins that should be allowed to use the authenticated Studio or preview tooling.

## 4. Sanity webhook

After Vercel is deployed, add a Sanity webhook:

- URL: `https://YOUR_DOMAIN/api/revalidate`
- Dataset: `production`
- Trigger on: create, update, delete
- HTTP method: POST
- Secret: exactly the Vercel `SANITY_REVALIDATE_SECRET`
- Filter:

```groq
_type in ["servicePage", "serviceDefinition", "serviceArea", "siteSettings", "servicePageTemplate"]
```

- Projection:

```groq
{
  "documentType": _type
}
```

The endpoint verifies Sanity's signed webhook body and revalidates the service route tree. This broad invalidation is intentional because a service definition, area, template, or site setting may affect multiple generated pages.

## 5. Vercel environment variables

Configure variables separately for Development, Preview, and Production. Redeploy after changing any value.

| Variable | Dev | Preview | Prod | Secret? | Notes |
| --- | --- | --- | --- | --- | --- |
| `NEXT_SANITY_PROJECT_ID` | Yes | Recommended | Yes | No | `boolyxr0` |
| `NEXT_SANITY_DATASET` | Yes | Recommended | Yes | No | `production` |
| `NEXT_SANITY_API_VERSION` | Yes | Yes | Yes | No | `2026-03-01` |
| `NEXT_SANITY_STUDIO_URL` | Yes | Yes | Yes | No | `/studio` |
| `NEXT_SITE_URL` | Yes | Yes | Yes | No | Use the matching deployed origin; production should use the final canonical domain |
| `SANITY_API_READ_TOKEN` | Yes | Yes | Yes | Yes | Viewer token; required for drafts/Visual Editing. It remains server-side. |
| `SANITY_REVALIDATE_SECRET` | Optional | Yes | Yes | Yes | Random 32+ characters; match the webhook secret for that environment |
| `RESEND_API_KEY` | If testing | If testing | If form is live | Yes | Resend API key restricted to sending email |
| `LEAD_FROM_EMAIL` | If testing | If testing | If form is live | No | Sender on the exact domain or subdomain verified in Resend |
| `LEAD_NOTIFICATION_EMAIL` | If testing | If testing | If form is live | Yes | Recipient inbox; comma-separate up to 50 addresses |

Do **not** add these to Vercel unless a future server-only feature explicitly needs write access:

- `SANITY_API_WRITE_TOKEN`
- `SANITY_AUTH_TOKEN`
- `SANITY_ORGANIZATION_ID`

The write token is for local import/CLI work. The application does not write website content to Sanity at runtime.

The five `NEXT_*` values above are public application configuration even though their Vercel names do not include `NEXT_PUBLIC_`. `next.config.ts` exposes only this explicit allowlist to the embedded browser Studio. Tokens and secrets are never included in that allowlist.

The application has checked-in defaults for the public Sanity project ID and dataset, so a Preview deployment still builds if those two variables are scoped only to Production. Add them to Preview as well when testing a different Sanity project or dataset. Tokens and secrets never have checked-in defaults.

## 6. Resend lead delivery

The old source's `form_action` is deliberately ignored. `/api/lead` sends a plain-text notification directly through Resend and does not create or consume a Sanity webhook. It accepts only these fields and truncates each to 1,000 characters:

`name`, `phone`, `address`, `buildingType`, `issue`, `service`, `area`.

The hidden `website` honeypot is discarded. No lead data is stored in Sanity. The API request uses a unique Resend idempotency key and has a ten-second timeout.

Before enabling the form:

1. Create a Resend account and add a sending subdomain such as `updates.highlightschicago.com`.
2. Add Resend's SPF and DKIM records to DNS and wait for the domain to show as verified.
3. Create a Resend API key with sending access and add it to Vercel as `RESEND_API_KEY`.
4. Set `LEAD_FROM_EMAIL` to a sender on that exact verified domain, for example `City & Suburban Heating & Cooling <leads@your-verified-domain.com>`.
5. Set `LEAD_NOTIFICATION_EMAIL` to the inbox that should receive leads. Multiple recipients may be comma-separated.
6. Redeploy, then submit one clearly labelled test request from the deployed page.

## 7. GitHub and Vercel connection

The supplied repository must exist under `HighlightsChicago111` and the GitHub account authenticated in `gh` must have write access. Then:

```powershell
git remote add origin https://github.com/HighlightsChicago111/Service-Pages.git
git push -u origin main
```

In Vercel, import the GitHub repository, select the Next.js preset, keep the default build command, add the environment variables above, and deploy. No custom output directory is required.

### GitHub Actions deployment

`.github/workflows/deploy.yml` provides an authenticated production deployment using the pinned Vercel CLI. Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

- `VERCEL_TOKEN`: a Vercel access token created by the owner of the destination Vercel project.
- `VERCEL_ORG_ID`: the `orgId` from `.vercel/project.json` after the owner runs `vercel link` against the existing project.
- `VERCEL_PROJECT_ID`: the `projectId` from that same file.

After the secrets are configured, run **Deploy production to Vercel** from the repository's **Actions** tab. The workflow is intentionally manual because Vercel's Git integration already deploys pushes to `main`; this prevents duplicate production deployments. It pulls the Production environment, performs a Vercel production build, deploys the prebuilt output, and verifies the deployed home page.

For a local authenticated deployment to the already linked project:

```powershell
pnpm exec vercel pull --yes --environment=production --token=YOUR_TOKEN
pnpm exec vercel build --prod --token=YOUR_TOKEN
pnpm exec vercel deploy --prebuilt --prod --token=YOUR_TOKEN
```

Do not commit `.vercel/` or a Vercel token. The directory and local environment files are ignored by Git.

## Official references

- [Sanity API tokens](https://www.sanity.io/docs/content-lake/http-auth)
- [Sanity CORS origins](https://www.sanity.io/docs/content-lake/cors)
- [Sanity webhook revalidation with Next.js](https://www.sanity.io/docs/visual-editing/vercel-visual-editing)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
