'use client'
/* eslint-disable @next/next/no-page-custom-font -- The Paper design uses this exact font stylesheet. */

import {useEffect, useRef} from 'react'
import {CollectionHeader, CollectionFooter} from './collection-chrome'
import {validEmail} from '@/lib/lead-form-email'

type Props = {html: string; style: string; schema: string; serviceName: string}

/** Swap the look of two tabs (and their parts), so the clicked tab takes the active style. */
function swapStyles(a: Element, b: Element) {
  const sa = a.getAttribute('style') || '', sb = b.getAttribute('style') || ''
  a.setAttribute('style', sb); b.setAttribute('style', sa)
  const ka = [...a.children], kb = [...b.children]
  ka.forEach((child, i) => kb[i] && swapStyles(child, kb[i]))
}

/** A brand page: the Paper design drawn from Sanity fields, inside the live site header and footer. */
export function BrandLandingPage({html, style, schema, serviceName}: Props) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = root.current
    if (!element) return
    function click(event: MouseEvent) {
      const target = event.target as Element
      const tab = target.closest('[data-cs-tab]')
      if (tab) {
        const group = tab.closest('[data-cs-tabs]')
        const active = group?.querySelector('[data-cs-tab][aria-selected="true"]')
        if (group && active && active !== tab) {
          swapStyles(active, tab)
          active.setAttribute('aria-selected', 'false'); tab.setAttribute('aria-selected', 'true')
          const index = tab.getAttribute('data-cs-tab')
          group.querySelectorAll('[data-cs-panel]').forEach((panel) => panel.toggleAttribute('hidden', panel.getAttribute('data-cs-panel') !== index))
        }
        return
      }
      const arrow = target.closest('[data-cs-prev],[data-cs-next]')
      if (arrow) {
        const track = arrow.closest('[data-cs-carousel]')?.querySelector('[data-cs-track]')
        const card = track?.firstElementChild as HTMLElement | null
        if (track instanceof HTMLElement) track.scrollBy({left: (arrow.hasAttribute('data-cs-next') ? 1 : -1) * ((card?.offsetWidth || 300) + 20), behavior: 'smooth'})
        return
      }
      const more = target.closest('[data-cs-show-more]')
      if (more) { more.closest('.cs31-m')?.classList.add('cs31-show-more'); (more as HTMLElement).hidden = true; return }
      const faq = target.closest('[data-cs-faq]')
      if (faq && !target.closest('a')) {
        if (target.closest('[data-cs-answer]') && faq.classList.contains('is-open')) return
        const open = faq.classList.toggle('is-open')
        const sign = faq.querySelector('[data-cs-sign]')
        if (sign) sign.textContent = open ? '−' : '+'
      }
    }
    function scroll(event: Event) {
      const track = event.target as HTMLElement
      const counter = track.closest('[data-cs-carousel]')?.querySelector('[data-cs-counter]')
      const card = track.firstElementChild as HTMLElement | null
      if (!counter || !card) return
      const index = Math.min(track.children.length, Math.round(track.scrollLeft / (card.offsetWidth + 20)) + 1)
      counter.textContent = String(index).padStart(2, '0')
    }
    async function submit(event: Event) {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || form.id !== 'book') return
      event.preventDefault()
      const button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
      const fields = new FormData(form)
      const name = String(fields.get('name') || '').trim()
      const phone = String(fields.get('phone') || '').replace(/\D/g, '')
      const email = String(fields.get('email') || '').trim()
      const model = String(fields.get('model') || '').trim()
      if (button) button.disabled = true
      let message = 'Your request could not be sent. Please call (773) 238-3838.'
      if (!name || phone.length < 7 || !validEmail(email)) {
        message = 'Enter your name, a valid phone number and a valid email to book.'
      } else try {
        const response = await fetch('/services/api/lead/', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            name, phone: fields.get('phone'), email, address: fields.get('area'),
            issue: [fields.get('issue'), model && `Model: ${model}`].filter(Boolean).join(' · '),
            area: 'Chicago', service: form.dataset.service || serviceName, form: 'Brand page booking form', page: window.location.pathname,
          }),
        })
        if (response.ok) { message = 'Thanks, your request was sent. We will call you to confirm the visit.'; form.reset() }
      } catch { /* The visible status and the phone number remain available. */ }
      let status = form.querySelector('[role="status"]')
      if (!status) { status = document.createElement('p'); status.setAttribute('role', 'status'); status.className = 'cs31-status'; form.append(status) }
      status.textContent = message
      if (button) button.disabled = false
    }
    // Blocks rise into view as they scroll in (skipped for reduced motion; without script they simply show)
    const reveal = [...element.querySelectorAll('.cs31-reveal')]
    let observer: IntersectionObserver | undefined
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('cs31-js')
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer?.unobserve(entry.target) }
      }), {rootMargin: '0px 0px -8% 0px'})
      reveal.forEach((block) => observer!.observe(block))
    }
    const tracks = [...element.querySelectorAll('[data-cs-track]')]
    element.addEventListener('click', click)
    element.addEventListener('submit', submit)
    tracks.forEach((t) => t.addEventListener('scroll', scroll, {passive: true}))
    return () => {
      observer?.disconnect()
      element.removeEventListener('click', click); element.removeEventListener('submit', submit)
      tracks.forEach((t) => t.removeEventListener('scroll', scroll))
    }
  }, [serviceName])

  return <>
    <CollectionHeader />
    <div className="brand-design" ref={root}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&family=Ubuntu:wght@400;500;700&display=swap" />
      <style dangerouslySetInnerHTML={{__html: style}} />
      <main dangerouslySetInnerHTML={{__html: html}} />
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{__html: schema.replace(/</g, '\\u003c')}} />}
    </div>
    <CollectionFooter />
  </>
}
