/**
 * Sanity page <-> one spreadsheet row per page (copied from the Highlights Chicago sheet setup, made generic).
 *
 * The columns come from the page's Sanity schema, so every column heading is its exact Sanity field path:
 *   name, slug, template                       single fields (a slug cell holds slug.current, a reference cell _ref)
 *   seo.title, hero.lede                       object fields
 *   keyPhrases[3], districts.zips[1]           list of text or numbers, numbered from 1
 *   workWeHandle[2].title                      list of items, one column per part
 *   cardImage, sections[4]                     anything not plain: one JSON cell
 *   sections[4]#2                              the next 49,000 characters of a JSON cell too big for one cell
 * A field added to the schema later gets its columns automatically. No Node or Sanity imports here: this file
 * is also bundled into the Google Sheet's Apps Script.
 */
export type SchemaField = {name: string; type: string; fields?: SchemaField[]; of?: Array<{type: string; name?: string; fields?: SchemaField[]}>}
export type Column = {path: string; kind: 'text' | 'number' | 'boolean' | 'slug' | 'reference' | 'json'; part?: number}
export type SheetOptions = {
  /** Field keys (dotted, no positions) stored as JSON: one cell, or one cell per item for a list. */
  json?: string[]
  /** Columns per list, keyed by dotted field key. Load and Add refuse a page with more items. */
  capacity?: Record<string, number>
  defaultCapacity?: number
  /** Cells per JSON value, for values longer than one Google Sheets cell (50,000 characters). */
  jsonParts?: Record<string, number>
}
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- free-form Sanity documents

/** Google Sheets holds at most 50,000 characters in a cell; keep a margin. */
export const CELL_LIMIT = 49000
/** Bookkeeping columns, before the fields. They are never sent to Sanity. */
export const META_COLUMNS = ['_id', '_status', '_updatedAt']

const SCALAR = new Set(['string', 'text', 'url', 'number', 'date', 'datetime', 'boolean'])
const kindOf = (type: string): Column['kind'] =>
  type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : type === 'slug' ? 'slug' : type === 'reference' ? 'reference' : 'text'

export function sheetColumns(fields: SchemaField[], options: SheetOptions = {}, prefix = '', key = ''): Column[] {
  const json = new Set(options.json || [])
  const columns: Column[] = []
  const jsonCell = (path: string, fieldKey: string) => {
    const parts = options.jsonParts?.[fieldKey] || 1
    for (let part = 1; part <= parts; part++) columns.push(part === 1 ? {path, kind: 'json'} : {path: `${path}#${part}`, kind: 'json', part})
  }
  for (const field of fields) {
    const path = `${prefix}${field.name}`
    const fieldKey = key ? `${key}.${field.name}` : field.name
    if (field.type === 'array') {
      const member = field.of?.[0]
      const capacity = options.capacity?.[fieldKey] ?? options.defaultCapacity ?? 6
      for (let i = 1; i <= capacity; i++) {
        if (json.has(fieldKey)) jsonCell(`${path}[${i}]`, fieldKey)
        else if (member?.fields) columns.push(...sheetColumns(member.fields, options, `${path}[${i}].`, fieldKey))
        else if (member && (SCALAR.has(member.type) || member.type === 'reference')) columns.push({path: `${path}[${i}]`, kind: kindOf(member.type)})
        else jsonCell(`${path}[${i}]`, fieldKey)
      }
      continue
    }
    if (json.has(fieldKey) || field.type === 'image' || field.type === 'file' || field.type === 'geopoint') { jsonCell(path, fieldKey); continue }
    if (SCALAR.has(field.type) || field.type === 'slug' || field.type === 'reference') { columns.push({path, kind: kindOf(field.type)}); continue }
    if (field.type === 'object' && field.fields) { columns.push(...sheetColumns(field.fields, options, `${path}.`, fieldKey)); continue }
    jsonCell(path, fieldKey)
  }
  return columns
}

/** The named item type of every list, by list path with positions removed ("districts.items" -> "district"). */
export function itemTypes(fields: SchemaField[], prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of fields) {
    const path = `${prefix}${field.name}`
    const member = field.of?.[0]
    if (field.type === 'array' && member?.fields) {
      if (member.name) out[path] = member.name
      Object.assign(out, itemTypes(member.fields, `${path}.`))
    } else if (field.type === 'object' && field.fields) Object.assign(out, itemTypes(field.fields, `${path}.`))
  }
  return out
}

