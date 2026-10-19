// Every service page's booking form (form#book) comes from the page's stored HTML, so the Email field is
// added here at render time rather than in 41 Sanity documents. It copies the Phone field's markup and
// sits right after it. Pages that already have an email field are left as they are.
const phoneField = /(<label\b[^>]*>)Phone(<input\b[^>]*\bname="phone"[^>]*>)<\/label>/

export function withLeadEmailField(html: string): string {
  return html.replace(/<form id="book"[\s\S]*?<\/form>/, (form) => {
    if (/\bname="email"/.test(form)) return form
    return form.replace(phoneField, (field, label: string, input: string) => {
      const email = input
        .replace(/\btype="tel"/, 'type="email"')
        .replace(/\bname="phone"/, 'name="email"')
        .replace(/\bautocomplete="tel"/, 'autocomplete="email"')
        .replace(/^<input\b/, '<input aria-required="true"')
      return `${field}\n          ${label}Email${email}</label>`
    })
  })
}

export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
