'use client'

import {FormEvent, useId, useState} from 'react'

type Props = {
  service: string
  area: string
  issueQuestion?: string
  issueOptions?: string[]
  buildingTypes?: string[]
  addressPlaceholder?: string
  subtitle?: string
  note?: string
}

export function LeadForm(props: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const id = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    const target = event.currentTarget
    const form = new FormData(target)
    try {
      const response = await fetch('/services/api/lead/', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({...Object.fromEntries(form.entries()), form: 'Booking form', page: window.location.pathname}),
      })
      setStatus(response.ok ? 'sent' : 'error')
      if (response.ok) target.reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <aside className="form-card" id="quote">
      <h2>{props.service} in {props.area}</h2>
      {props.subtitle && <p className="muted small">{props.subtitle}</p>}
      <form onSubmit={submit}>
        <input type="hidden" name="service" value={props.service} />
        <input type="hidden" name="area" value={props.area} />
        <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <div className="field"><label htmlFor={`${id}-name`}>Name</label><input id={`${id}-name`} name="name" required autoComplete="name" /></div>
        <div className="field"><label htmlFor={`${id}-phone`}>Phone</label><input id={`${id}-phone`} name="phone" type="tel" required autoComplete="tel" /></div>
        <div className="field"><label htmlFor={`${id}-address`}>Street or cross streets</label><input id={`${id}-address`} name="address" placeholder={props.addressPlaceholder} autoComplete="street-address" /></div>
        <div className="field"><label htmlFor={`${id}-building`}>Building type</label><select id={`${id}-building`} name="buildingType">{props.buildingTypes?.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label htmlFor={`${id}-issue`}>{props.issueQuestion || 'What do you need?'}</label><select id={`${id}-issue`} name="issue">{props.issueOptions?.map((item) => <option key={item}>{item}</option>)}</select></div>
        <button className="btn btn-primary btn-block" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Request service'}
        </button>
        {props.note && <p className="form-note">{props.note}</p>}
        {status === 'sent' && <p className="form-success" role="status">Thanks—your request was sent.</p>}
        {status === 'error' && <p className="form-error" role="alert">The form is not connected yet. Please call us instead.</p>}
      </form>
    </aside>
  )
}