/** "buildings[2].services[1].label" -> ["buildings", 1, "services", 0, "label"] (list positions 0-based). */
function segments(path: string): Array<string | number> {
  const out: Array<string | number> = []
  for (const part of path.split('.')) {
    const match = part.match(/^([^[]+)((?:\[\d+\])*)$/)
    if (!match) throw new Error(`Bad column path: ${path}`)
    out.push(match[1])
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) out.push(Number(index[1]) - 1)
  }
  return out
}

function getAt(doc: Json, path: string): unknown {
  let value: unknown = doc
  for (const segment of segments(path)) {
    if (value == null || typeof value !== 'object') return undefined
    value = (value as Json)[segment as string]
  }
  return value
}

function setAt(doc: Json, path: string, value: unknown) {
  const parts = segments(path)
  let node: Json = doc
  parts.forEach((segment, i) => {
    if (i === parts.length - 1) { node[segment as string] = value; return }
    if (node[segment as string] == null) node[segment as string] = typeof parts[i + 1] === 'number' ? [] : {}
    node = node[segment as string]
  })
}

function cellOf(value: unknown, kind: Column['kind']): string {
  if (value === undefined || value === null || value === '') return ''
  if (kind === 'json') return JSON.stringify(value)
  if (kind === 'slug') return typeof value === 'object' ? String((value as Json).current ?? '') : String(value)
  if (kind === 'reference') return typeof value === 'object' ? String((value as Json)._ref ?? '') : String(value)
  return String(value)
}

const baseOf = (column: Column) => (column.part ? column.path.replace(/#\d+$/, '') : column.path)
/** How many cells each JSON value may use, by its column path. */
function partsOf(columns: Column[]) {
  const parts = new Map<string, number>()
  for (const column of columns) if (column.kind === 'json') parts.set(baseOf(column), Math.max(parts.get(baseOf(column)) || 0, column.part || 1))
  return parts
}

/** Every value that would lose data, as "path (n items, m columns)" or "path (n characters, m cells)". */
export function overflow(doc: Json, columns: Column[]): string[] {
  const listPaths = new Map<string, number>()
  for (const column of columns) {
    const match = baseOf(column).match(/^(.*?)\[(\d+)\](?!.*\[)/)
    if (match) {
      const key = match[1].replace(/\[\d+\]/g, '[]')
      listPaths.set(key, Math.max(listPaths.get(key) || 0, Number(match[2])))
    }
  }
  const problems: string[] = []
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      const capacity = listPaths.get(path)
      if (capacity !== undefined && value.length > capacity) problems.push(`${path} (${value.length} items, ${capacity} columns)`)
      value.forEach((item) => visit(item, `${path}[]`))
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) if (!key.startsWith('_')) visit(child, path ? `${path}.${key}` : key)
    }
  }
  visit(doc, '')
  for (const [path, parts] of partsOf(columns)) {
    const text = cellOf(getAt(doc, path), 'json')
    if (text.length > parts * CELL_LIMIT) problems.push(`${path} (${text.length} characters, ${parts} cells)`)
  }
  for (const column of columns) {
    if (column.kind === 'json') continue
    const text = cellOf(getAt(doc, column.path), column.kind)
    if (text.length > CELL_LIMIT) problems.push(`${column.path} (${text.length} characters, 1 cell)`)
  }
  return problems
}

export function flatten(doc: Json, columns: Column[]): Record<string, string> {
  const row: Record<string, string> = {}
  for (const column of columns) {
    if (column.kind !== 'json') { row[column.path] = cellOf(getAt(doc, column.path), column.kind); continue }
    const text = cellOf(getAt(doc, baseOf(column)), 'json')
    const start = ((column.part || 1) - 1) * CELL_LIMIT
    row[column.path] = text.slice(start, start + CELL_LIMIT)
  }
  return row
}

const listKey = (path: string) => path.replace(/\[\d+\]/g, '')

/**
 * Drops empty list items, gives each remaining object item a stable _key (kept when the item has one) and its
 * named _type from the schema.
 */
function tidy(value: unknown, path: string, types: Record<string, string>): unknown {
  if (Array.isArray(value)) {
    const items = value.filter((item) => item !== undefined && item !== null && item !== '' && !(typeof item === 'object' && Object.keys(item).length === 0))
    const name = path.split('.').pop() || 'item'
    return items.map((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      const typed = types[listKey(path)] ? {_type: types[listKey(path)]} : {}
      return {_key: `${name}-${i + 1}`, ...typed, ...(tidy(item, `${path}[]`, types) as Json)}
    })
  }
  if (value && typeof value === 'object') {
    const out: Json = {}
    for (const [key, child] of Object.entries(value)) {
      const clean = key.startsWith('_') ? child : tidy(child, path.replace(/\[\]$/, '') ? `${path.replace(/\[\]$/, '')}.${key}` : key, types)
      if (clean !== undefined && !(Array.isArray(clean) && clean.length === 0) && !(clean && typeof clean === 'object' && !Array.isArray(clean) && Object.keys(clean).length === 0)) out[key] = clean
    }
    return out
  }
  return value
}

