/**
 * Google Sheet -> Sanity for ONE tab and ONE Sanity project (copied from the Highlights Chicago sheet setup).
 *
 * Bundled by scripts/build-apps-script.ts into a .gs file that is pasted into the spreadsheet's Apps Script
 * project. The columns, the Sanity project and the row checks come from this repo, so the sheet maps to the exact
 * Sanity field paths. Other tabs are never read or written. Writes are drafts only, after a confirmation that names
 * the Sanity project; nothing is ever published.
 */
import {changedFields, flatten, META_COLUMNS, overflow, staleReason, unflatten, unknownColumns, type Column} from '../../scripts/lib/sheet'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- free-form Sanity documents

// Apps Script globals (no type package needed for the few calls used here).
declare const SpreadsheetApp: any // eslint-disable-line @typescript-eslint/no-explicit-any
declare const UrlFetchApp: any // eslint-disable-line @typescript-eslint/no-explicit-any
declare const PropertiesService: any // eslint-disable-line @typescript-eslint/no-explicit-any
declare const HtmlService: any // eslint-disable-line @typescript-eslint/no-explicit-any
declare const LockService: any // eslint-disable-line @typescript-eslint/no-explicit-any

export type Config = {projectId: string; dataset: string; apiVersion: string; tab: string; studioUrl: string}
/** What differs between projects. Everything else is the same code for every tab. */
export type Project = {
  type: string
  /** Global function prefix, e.g. "servicePages": the menu calls servicePagesCheck() and so on. */
  prefix: string
  menu: string
  tokenKey: string
  /** GROQ order for Load. */
  order: string
  /** The page's Sanity ID (no "drafts.") from its fields and the row's _id cell, or '' when it can't be known. */
  idOf: (doc: Json, idCell: string) => string
  /** Errors stop a row; warnings are shown. */
  checkRow: (doc: Json, idCell: string) => {errors: string[]; warnings: string[]}
  /** Two pages may not share this key (slug, or category and slug). */
  ownerKey: (doc: Json) => string
  /** The public URL of a page, for reports. */
  urlOf: (doc: Json) => string
  /** Optional: turns the writing skill's own file format into a page. Returns undefined for anything else. */
  build?: (input: Json) => {doc?: Json; errors: string[]; warnings: string[]; placeholders: string[]} | undefined
}

type Row = {rowNumber: number; record: Record<string, string>}
type RowCheck = {rowNumber: number; label: string; id: string; doc: Json; errors: string[]; warnings: string[]; changes: string[]}
export type PreparedPage = {errors: string[]; warnings: string[]; placeholders: string[]; id: string; label: string; record: Record<string, string>; index: number; changes: string[]}

