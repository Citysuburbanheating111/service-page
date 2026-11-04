/**
 * Runs the generated apps-script/ServicePages.gs in a simulated Google Sheet (fake SpreadsheetApp, UrlFetchApp,
 * PropertiesService, LockService, HtmlService) and checks every path. Offline, with two made-up pages (one with a
 * section bigger than a sheet cell).
 *
 *   pnpm test:apps-script           the simulated sheet
 *   pnpm test:apps-script --live    also, read only: every published page from Sanity must load, and Get -> Add
 *                                   (check only) must give no errors and "same as Sanity"
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {referenceServicePage} from '../src/sanity/schemaTypes/referenceServicePage'
import {buildAppsScript, OUT_FILE} from './build-apps-script'
import {comparable, flatten, itemTypes, META_COLUMNS, overflow, sheetColumns, unflatten, type SchemaField} from './lib/sheet'
import {SERVICE_SHEET_OPTIONS} from './lib/service-sheet-rules'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- free-form documents
const TAB = 'Service pages'
const fields = (referenceServicePage as unknown as {fields: SchemaField[]}).fields
const columns = sheetColumns(fields, SERVICE_SHEET_OPTIONS)
const types = itemTypes(fields)
const headers = [...META_COLUMNS, ...columns.map((column) => column.path)]
const UPDATED = '2026-11-01T07:00:00Z'

const section = (module: string, html: string) => ({_key: `${module}-key`, _type: 'referencePageSection', module, html, contentFields: [{_key: 's1-copy-1', _type: 'referenceContentField', kind: 'text', label: 'Heading', target: 's1-copy-1', value: 'A heading'}]})
const work = (n: number) => Array.from({length: n}, (_, i) => ({_key: `work-${i + 1}`, _type: 'workItem', title: `Item ${i + 1}`, text: 'One line about it', icon: 'wrench'}))
const page = (id: string, cluster: string, slug: string, extra: Json = {}): Json => ({
  _id: id, _type: 'referenceServicePage', _updatedAt: UPDATED, name: `Name ${slug}`, clusterSlug: cluster, directoryClusterSlug: cluster,
  slug: {_type: 'slug', current: slug}, livePath: `/services/${cluster}/${slug}/`, canonicalUrl: `https://citysuburbanheating.com/services/${cluster}/${slug}/`,
  metaTitle: `Title ${slug}`, metaDescription: 'A description.', keyPhrases: ['furnace repair', 'heater repair'], structuredData: '{"@type":"Service"}',
  template: {_type: 'reference', _ref: 'servicePageTemplate-standard-v1'}, responsiveCss: '.a{color:red}\n', workWeHandle: work(7),
  sections: [section('hero', '<h1>Hi</h1>'), section('guide', `<p>${' '.repeat(60000)}${'x'.repeat(60000)}</p>`)], ...extra,
})
const pages = [page('reference-service-heating-heating-repair', 'heating', 'heater-repair-near-me'), page('reference-service-cooling-ac-repair', 'cooling', 'air-conditioning-repair-near-me')]

type World = {
  tab: string; grid: unknown[][]; selected: number[]; answer: 'YES' | 'NO'; token: string | null; sanityDocs: Json[]
  alerts: string[]; dialogs: string[]; mutations: Json[]; fetches: string[]; rejectNewToken: boolean; locked: boolean; prompt: string
}

const rowOf = (doc: Json) => {
  const cells = flatten(doc, columns)
  return headers.map((h) => (h === '_id' ? doc._id : h === '_status' ? 'published' : h === '_updatedAt' ? UPDATED : cells[h]))
}
function makeWorld(over: Partial<World> = {}): World {
  return {
    tab: TAB, grid: [[...headers], ...pages.map(rowOf)], selected: [2], answer: 'YES', token: 'sk-test', alerts: [], dialogs: [], mutations: [], fetches: [],
    rejectNewToken: false, locked: false, prompt: '', sanityDocs: pages.map((p) => structuredClone(p)), ...over,
  }
}

/** A tiny GROQ stand-in for the four queries the script sends. Hides drafts unless perspective=raw, like Sanity. */
function fakeQuery(world: World, params: Record<string, string>): unknown {
  const visible = world.sanityDocs.filter((d) => params.perspective === 'raw' || !d._id.startsWith('drafts.'))
  const q = params.query
  const arg = (name: string) => (params[`$${name}`] ? JSON.parse(params[`$${name}`]) : undefined)
  if (q.startsWith('count(')) return visible.length
  if (q.startsWith('{"pages"')) {
    const ids = [...arg('ids'), ...arg('drafts')]
    return {pages: visible.filter((d) => ids.includes(d._id)), owners: visible.map((d) => ({_id: d._id, _type: d._type, clusterSlug: d.clusterSlug, slug: d.slug, _owner: true}))}
  }
  if (q.startsWith('*[_id in $ids]{_id, _updatedAt}')) return visible.filter((d) => arg('ids').includes(d._id)).map((d) => ({_id: d._id, _updatedAt: d._updatedAt}))
  if (q.includes('slug.current == $id')) { const id = arg('id'); return visible.filter((d) => d._id === id || d._id === `drafts.${id}` || d.slug?.current === id) }
  if (q.startsWith('*[_type == $type] | order(')) return visible
  throw new Error(`Unexpected query: ${q}`)
}