export type RowResult = {doc: Json; errors: string[]}

/** One sheet row -> the page's Sanity fields (no _id or _type). Bad numbers and bad JSON are errors, never guesses. */
export function unflatten(row: Record<string, string>, columns: Column[], types: Record<string, string> = {}): RowResult {
  const doc: Json = {}
  const errors: string[] = []
  for (const column of columns) {
    if (column.part) continue
    // Text is kept exactly as written: trimming would drop a value's own leading or trailing spaces and line
    // breaks, and a JSON value's parts are joined before anything else (a part may end in a space).
    let exact = row[column.path] ?? ''
    if (column.kind === 'json') for (let part = 2; row[`${column.path}#${part}`] !== undefined; part++) exact += row[`${column.path}#${part}`]
    const raw = exact.trim()
    if (!raw) continue
    if (column.kind === 'number') {
      const n = Number(raw.replace(/,/g, ''))
      if (!Number.isFinite(n)) { errors.push(`${column.path}: "${raw}" is not a number`); continue }
      setAt(doc, column.path, n)
    } else if (column.kind === 'boolean') {
      if (!/^(true|false)$/i.test(raw)) { errors.push(`${column.path}: "${raw}" must be TRUE or FALSE`); continue }
      setAt(doc, column.path, /^true$/i.test(raw))
    } else if (column.kind === 'json') {
      try { setAt(doc, column.path, JSON.parse(raw)) } catch { errors.push(`${column.path}: not valid JSON`) }
    } else if (column.kind === 'slug') setAt(doc, column.path, {_type: 'slug', current: raw})
    else if (column.kind === 'reference') setAt(doc, column.path, {_type: 'reference', _ref: raw})
    else setAt(doc, column.path, exact)
  }
  return {doc: tidy(doc, '', types) as Json, errors}
}

/** Columns in a sheet that are not fields (a typo in a heading would otherwise drop data silently). */
export function unknownColumns(headers: string[], columns: Column[]): string[] {
  const known = new Set([...META_COLUMNS, ...columns.map((column) => column.path)])
  return headers.filter((header) => header && !known.has(header))
}

/**
 * Why a row must not be pushed because Sanity moved on after the row was loaded, or undefined when it is safe.
 * `rowUpdatedAt` is the row's _updatedAt cell; `sanityUpdatedAt` is the page's latest edit in Sanity now (draft or
 * published), undefined for a page Sanity doesn't have yet.
 */
export function staleReason(rowUpdatedAt: string, sanityUpdatedAt?: string): string | undefined {
  if (!sanityUpdatedAt) return undefined
  if (!rowUpdatedAt.trim()) return 'this page already exists in Sanity but the row has no _updatedAt: load fresh pages and redo the edit there'
  const row = Date.parse(rowUpdatedAt)
  if (Number.isNaN(row)) return `_updatedAt "${rowUpdatedAt}" is not a date: load fresh pages`
  if (Date.parse(sanityUpdatedAt) > row) return `changed in Sanity (${sanityUpdatedAt}) after this row was loaded (${rowUpdatedAt}): load fresh pages and redo the edit`
  return undefined
}

/** A page with system fields and _key removed, empty values dropped and keys sorted, for comparing two versions. */
export function comparable(doc: Json): Json {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip)
    if (value && typeof value === 'object') {
      const out: Json = {}
      // Keys sorted: Sanity returns fields alphabetically, the sheet in schema order.
      for (const [key, child] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
        if (key.startsWith('_') && key !== '_ref') continue
        if (child === '' || child === null || child === undefined) continue
        const clean = strip(child)
        if (Array.isArray(clean) && clean.length === 0) continue
        if (clean && typeof clean === 'object' && !Array.isArray(clean) && Object.keys(clean).length === 0) continue
        out[key] = clean
      }
      return out
    }
    return value
  }
  return strip(doc) as Json
}

export function stripSystem(doc: Json): Json {
  const {_id, _type, _rev, _createdAt, _updatedAt, ...fields} = doc // eslint-disable-line @typescript-eslint/no-unused-vars
  return fields
}

/** Top-level fields that differ between a row's page and Sanity's current version; ['(new page)'] when Sanity has none. */
export function changedFields(next: Json, current: Json | undefined): string[] {
  if (!current) return ['(new page)']
  const a = comparable(next)
  const b = comparable(stripSystem(current))
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => !same(a[key], b[key])).sort()
}