export function createPageSheet(project: Project, CONFIG: Config, COLUMNS: Column[], TYPES: Record<string, string>) {
  const MENU = project.menu
  const fn = (name: string) => `${project.prefix}${name}`
  const ui = () => SpreadsheetApp.getUi()
  const parse = (record: Record<string, string>) => unflatten(record, COLUMNS, TYPES)
  const baseId = (id: string) => id.replace(/^drafts\./, '')

  function token(): string {
    const value = PropertiesService.getUserProperties().getProperty(project.tokenKey)
    if (!value) throw new Error(`No Sanity token yet. Use "${MENU} → Set my Sanity token" first (an Editor token for project ${CONFIG.projectId}).`)
    return value
  }

  function sanity(path: string, payload?: Json, withToken = token()): Json {
    const url = `https://${CONFIG.projectId}.api.sanity.io/v${CONFIG.apiVersion}/data/${path}`
    const response = UrlFetchApp.fetch(url, {
      method: payload ? 'post' : 'get',
      contentType: 'application/json',
      headers: {Authorization: `Bearer ${withToken}`},
      payload: payload ? JSON.stringify(payload) : undefined,
      muteHttpExceptions: true,
    })
    const status = response.getResponseCode()
    const body = JSON.parse(response.getContentText() || '{}')
    if (status === 401 || status === 403) throw new Error(`Sanity refused the token (${status}). Set a valid Editor token for project ${CONFIG.projectId}.`)
    if (status >= 300) throw new Error(`Sanity answered ${status}: ${body.error?.description || body.message || 'unknown error'}`)
    return body
  }

  /** A GROQ query that sees drafts too: since API 2025-02-19 Sanity hides them unless perspective=raw. */
  const query = (groq: string, params: Json, withToken?: string) =>
    sanity(`query/${CONFIG.dataset}?${Object.entries({query: groq, perspective: 'raw', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [`$${k}`, JSON.stringify(v)]))})
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`, undefined, withToken).result

  /** A cell as text: dates become ISO times (Sheets turns imported times into dates). */
  function cellText(value: unknown): string {
    if (Object.prototype.toString.call(value) === '[object Date]') return (value as Date).toISOString()
    if (value === null || value === undefined) return ''
    return String(value)
  }

  /** This tab, its headings and the rows the user selected. */
  function selection(): {sheet: any; headers: string[]; rows: Row[]} { // eslint-disable-line @typescript-eslint/no-explicit-any
    const sheet = SpreadsheetApp.getActiveSheet()
    if (sheet.getName() !== CONFIG.tab) throw new Error(`Open the "${CONFIG.tab}" tab and select the page rows first. This menu never reads other tabs.`)
    const lastColumn = sheet.getLastColumn()
    const headers: string[] = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(cellText)
    const unknown = unknownColumns(headers, COLUMNS)
    if (unknown.length) throw new Error(`These headings are not Sanity fields, so their cells would be lost (fix the spelling or load fresh pages):\n${unknown.join('\n')}`)
    for (const meta of META_COLUMNS) if (!headers.includes(meta)) throw new Error(`The heading "${meta}" is missing; keep the ${META_COLUMNS.join(', ')} columns at the start.`)
    const numbers = new Set<number>()
    for (const range of sheet.getActiveRangeList()?.getRanges() || [sheet.getActiveRange()]) {
      for (let r = range.getRow(); r < range.getRow() + range.getNumRows(); r++) if (r > 1 && r <= sheet.getLastRow()) numbers.add(r)
    }
    if (!numbers.size) throw new Error('Select one or more page rows (click a cell in each row you want).')
    const rows = [...numbers].sort((a, b) => a - b).map((rowNumber) => {
      const values: unknown[] = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0]
      return {rowNumber, record: Object.fromEntries(headers.map((header, i) => [header, cellText(values[i])]))}
    })
    return {sheet, headers, rows}
  }

  /** Sanity's versions (published and draft) of these pages, and every page that could own the same slug. */
  function sanityFor(rows: Row[]): Json[] {
    const ids = rows.map(({record}) => project.idOf(parse(record).doc, (record._id || '').trim())).filter(Boolean)
    const found: {pages: Json[]; owners: Json[]} = query('{"pages": *[_id in $ids || _id in $drafts], "owners": *[_type == $type]{_id, _type, clusterSlug, slug, "_owner": true}}', {ids, drafts: ids.map((id) => `drafts.${id}`), type: project.type})
    return [...found.pages, ...found.owners]
  }

  /** The row checks against the given Sanity documents (published and draft versions of every page of this type). */
  function checkRowsAgainst(rows: Row[], docs: Json[]): RowCheck[] {
    const seen = new Map<string, number>()
    return rows.map(({rowNumber, record}) => {
      const parsed = parse(record)
      const idCell = baseId((record._id || '').trim())
      const id = project.idOf(parsed.doc, idCell)
      const check = project.checkRow(parsed.doc, idCell)
      const errors = [...parsed.errors, ...check.errors]
      const owner = project.ownerKey(parsed.doc)
      if (id && seen.has(id)) errors.push(`same page as row ${seen.get(id)}`)
      if (id) seen.set(id, rowNumber)
      const taken = owner ? docs.find((d) => d._type === project.type && baseId(d._id) !== id && project.ownerKey(d) === owner) : undefined
      if (taken) errors.push(`${owner} is already used by ${baseId(taken._id)}`)
      const published = docs.find((d) => !d._owner && d._id === id)
      const draft = docs.find((d) => !d._owner && d._id === `drafts.${id}`)
      const lastEdit = [draft?._updatedAt, published?._updatedAt].filter(Boolean).sort().pop()
      const stale = id ? staleReason(record._updatedAt || '', lastEdit) : undefined
      if (stale) errors.push(stale)
      return {rowNumber, label: owner || 'no slug', id, doc: parsed.doc, errors, warnings: check.warnings, changes: errors.length ? [] : changedFields(parsed.doc, draft || published)}
    })
  }

  function report(checks: RowCheck[]): string {
    return checks.map((c) => {
      const head = `Row ${c.rowNumber} (${c.label}): `
      if (c.errors.length) return `${head}NOT READY\n  - ${c.errors.join('\n  - ')}`
      const body = c.changes.length ? (c.changes[0] === '(new page)' ? 'new page' : `${c.changes.length} field(s) differ from Sanity: ${c.changes.join(', ')}`) : 'same as Sanity, nothing to push'
      return `${head}${body}${c.warnings.length ? `\n  warnings: ${c.warnings.join('; ')}` : ''}`
    }).join('\n\n')
  }

  function show(title: string, text: string) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    ui().showModalDialog(HtmlService.createHtmlOutput(`<pre style="white-space:pre-wrap;font:13px/1.5 monospace">${escaped}</pre>`).setWidth(720).setHeight(480), title)
  }

  function guarded(run: () => void) {
    try { run() } catch (error) { ui().alert(MENU, error instanceof Error ? error.message : String(error), ui().ButtonSet.OK) }
  }

  function menu() {
    ui().createMenu(MENU)
      .addItem('Check selected rows', fn('Check'))
      .addItem('Push selected rows to Sanity as drafts', fn('Push'))
      .addSeparator()
      .addItem('Add a page from Claude', fn('Add'))
      .addItem('Get a page for Claude', fn('Get'))
      .addSeparator()
      .addItem('Load / Refresh published pages from Sanity', fn('Load'))
      .addItem('Set my Sanity token', fn('SetToken'))
      .addToUi()
  }

  function check() {
    guarded(() => {
      const {rows} = selection()
      show(`Check: ${CONFIG.tab}`, `Sanity project ${CONFIG.projectId}, dataset ${CONFIG.dataset}. Nothing was written.\n\n${report(checkRowsAgainst(rows, sanityFor(rows)))}`)
    })
  }

  function push() {
    guarded(() => {
      const lock = LockService.getDocumentLock()
      if (!lock.tryLock(30000)) throw new Error('Someone else is pushing from this sheet. Try again in a minute.')
      try {
        const {sheet, headers, rows} = selection()
        const checks = checkRowsAgainst(rows, sanityFor(rows))
        if (checks.some((c) => c.errors.length)) { show('Not pushed: fix these rows first', report(checks)); return }
        const ready = checks.filter((c) => c.changes.length)
        if (!ready.length) { show('Nothing to push', report(checks)); return }
        const answer = ui().alert(
          'Write drafts to Sanity?',
          `Project ${CONFIG.projectId}, dataset ${CONFIG.dataset}.\n\n${ready.map((c) => `drafts.${c.id} (row ${c.rowNumber})`).join('\n')}\n\nThese become DRAFTS of the pages. Nothing is published: review and publish them in the Studio.`,
          ui().ButtonSet.YES_NO,
        )
        if (answer !== ui().Button.YES) return
        const result = sanity(`mutate/${CONFIG.dataset}?returnIds=true&visibility=sync`, {
          mutations: ready.map((c) => ({createOrReplace: {...c.doc, _id: `drafts.${c.id}`, _type: project.type}})),
        })
        const written: Json[] = query('*[_id in $ids]{_id, _updatedAt}', {ids: ready.map((c) => `drafts.${c.id}`)})
        if (written.length !== ready.length) throw new Error(`Sanity confirmed ${written.length} of ${ready.length} drafts (transaction ${result.transactionId}). Check the Studio.`)
        const col = (name: string) => headers.indexOf(name) + 1
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
        for (const c of ready) {
          const updatedAt = written.find((w) => w._id === `drafts.${c.id}`)?._updatedAt || ''
          sheet.getRange(c.rowNumber, col('_id')).setNumberFormat('@').setValue(c.id)
          sheet.getRange(c.rowNumber, col('_status')).setNumberFormat('@').setValue(`Draft pushed ${stamp} UTC, publish in the Studio`)
          // Plain text, so Sheets keeps the exact time the stale check compares against.
          sheet.getRange(c.rowNumber, col('_updatedAt')).setNumberFormat('@').setValue(updatedAt)
        }
        show('Drafts written', `Transaction ${result.transactionId}. ${ready.length} draft(s) in project ${CONFIG.projectId}:\n\n${ready.map((c) => `${c.id}: ${CONFIG.studioUrl}`).join('\n')}\n\nReview each one in the Studio and press Publish.`)
      } finally {
        lock.releaseLock()
      }
    })
  }

  /** Fills this tab with every published page, after naming any rows whose edits are not in Sanity yet. Reads only. */
  function load() {
    guarded(() => {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
      const docs: Json[] = query(`*[_type == $type] | order(${project.order})`, {type: project.type})
      const versions = new Map<string, {published?: Json; draft?: Json}>()
      for (const doc of docs) {
        const draft = doc._id.startsWith('drafts.')
        const id = baseId(doc._id)
        versions.set(id, {...versions.get(id), [draft ? 'draft' : 'published']: doc})
      }
      const headers = [...META_COLUMNS, ...COLUMNS.map((column) => column.path)]
      const rows: string[][] = []
      const lost: string[] = []
      for (const [id, v] of versions) {
        if (!v.published) continue
        for (const problem of overflow(v.published, COLUMNS)) lost.push(`${id}: ${problem}`)
        const updatedAt = [v.draft?._updatedAt, v.published._updatedAt].filter(Boolean).sort().pop() || ''
        const status = v.draft ? 'published (unpublished draft changes not in this row)' : 'published'
        const cells: Record<string, string> = {_id: id, _status: status, _updatedAt: updatedAt, ...flatten(v.published, COLUMNS)}
        rows.push(headers.map((header) => cells[header] ?? ''))
      }
      if (lost.length) throw new Error(`Not loaded: these pages do not fit the sheet's columns, so data would be lost:\n${lost.join('\n')}`)

      let sheet = spreadsheet.getSheetByName(CONFIG.tab)
      const unpushed: string[] = []
      if (sheet && sheet.getLastRow() > 1) {
        const [head, ...body] = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues().map((r: unknown[]) => r.map(cellText))
        if (!unknownColumns(head, COLUMNS).length) {
          for (const values of body) {
            const record: Record<string, string> = Object.fromEntries(head.map((h: string, i: number) => [h, values[i]]))
            const {doc} = parse(record)
            const id = project.idOf(doc, baseId((record._id || '').trim()))
            const current = id ? versions.get(id) : undefined
            if (!id) { if (Object.values(record).some(Boolean)) unpushed.push('a row with no slug'); continue }
            if (!current || changedFields(doc, current.draft || current.published).length) unpushed.push(id)
          }
        }
      }
      const answer = ui().alert(
        'Load published pages from Sanity?',
        `This replaces everything in the "${CONFIG.tab}" tab with the ${rows.length} published page(s) from Sanity project ${CONFIG.projectId}.` +
          (unpushed.length ? `\n\nThese rows have content that is not in Sanity and will be LOST (push them first or copy them elsewhere):\n${unpushed.join('\n')}` : '\n\nNo unpushed edits in the tab.') +
          '\n\nSanity is only read, never changed.',
        ui().ButtonSet.YES_NO,
      )
      if (answer !== ui().Button.YES) return
      if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.tab)
      sheet.clearContents()
      // Plain text everywhere, so Sheets never turns ZIP codes, times or JSON into numbers or dates.
      const range = sheet.getRange(1, 1, rows.length + 1, headers.length)
      range.setNumberFormat('@')
      range.setValues([headers, ...rows])
      sheet.setFrozenRows(1)
      show('Loaded', `${rows.length} published page(s) loaded into "${CONFIG.tab}", ${headers.length} columns. Row 1 holds the exact Sanity field names.`)
    })
  }

  function setToken() {
    guarded(() => {
      const answer = ui().prompt('Set my Sanity token', `Paste an Editor token for Sanity project ${CONFIG.projectId} (sanity.io/manage → API → Tokens). It is stored for your Google account only and never shown again.`, ui().ButtonSet.OK_CANCEL)
      if (answer.getSelectedButton() !== ui().Button.OK) return
      const value = String(answer.getResponseText() || '').trim()
      if (!value) throw new Error('No token pasted.')
      // Saved only after Sanity accepts it.
      query('count(*[_type == $type])', {type: project.type}, value)
      PropertiesService.getUserProperties().setProperty(project.tokenKey, value)
      ui().alert(MENU, `Token saved and accepted by project ${CONFIG.projectId}.`, ui().ButtonSet.OK)
    })
  }

  // ---------- Add a page from Claude, Get a page for Claude ----------

  /** Everything "Add a page from Claude" decides, without Google services. */
  function preparePage(input: unknown, headers: string[], records: Array<Record<string, string>>, docs: Json[]): PreparedPage {
    const result: PreparedPage = {errors: [], warnings: [], placeholders: [], id: '', label: '', record: {}, index: -1, changes: []}
    if (!input || typeof input !== 'object' || Array.isArray(input)) { result.errors.push('Expected one page: a JSON object { ... }.'); return result }
    const given = input as Json
    let page: Json | undefined
    const built = given._type ? undefined : project.build?.(given)
    if (given._type === project.type) page = given
    else if (given._type) { result.errors.push(`This is a ${given._type}, not a ${project.type}.`); return result }
    else if (built) {
      result.errors.push(...built.errors)
      result.warnings.push(...built.warnings)
      result.placeholders.push(...built.placeholders)
      page = built.doc
      if (!page) { if (!result.errors.length) result.errors.push('The build made no page from this file.'); return result }
    } else { result.errors.push(`Expected a ${project.type} page with "_type": "${project.type}".`); return result }

    // Every value must survive the trip into cells and back.
    result.errors.push(...overflow(page, COLUMNS))
    const cells = flatten(page, COLUMNS)
    const back = parse(cells)
    result.errors.push(...back.errors)
    for (const field of changedFields(back.doc, page)) if (field !== '(new page)') result.errors.push(`${field}: not a field of the page, or a value the sheet cannot hold, so it would be lost`)

    const givenId = baseId(String(given._id || ''))
    const id = project.idOf(back.doc, givenId)
    const owner = project.ownerKey(back.doc)
    result.index = records.findIndex((row) => id && baseId(row._id || '') === id)
    if (result.index < 0 && owner) result.index = records.findIndex((row) => owner === project.ownerKey(parse(row).doc))
    const existing: Record<string, string> = result.index >= 0 ? records[result.index] : {}
    result.record = {
      ...Object.fromEntries(headers.map((header) => [header, existing[header] || ''])),
      ...cells,
      _id: givenId || existing._id || '',
      _status: existing._status || '',
      _updatedAt: String(given._updatedAt || existing._updatedAt || ''),
    }
    const check = checkRowsAgainst([{rowNumber: result.index >= 0 ? result.index + 2 : records.length + 2, record: result.record}], docs)[0]
    result.id = check.id
    result.label = project.urlOf(back.doc) || owner
    result.errors.push(...check.errors)
    result.warnings.push(...check.warnings.filter((w) => !result.warnings.includes(w)))
    if (!built) result.placeholders.push(...(JSON.stringify(page).match(/\[CONFIRM[^\]]*\]/g) || []))
    result.changes = check.changes
    return result
  }

  function addReport(result: PreparedPage, write: boolean): string {
    const name = `${result.id || 'new page'}${result.label ? ` (${result.label})` : ''}`
    const lines: string[] = []
    if (result.errors.length) lines.push(`Not ${write ? 'added' : 'ready'}: ${name}. Fix these:\n  - ${result.errors.join('\n  - ')}`)
    else if (!write) lines.push(`Ready to add: ${name}. Nothing was written (Check only).`)
    else lines.push(`Added: ${name}, ${result.index >= 0 ? `replacing row ${result.index + 2}` : 'as a new row at the bottom'} of the "${CONFIG.tab}" tab.`)
    if (result.warnings.length) lines.push(`Warnings:\n  - ${result.warnings.join('\n  - ')}`)
    if (result.placeholders.length) lines.push(`[CONFIRM] placeholders (${result.placeholders.length}), to answer before publishing:\n  - ${result.placeholders.join('\n  - ')}`)
    if (!result.errors.length) {
      lines.push(result.changes[0] === '(new page)' ? 'Sanity: a new page.' : result.changes.length ? `Sanity: ${result.changes.length} field(s) differ: ${result.changes.join(', ')}` : 'Sanity: the same as the page already there.')
      if (write) lines.push(`Next: select the row, ${MENU} → Check selected rows, then Push selected rows to Sanity as drafts (project ${CONFIG.projectId}).`)
    }
    return lines.join('\n\n')
  }

  /** Called by the Add box with the pasted text. Returns the report; never throws to the browser. */
  function addFromClaude(text: string, write: boolean): string {
    try {
      let input: unknown
      try { input = JSON.parse(String(text || '').trim()) } catch {
        return 'Not added: this is not valid JSON. Paste the whole file Claude wrote, from the first { to the last }.'
      }
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.tab)
      if (!sheet) return `Not added: there is no "${CONFIG.tab}" tab. Use Load published pages from Sanity first.`
      const values: string[][] = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1)).getValues().map((row: unknown[]) => row.map(cellText))
      const [headers = [], ...body] = values
      const unknown = unknownColumns(headers, COLUMNS)
      if (unknown.length) return `Not added: these headings in the tab are not Sanity fields: ${unknown.join(', ')}. Fix them first.`
      const records = body.map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i] || ''])))
      // First pass finds the page's ID; the second checks it against Sanity's versions of that page.
      const first = preparePage(input, headers, records, [])
      const result = first.record._id || first.id ? preparePage(input, headers, records, sanityFor([{rowNumber: 0, record: first.record}])) : first
      const out = addReport(result, write)
      if (!write || result.errors.length) return out
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const record: Record<string, string> = {...result.record, _status: `added from Claude ${stamp} UTC, not pushed yet`}
      const rowNumber = result.index >= 0 ? result.index + 2 : values.length + 1
      sheet.getRange(rowNumber, 1, 1, headers.length).setNumberFormat('@').setValues([headers.map((header) => record[header] || '')])
      return out
    } catch (error) {
      return `Not added: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  function add() {
    guarded(() => {
      ui().showModalDialog(HtmlService.createHtmlOutput(pasteHtml(fn('AddFromClaude'))).setWidth(900).setHeight(640), 'Add a page from Claude')
    })
  }

  /** Shows a page as JSON for Claude: the selected row as written, or (given an ID or slug) Sanity's latest version, a draft first. */
  function get() {
    guarded(() => {
      const answer = ui().prompt('Get a page for Claude', 'ID or slug of a page in Sanity (its latest draft, or the published page). Leave empty to use the selected row of this tab as written.', ui().ButtonSet.OK_CANCEL)
      if (answer.getSelectedButton() !== ui().Button.OK) return
      const wanted = baseId(String(answer.getResponseText() || '').trim())
      let doc: Json
      let from: string
      if (!wanted) {
        const {rows} = selection()
        if (rows.length !== 1) throw new Error('Select one page row (or type an ID or slug).')
        const {rowNumber, record} = rows[0]
        doc = {_id: record._id || '', _updatedAt: record._updatedAt || '', _type: project.type, ...parse(record).doc}
        from = `row ${rowNumber} of the "${CONFIG.tab}" tab, as written in the sheet`
      } else {
        const found: Json[] = query('*[_type == $type && (_id in [$id, "drafts." + $id] || slug.current == $id)]', {type: project.type, id: wanted})
        const ids = [...new Set(found.map((d) => baseId(d._id)))]
        if (ids.length > 1) throw new Error(`"${wanted}" matches several pages: ${ids.join(', ')}. Type the ID instead.`)
        const draft = found.find((d) => d._id.startsWith('drafts.'))
        const published = found.find((d) => !d._id.startsWith('drafts.'))
        const latest = draft || published
        if (!latest) throw new Error(`No ${project.type} with ID or slug "${wanted}" in Sanity.`)
        doc = {...latest, _id: baseId(latest._id)}
        delete doc._rev
        delete doc._createdAt
        from = draft ? `Sanity, the unpublished draft (${draft._updatedAt})` : `Sanity, the published page (${published?._updatedAt})`
      }
      const note = `From ${from}. Copy it to Claude; after editing, use "Add a page from Claude". Keep _id and _updatedAt as they are.`
      ui().showModalDialog(HtmlService.createHtmlOutput(copyHtml(JSON.stringify(doc, null, 2), note)).setWidth(900).setHeight(640), 'Get a page for Claude')
    })
  }

  return {menu, check, push, load, setToken, add, get, addFromClaude, preparePage, checkRowsAgainst}
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The paste box: a text area, a file picker, and Check only / Add buttons that call `serverFn(text, write)`. */
function pasteHtml(serverFn: string): string {
  return `<style>body{font:13px Arial,sans-serif;margin:0}textarea{width:100%;height:330px;font:12px monospace;box-sizing:border-box}pre{white-space:pre-wrap;font:12px/1.45 monospace;max-height:170px;overflow:auto;margin:8px 0 0}button{margin:8px 8px 0 0;padding:6px 12px}</style>
<div>Paste the page Claude wrote (or a page from Get), or choose its .json file: <input type="file" id="file" accept=".json,application/json"></div>
<textarea id="text" spellcheck="false" placeholder="{ ... }"></textarea>
<div><button id="check">Check only</button><button id="add">Add to the sheet</button></div>
<pre id="out"></pre>
<script>
var out = document.getElementById('out'), text = document.getElementById('text'), buttons = document.querySelectorAll('button')
document.getElementById('file').onchange = function (event) { var file = event.target.files[0]; if (file) file.text().then(function (value) { text.value = value }) }
function run(write) {
  out.textContent = write ? 'Adding...' : 'Checking...'
  buttons.forEach(function (b) { b.disabled = true })
  var done = function (message) { out.textContent = message; buttons.forEach(function (b) { b.disabled = false }) }
  google.script.run.withSuccessHandler(done).withFailureHandler(function (error) { done('Error: ' + error.message) }).${serverFn}(text.value, write)
}
document.getElementById('check').onclick = function () { run(false) }
document.getElementById('add').onclick = function () { run(true) }
</script>`
}

/** A read-only text area with a Copy button. */
function copyHtml(json: string, note: string): string {
  return `<style>body{font:13px Arial,sans-serif;margin:0}textarea{width:100%;height:520px;font:12px monospace;box-sizing:border-box}button{margin:8px 8px 0 0;padding:6px 12px}</style>
<div>${escapeHtml(note)}</div>
<textarea id="json" readonly spellcheck="false">${escapeHtml(json)}</textarea>
<div><button id="copy">Copy</button><span id="done"></span></div>
<script>
document.getElementById('copy').onclick = function () {
  var area = document.getElementById('json'); area.select(); document.execCommand('copy')
  document.getElementById('done').textContent = 'Copied.'
}
</script>`
}