function run(world: World, action: string, args = '') {
  const range = (row: number, col: number, nRows = 1, nCols = 1) => ({
    getValues: () => world.grid.slice(row - 1, row - 1 + nRows).map((r) => Array.from({length: nCols}, (_, i) => r[col - 1 + i] ?? '')),
    setValue: (value: unknown) => { world.grid[row - 1][col - 1] = value; return range(row, col) },
    setNumberFormat: () => range(row, col, nRows, nCols),
    setValues: (values: unknown[][]) => { values.forEach((cells, i) => { world.grid[row - 1 + i] = [...cells] }); return range(row, col, nRows, nCols) },
    getRow: () => row, getNumRows: () => nRows,
  })
  const sheet = {
    getName: () => world.tab, getLastColumn: () => world.grid[0]?.length || 0, getLastRow: () => world.grid.length,
    clearContents: () => { world.grid = [] }, setFrozenRows: () => undefined, getRange: range,
    getActiveRangeList: () => ({getRanges: () => world.selected.map((r) => range(r, 1))}), getActiveRange: () => range(world.selected[0], 1),
  }
  const ui = {
    ButtonSet: {OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL'}, Button: {YES: 'YES', NO: 'NO', OK: 'OK'},
    alert: (...a: string[]) => { world.alerts.push(a.slice(0, 2).join(' | ')); return a[2] === 'YES_NO' ? world.answer : 'OK' },
    showModalDialog: (html: {text: string}, title: string) => world.dialogs.push(`${title}\n${html.text}`),
    prompt: () => ({getSelectedButton: () => 'OK', getResponseText: () => world.prompt}),
    createMenu: () => ({addItem() { return this }, addSeparator() { return this }, addToUi() { world.alerts.push('menu added') }}),
  }
  const respond = (status: number, body: unknown) => ({getResponseCode: () => status, getContentText: () => JSON.stringify(body)})
  const UrlFetchApp = {
    fetch: (url: string, options: Json) => {
      if (url.length > 2000) throw new Error('Limit Exceeded: URLFetch URL length.') // Apps Script's own limit
      world.fetches.push(url)
      const auth = options.headers.Authorization
      if (auth !== `Bearer ${world.token}` && !(auth === 'Bearer sk-new' && !world.rejectNewToken)) return respond(401, {})
      if (url.includes('/data/mutate/')) {
        const {mutations} = JSON.parse(options.payload)
        world.mutations.push(...mutations)
        for (const m of mutations) world.sanityDocs = [...world.sanityDocs.filter((d) => d._id !== m.createOrReplace._id), {...m.createOrReplace, _updatedAt: '2026-11-03T10:00:00Z'}]
        return respond(200, {transactionId: 'tx-1'})
      }
      const body = options.payload ? JSON.parse(options.payload) : {}
      const params = Object.fromEntries(Object.entries(body.params || {}).map(([k, v]) => [`$${k}`, JSON.stringify(v)]))
      return respond(200, {result: fakeQuery(world, {...Object.fromEntries(new URL(url).searchParams), ...params, ...(body.query ? {query: body.query} : {})})})
    },
  }
  const context = vm.createContext({
    SpreadsheetApp: {
      getUi: () => ui, getActiveSheet: () => sheet,
      getActiveSpreadsheet: () => ({getSheetByName: (name: string) => (name === TAB ? sheet : null), insertSheet: () => sheet}),
    },
    UrlFetchApp,
    PropertiesService: {getUserProperties: () => ({getProperty: () => world.token, setProperty: (_k: string, v: string) => { world.token = v }})},
    LockService: {getDocumentLock: () => ({tryLock: () => !world.locked, releaseLock: () => undefined})},
    HtmlService: {createHtmlOutput: (text: string) => ({text, setWidth() { return this }, setHeight() { return this }})},
    URL, encodeURIComponent, JSON, Date,
  })
  return vm.runInContext(fs.readFileSync(OUT_FILE, 'utf8') + `\n${action}(${args})`, context)
}

const col = (name: string) => headers.indexOf(name)
let passed = 0
async function check(name: string, body: () => void | Promise<void>) {
  try { await body(); passed++; console.log(`ok - ${name}`) } catch (error) { console.error(`not ok - ${name}`); throw error }
}

async function main() {
  await check('the committed ServicePages.gs matches the schema and code (run pnpm apps-script:build)', async () => {
    const lf = (text: string) => text.replace(/\r\n/g, '\n')
    assert.equal(lf(fs.readFileSync(OUT_FILE, 'utf8')), lf(await buildAppsScript()))
  })
  await check('a page round-trips through its row, including a section split over 3 cells', () => {
    for (const p of pages) {
      assert.deepEqual(overflow(p, columns), [])
      const back = unflatten(flatten(p, columns), columns, types)
      assert.deepEqual(back.errors, [])
      assert.deepEqual(comparable(back.doc), comparable({...p, _id: undefined, _type: undefined}))
    }
    assert.ok(flatten(pages[0], columns)['sections[2]#3'].length > 0, 'the big section uses a third cell')
  })
  await check('the menu only adds this tab\'s actions, and Menu.gs calls it by name', () => {
    const world = makeWorld()
    run(world, 'servicePagesMenu')
    assert.deepEqual(world.alerts, ['menu added'])
    assert.match(fs.readFileSync('apps-script/Menu.gs', 'utf8'), /'servicePagesMenu'/)
    assert.doesNotMatch(fs.readFileSync(OUT_FILE, 'utf8'), /function onOpen/)
  })
  await check('on any other tab nothing is read or written', () => {
    const world = makeWorld({tab: 'Service area pages'})
    run(world, 'servicePagesPush')
    assert.match(world.alerts[0], /Open the "Service pages" tab/)
    assert.equal(world.fetches.length, 0)
  })
  await check('an unchanged row is the same as Sanity and nothing is written', () => {
    const world = makeWorld()
    run(world, 'servicePagesCheck')
    assert.match(world.dialogs[0], /same as Sanity, nothing to push/)
    run(world, 'servicePagesPush')
    assert.equal(world.mutations.length, 0)
  })
  await check('checking 40 rows at once stays under the Apps Script URL length limit', () => {
    const many = Array.from({length: 40}, (_, i) => page(`reference-service-heating-long-test-page-number-${i}`, 'heating', `long-test-page-number-${i}-near-me`))
    const world = makeWorld({grid: [[...headers], ...many.map(rowOf)], sanityDocs: many.map((p) => structuredClone(p)), selected: many.map((_, i) => i + 2)})
    run(world, 'servicePagesCheck')
    assert.equal(world.alerts.length, 0, world.alerts.join(' | '))
    assert.equal(world.dialogs[0].match(/same as Sanity/g)?.length, many.length)
  })
  await check('an edited row is pushed as a draft after Yes, and the row is stamped', () => {
    const world = makeWorld()
    world.grid[1][col('metaTitle')] = 'Edited title'
    run(world, 'servicePagesPush')
    assert.match(world.alerts[0], /Write drafts to Sanity\? \| Project boolyxr0, dataset production[\s\S]*drafts\.reference-service-heating-heating-repair/)
    assert.equal(world.mutations.length, 1)
    const doc = world.mutations[0].createOrReplace
    assert.equal(doc._id, 'drafts.reference-service-heating-heating-repair')
    assert.equal(doc._type, 'referenceServicePage')
    assert.equal(doc.metaTitle, 'Edited title')
    assert.equal(doc.sections[1].html.length, pages[0].sections[1].html.length)
    assert.equal(doc.template._ref, 'servicePageTemplate-standard-v1')
    assert.ok(!world.fetches.some((url) => url.includes('/data/query/') && !url.includes('perspective=raw')), 'every query sends perspective=raw')
    assert.match(String(world.grid[1][col('_status')]), /^Draft pushed .* publish in the Studio$/)
    assert.equal(world.grid[1][col('_updatedAt')], '2026-11-03T10:00:00Z')
  })
  await check('answering No writes nothing', () => {
    const world = makeWorld({answer: 'NO'})
    world.grid[1][col('metaTitle')] = 'Edited title'
    run(world, 'servicePagesPush')
    assert.equal(world.mutations.length, 0)
  })
  await check('one bad row blocks the whole push', () => {
    const world = makeWorld({selected: [2, 3]})
    world.grid[1][col('metaTitle')] = 'Edited title'
    world.grid[2][col('sections[1]')] = '{not json'
    run(world, 'servicePagesPush')
    assert.match(world.dialogs[0], /Not pushed[\s\S]*Row 3[\s\S]*sections\[1\]: not valid JSON/)
    assert.equal(world.mutations.length, 0)
  })
  await check('a newer draft in the Studio is refused', () => {
    const world = makeWorld()
    world.sanityDocs.push({...pages[0], _id: `drafts.${pages[0]._id}`, _updatedAt: '2026-11-02T00:00:00Z'})
    world.grid[1][col('metaTitle')] = 'Edited title'
    run(world, 'servicePagesPush')
    assert.match(world.dialogs[0], /changed in Sanity \(2026-11-02T00:00:00Z\) after this row was loaded/)
    assert.equal(world.mutations.length, 0)
  })
  await check('a slug already used by another page in the same category is refused', () => {
    const world = makeWorld()
    world.grid[2][col('clusterSlug')] = 'heating'
    world.grid[2][col('slug')] = 'heater-repair-near-me'
    world.grid[2][col('_id')] = 'reference-service-heating-ac-repair'
    world.grid[2][col('livePath')] = ''
    world.grid[2][col('canonicalUrl')] = ''
    world.selected = [3]
    run(world, 'servicePagesCheck')
    assert.match(world.dialogs[0], /\/services\/heating\/heater-repair-near-me\/ is already used by reference-service-heating-heating-repair/)
  })
  await check('two selected rows for the same page are refused', () => {
    const world = makeWorld({selected: [2, 3]})
    world.grid[2] = [...world.grid[1]]
    world.grid[2][col('metaTitle')] = 'Edited'
    run(world, 'servicePagesCheck')
    assert.match(world.dialogs[0], /same page as row 2/)
  })
  await check('an _id from another URL category is refused', () => {
    const world = makeWorld()
    world.grid[1][col('_id')] = 'reference-service-cooling-heating-repair'
    run(world, 'servicePagesCheck')
    assert.match(world.dialogs[0], /does not match the URL category \(expected reference-service-heating-\.\.\.\)/)
  })
  await check('another push in progress blocks this one', () => {
    const world = makeWorld({locked: true})
    run(world, 'servicePagesPush')
    assert.match(world.alerts[0], /Someone else is pushing/)
    assert.equal(world.mutations.length, 0)
  })
  await check('a token is saved only after Sanity accepts it', () => {
    const rejected = makeWorld({token: null, rejectNewToken: true, prompt: 'sk-new'})
    run(rejected, 'servicePagesSetToken')
    assert.equal(rejected.token, null)
    assert.match(rejected.alerts[0], /refused the token/)
    const accepted = makeWorld({token: null, prompt: 'sk-new'})
    run(accepted, 'servicePagesSetToken')
    assert.equal(accepted.token, 'sk-new')
  })
  await check('Load fills the tab with the published pages only', () => {
    const world = makeWorld({grid: [], answer: 'YES'})
    world.sanityDocs.push({...pages[0], _id: `drafts.${pages[0]._id}`})
    run(world, 'servicePagesLoad')
    assert.equal(world.grid.length, 3)
    assert.deepEqual(world.grid[0], headers)
    assert.match(String(world.grid[1][col('_status')]), /unpublished draft changes/)
  })
  const json = (doc: Json) => JSON.stringify(JSON.stringify(doc))
  await check('Add with Check only writes nothing', () => {
    const world = makeWorld()
    const before = JSON.stringify(world.grid)
    const out = run(world, 'servicePagesAddFromClaude', `${json({...pages[0], metaTitle: 'New title'})}, false`)
    assert.match(out, /Ready to add: reference-service-heating-heating-repair[\s\S]*1 field\(s\) differ: metaTitle/)
    assert.equal(JSON.stringify(world.grid), before)
  })
  await check('Add writes the page into its own row', () => {
    const world = makeWorld()
    const out = run(world, 'servicePagesAddFromClaude', `${json({...pages[0], metaTitle: 'New title'})}, true`)
    assert.match(out, /Added: .* replacing row 2/)
    assert.equal(world.grid[1][col('metaTitle')], 'New title')
    assert.equal(world.grid[1][col('_updatedAt')], UPDATED)
    assert.equal(world.grid.length, 3)
  })
  await check('Add appends a new page with a derived ID', () => {
    const world = makeWorld()
    const fresh = page('', 'heating', 'furnace-repair-near-me')
    delete fresh._id
    delete fresh._updatedAt
    const out = run(world, 'servicePagesAddFromClaude', `${json(fresh)}, true`)
    assert.match(out, /Added: reference-service-heating-furnace-repair .* as a new row/)
    assert.equal(world.grid.length, 4)
  })
  await check('Add refuses unknown fields and other document types', () => {
    const world = makeWorld()
    assert.match(run(world, 'servicePagesAddFromClaude', `${json({...pages[0], madeUp: 'x'})}, false`), /madeUp: not a field of the page/)
    assert.match(run(world, 'servicePagesAddFromClaude', `${json({...pages[0], _type: 'brandPage'})}, false`), /This is a brandPage/)
    assert.match(run(world, 'servicePagesAddFromClaude', `${JSON.stringify('not json')}, false`), /not valid JSON/)
  })
  await check('Get, then Add, gives back the same page', () => {
    const world = makeWorld({prompt: 'heater-repair-near-me'})
    run(world, 'servicePagesGet')
    const shown = world.dialogs[0].match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)![1].replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    const out = run(world, 'servicePagesAddFromClaude', `${JSON.stringify(shown)}, false`)
    assert.match(out, /Ready to add[\s\S]*Sanity: the same as the page already there/)
  })

  if (process.argv.includes('--live')) await checkLive()
  console.log(`${passed} checks passed.`)
}

