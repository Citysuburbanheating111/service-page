'use client'

import {checkBrandPage, type QcKind} from '../lib/brand-page/qc'

const TITLES: Record<QcKind, string> = {
  'old design': 'Old design',
  missing: 'Missing fields',
  confirm: '[CONFIRM] tags and placeholders',
  note: 'Notes left on the page',
  photo: 'Photos',
  claim: "Claims the page can't make",
  offer: 'Offers that have ended',
  limit: 'Too long',
}

const box = {font: '14px/1.5 system-ui, sans-serif', color: 'inherit', padding: 24, maxWidth: 860}

/**
 * "QC" tab on a brand page: every problem that locks Publish, in one list. The same check runs as the document's
 * validation (errors on each field), and in `npm run check:brand-pages`.
 */
export function BrandPageQcPane(props: {document: {displayed: Record<string, unknown>}}) {
  const problems = checkBrandPage(props.document.displayed)
  if (!problems.length) {
    return (
      <div style={box}>
        <p style={{fontSize: 18, fontWeight: 600, margin: '0 0 8px'}}>✓ Clean: this page passes QC</p>
        <p style={{margin: 0, opacity: 0.75}}>No [CONFIRM] tags, no missing fields or photos, no notes, no claims the page can&apos;t make, no ended offers, nothing over its length. It can be published.</p>
      </div>
    )
  }
  const groups = new Map<QcKind, typeof problems>()
  for (const p of problems) groups.set(p.kind, [...(groups.get(p.kind) || []), p])
  return (
    <div style={box}>
      <p style={{fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: '#c0392b'}}>
        Publish is locked: {problems.length} problem{problems.length === 1 ? '' : 's'}
      </p>
      <p style={{margin: '0 0 20px', opacity: 0.75}}>Fix each one in the Editor tab (the field shows the same error). The page can be published once this list is empty.</p>
      {[...groups].map(([kind, list]) => (
        <section key={kind} style={{marginBottom: 20}}>
          <p style={{fontWeight: 600, margin: '0 0 6px'}}>{TITLES[kind]} ({list.length})</p>
          <ul style={{margin: 0, paddingLeft: 20}}>
            {list.map((p, i) => (
              <li key={i} style={{marginBottom: 4}}>
                <code style={{fontSize: 12, opacity: 0.8}}>{p.field}</code>: {p.message}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
