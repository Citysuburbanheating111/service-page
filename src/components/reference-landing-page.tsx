'use client'
/* eslint-disable @next/next/no-page-custom-font -- The supplied design uses this exact font stylesheet. */

import {useEffect, useRef} from 'react'
import type {ReferenceSnapshot} from '@/reference-pages/types'
import liveFooter from '@/reference-pages/shared-footer.json'
import {migrateServiceUrls} from '@/lib/service-base-path'
import {CollectionHeader} from './collection-chrome'
import {withoutReferenceHeader} from '@/lib/reference-header'
import {refineServicePageLinks} from '@/lib/service-page-links'

type Props = {snapshot: Pick<ReferenceSnapshot, 'style' | 'html' | 'schema'>; serviceName: string}

export function ReferenceLandingPage({snapshot, serviceName}: Props) {
  const root = useRef<HTMLDivElement>(null)
  // Older published CMS revisions adopt the footer correction immediately;
  // current revisions retain their editable footer copy and images.
  const html = snapshot.html.includes('id="live-site-footer"') ? snapshot.html
    : snapshot.html.replace(/<footer\b(?=[^>]*data-module="site-footer")[\s\S]*?<\/footer>/, liveFooter.html)

  useEffect(() => {
    const element = root.current
    if (!element) return
    function click(event: MouseEvent) {
      const button = (event.target as Element).closest('[data-prev],[data-next]')
      const track = button?.closest('[data-carousel]')?.querySelector('[data-track]')
      if (track instanceof HTMLElement) track.scrollBy({left: (button?.hasAttribute('data-next') ? 1 : -1) * track.clientWidth * .9, behavior: 'smooth'})
    }
    async function submit(event: Event) {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || form.id !== 'book') return
      event.preventDefault()
      const button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
      const fields = new FormData(form)
      const name = String(fields.get('name') || '').trim()
      const phone = String(fields.get('phone') || '').replace(/\D/g, '')
      if (button) button.disabled = true
      let message = 'Your request could not be sent. Please call (773) 238-3838.'
      if (!name || phone.length < 7) {
        message = 'Enter your name and a valid phone number to request service.'
      } else try {
        const response = await fetch('/services/api/lead/', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            name: fields.get('name'), phone: fields.get('phone'), address: fields.get('area'),
            issue: fields.get('issue'), area: 'Chicago', service: serviceName,
          }),
        })
        if (response.ok) {message = 'Thanks—your request was sent.'; form.reset()}
      } catch { /* The visible status and telephone CTA remain available. */ }
      let status = form.querySelector('[role="status"]')
      if (!status) {status = document.createElement('p'); status.setAttribute('role', 'status'); form.append(status)}
      status.textContent = message
      if (button) button.disabled = false
    }
    element.addEventListener('click', click)
    element.addEventListener('submit', submit)
    return () => {element.removeEventListener('click', click); element.removeEventListener('submit', submit)}
  }, [serviceName])

  return <><CollectionHeader /><div className="reference-design" ref={root}>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Ubuntu:wght@400;500;700&display=swap" />
    <style dangerouslySetInnerHTML={{__html: migrateServiceUrls(snapshot.style)
      .replaceAll('nav[aria-label="Primary"]', '.reference-design nav[aria-label="Primary"]')
      .replaceAll('header a[href', '.reference-design header a[href')
      .replaceAll('header > div', '.reference-design header > div')}} />
    <style dangerouslySetInnerHTML={{__html: liveFooter.style}} />
    <div dangerouslySetInnerHTML={{__html: refineServicePageLinks(migrateServiceUrls(withoutReferenceHeader(html)))}} />
    {snapshot.schema && <script type="application/ld+json" dangerouslySetInnerHTML={{__html: migrateServiceUrls(snapshot.schema).replace(/</g, '\\u003c')}} />}
  </div></>
}