/** Read only: every published page loads into the sheet, and Get -> Add (check only) is clean and unchanged. */
async function checkLive() {
  for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] ||= m[2].replace(/^['"]|['"]$/g, '')
  }
  const token = process.env.SANITY_API_READ_TOKEN
  if (!token) throw new Error('--live needs SANITY_API_READ_TOKEN in .env.local')
  const url = `https://boolyxr0.api.sanity.io/v2025-02-19/data/query/production?query=${encodeURIComponent('*[_type == "referenceServicePage"]')}&perspective=raw`
  const docs: Json[] = (await (await fetch(url, {headers: {authorization: `Bearer ${token}`}})).json()).result
  const published = docs.filter((d) => !d._id.startsWith('drafts.'))
  await check(`live: all ${published.length} published pages load, and Get -> Add (check only) gives 0 errors and "same as Sanity"`, () => {
    const world = makeWorld({sanityDocs: docs, grid: []})
    run(world, 'servicePagesLoad')
    assert.equal(world.grid.length, published.length + 1, world.alerts.join('\n'))
    const problems: string[] = []
    for (const doc of published) {
      const latest = docs.find((d) => d._id === `drafts.${doc._id}`) || doc
      const shape: Json = {...latest, _id: doc._id}
      delete shape._rev
      delete shape._createdAt
      const out: string = run(world, 'servicePagesAddFromClaude', `${JSON.stringify(JSON.stringify(shape))}, false`)
      if (!/Sanity: the same as the page already there/.test(out)) problems.push(`${doc._id}: ${out.slice(0, 300)}`)
    }
    assert.deepEqual(problems, [])
  })
}

// Run directly, or imported by a deliberate-break run (which calls main itself).
if (process.argv[1] && /test-apps-script.ts$/.test(process.argv[1])) main().catch((error: unknown) => { console.error(error); process.exit(1) })
export {main}
