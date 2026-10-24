// Render brand page JSON files with the site's renderer and check what makes the page work:
// every slot filled from the page, real links, the booking form, tabs, FAQ, carousels and the map.
//   tsx scripts/test-brand-pages.ts <page.json>... [--out dir]
import fs from 'node:fs'
import path from 'node:path'
import {parse} from 'node-html-parser'
import {renderBrandPage} from '@/lib/brand-page/render'
import reference from '@/brand-pages/slot-reference.json'

const args = process.argv.slice(2)
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : ''
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
let failed = 0

// Copy that only the American Standard furnace reference page may show
const REFERENCE_ONLY = /acculink|platinum 9|gold s9v2|silver 80h|coated flame sensor|cracked ignitor|nate-certified|fulton market/i

for (const file of files) {
  const page = JSON.parse(fs.readFileSync(file, 'utf8'))
  const problems: string[] = []
  let html = ''
  try { html = renderBrandPage(page).html } catch (error) { problems.push(`render failed: ${(error as Error).message}`) }
  if (html) {
    const root = parse(html)
    const count = (selector: string) => root.querySelectorAll(selector).length
    const expect = (label: string, ok: boolean) => { if (!ok) problems.push(label) }
    expect('one h1', count('h1') === 1)
    expect('section h2s', count('h2') >= 12)
    expect('booking form', count('form#book') === 1)
    for (const name of ['name', 'phone', 'email', 'area', 'model', 'issue']) expect(`form field ${name}`, count(`form#book [name="${name}"]`) > 0)
    expect('submit button', count('form#book button[type="submit"]') === 1)
    expect('phone links', count('a[href="tel:+17732383838"]') >= 5)
    expect('book links', count('a[href="#book"]') >= 3)
    expect('section links', count('a[href^="#"]') >= 15)
    expect('service tabs', count('[data-cs-tab]') === 8 && count('[data-cs-panel]') === 8)
    expect('FAQ items', count('[data-cs-faq]') >= 10)
    expect('carousels', count('[data-cs-prev]') === 2 && count('[data-cs-next]') === 2)
    expect('map', count('iframe') === 2)
    const repairs = page.pricing.repairs.length, reviews = page.reviews.reviews.length
    expect(`all ${reviews} reviews`, page.reviews.reviews.every((r: {name: string}) => html.includes(r.name)))
    expect(`all ${repairs} repairs`, page.pricing.repairs.every((r: {item: string}) => html.includes(r.item.replace(/&/g, '&amp;'))))
    for (const item of page.faq.items) expect(`FAQ answer "${item.question.slice(0, 30)}"`, html.includes(item.answer.slice(0, 40).replace(/&/g, '&amp;').replace(/'/g, '&#x27;')) || html.includes(item.answer.slice(0, 40).replace(/&/g, '&amp;')))
    const text = root.structuredText
    if (page.meta.brand !== reference.meta.brand) {
      const leftover = text.match(REFERENCE_ONLY)
      if (leftover && !JSON.stringify(page).toLowerCase().includes(leftover[0].toLowerCase())) problems.push(`reference copy left: ${leftover[0]}`)
      const brandHits = text.split('\n').filter((l) => /american standard/i.test(l) && !JSON.stringify(page).includes(l.trim().slice(0, 30)))
      if (brandHits.length) problems.push(`"American Standard" outside this page's own copy: ${brandHits[0].trim().slice(0, 80)}`)
    }
    if (/CONFIRM:/.test(text)) problems.push('designer note left')
    if (outDir) { fs.mkdirSync(outDir, {recursive: true}); fs.writeFileSync(path.join(outDir, path.basename(file).replace(/\.json$/, '.html')), html) }
  }
  if (problems.length) failed++
  console.log(`${problems.length ? '✗' : '✓'} ${path.basename(file)}${problems.length ? `\n   - ${problems.join('\n   - ')}` : ''}`)
}
process.exit(failed ? 1 : 0)
