// Compare a rendered brand page with the Paper design, text slot by text slot (desktop and phone).
// With the American Standard page in Paper's own copy, every difference is listed.
//   tsx scripts/compare-brand-page-to-paper.ts <page.json>
import fs from 'node:fs'
import {parse, type HTMLElement} from 'node-html-parser'
import {renderBrandPage} from '@/lib/brand-page/render'
import design from '@/brand-pages/design-sections.json'

const CHROME = new Set(['utility-bar', 'site-header', 'site-footer'])
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
function slots(html: string) {
  const out: string[] = []
  for (const layout of ['.cs31-d', '.cs31-m']) {
    const root = parse(`<div>${html}</div>`)
    for (const part of root.querySelectorAll(layout)) {
      const walk = (el: HTMLElement) => {
        const own = decode(el.childNodes.filter((c) => c.nodeType === 3).map((c) => c.rawText).join(''))
        if (own && !/^CONFIRM:/.test(own)) out.push(`${layout === '.cs31-d' ? 'D' : 'M'} ${own}`)
        el.childNodes.forEach((c) => { if (c.nodeType === 1) walk(c as HTMLElement) })
      }
      walk(part)
    }
  }
  return out
}
const page = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const sections = (design as {module: string; html: string}[]).filter((s) => !CHROME.has(s.module))
const rendered = renderBrandPage(page).sections
let total = 0, same = 0
for (const s of sections) {
  const a = slots(s.html), b = slots(rendered.find((r) => r.module === s.module)!.html)
  total += a.length
  const left = [...b]
  const missing: string[] = []
  for (const t of a) { const i = left.indexOf(t); if (i >= 0) { left.splice(i, 1); same++ } else missing.push(t) }
  if (missing.length || left.length) {
    console.log(`\n## ${s.module}`)
    missing.forEach((t) => console.log(`  - paper: ${t.slice(0, 110)}`))
    left.forEach((t) => console.log(`  + page:  ${t.slice(0, 110)}`))
  }
}
console.log(`\n${same}/${total} Paper text slots identical (${(same / total * 100).toFixed(1)}%)`)
