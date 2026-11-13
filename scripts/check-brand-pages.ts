/**
 * Run the Studio's brand page QC (src/lib/brand-page/qc.ts) on brand pages outside the Studio.
 *   npm run check:brand-pages                 every brandPage in Sanity (drafts and published)
 *   npm run check:brand-pages -- page.json    a local page file or exported document
 * Exits 1 when a page has a problem (the Studio would lock its Publish button).
 */
import fs from 'node:fs'
import {checkBrandPage} from '../src/lib/brand-page/qc'

type Doc = Record<string, unknown> & {_id?: string; path?: string}

function token() {
  if (process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN) return process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN
  const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : ''
  return env.match(/^SANITY_[A-Z_]*TOKEN\s*=\s*"?([^"\r\n]+)/m)?.[1]
}

async function docs(files: string[]): Promise<Doc[]> {
  if (files.length) return files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0'
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
  const query = encodeURIComponent('*[_type == "brandPage"] | order(path asc)')
  const res = await fetch(`https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${query}&perspective=raw`, {
    headers: token() ? {Authorization: `Bearer ${token()}`} : {},
  })
  const body = await res.json() as {result?: Doc[]; error?: {description?: string}}
  if (!res.ok || !body.result) throw new Error(`Sanity query failed: ${body.error?.description || res.status}`)
  return body.result
}

async function main() {
  const list = await docs(process.argv.slice(2))
  let failed = 0
  for (const doc of list) {
    // a local page file from the skill holds the sections without the document fields; check what it has
    const problems = checkBrandPage(doc)
    const name = doc._id || doc.path || (doc.meta as {slug?: string} | undefined)?.slug || 'page'
    if (!problems.length) { console.log(`CLEAN  ${name}`); continue }
    failed++
    const kinds = Object.entries(problems.reduce<Record<string, number>>((a, p) => ({...a, [p.kind]: (a[p.kind] || 0) + 1}), {}))
    console.log(`LOCKED ${name}: ${problems.length} problem(s) (${kinds.map(([k, n]) => `${n} ${k}`).join(', ')})`)
    for (const p of problems.slice(0, 12)) console.log(`         ${p.field}: ${p.message}`)
    if (problems.length > 12) console.log(`         … and ${problems.length - 12} more`)
  }
  console.log(`\n${list.length - failed} clean, ${failed} locked`)
  process.exit(failed ? 1 : 0)
}

main().catch((error) => { console.error(error.message); process.exit(1) })
