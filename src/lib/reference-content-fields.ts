export type ReferenceContentField = {_key?: string; target: string; kind: string; label?: string; value: string}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Bind native Sanity copy/image fields while preserving the reference markup. */
export function applyReferenceContentFields(html: string, fields?: ReferenceContentField[] | null) {
  // A section with no editable fields comes back from GROQ as null, not undefined.
  for (const field of fields ?? []) {
    if (!/^[\w-]+$/.test(field.target) || typeof field.value !== 'string') continue
    const value = escapeHtml(field.value)
    if (field.kind === 'text') {
      const pattern = new RegExp(`(<([a-z][a-z0-9]*)\\b[^>]*data-content-field="${field.target}"[^>]*>)[^<]*(<\\/\\2>)`, 'g')
      html = html.replace(pattern, (_match, opening: string, _tag: string, closing: string) => opening + value + closing)
    } else if (field.kind === 'image' || field.kind === 'alt') {
      if (field.kind === 'image' && !/^(https?:\/\/|\/)/.test(field.value)) continue
      const pattern = new RegExp(`<img\\b[^>]*data-content-image="${field.target}"[^>]*>`, 'g')
      const attribute = field.kind === 'image' ? 'src' : 'alt'
      html = html.replace(pattern, (tag) => tag.replace(new RegExp(`\\b${attribute}="[^"]*"`), () => `${attribute}="${value}"`))
    }
  }
  return html
}

function textContent(markup: string) {
  return markup.replace(/<[^>]*>/g, ' ').replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_match, hex: string, decimal: string) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
    .replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ').trim()
}

/** Keep FAQ schema aligned with native CMS edits to the visible FAQ section. */
export function synchronizeVisibleSchema(schema: string, html: string) {
  if (!schema) return schema
  try {
    const graph = JSON.parse(schema) as {'@graph'?: Array<Record<string, unknown>>}
    const faqHtml = html.match(/<section\b[^>]*data-module="faq"[\s\S]*?<\/section>/)?.[0]
    const questions = faqHtml && [...faqHtml.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].flatMap((match) => {
      const summary = match[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)
      if (!summary) return []
      return [{'@type': 'Question', name: textContent(summary[1]), acceptedAnswer: {'@type': 'Answer', text: textContent(match[1].slice((summary.index || 0) + summary[0].length))}}]
    })
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    for (const node of graph['@graph'] || []) {
      if (node['@type'] === 'FAQPage' && questions?.length) node.mainEntity = questions
      if (node['@type'] === 'WebPage' && h1) node.name = textContent(h1)
    }
    return JSON.stringify(graph)
  } catch {return schema}
}
