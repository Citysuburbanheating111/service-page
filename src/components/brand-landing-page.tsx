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
      // numbered carousels (the process): the arrows and dots step through the cards one at a time
      const dot = target.closest('[data-cs-dot]')
      const stepArrow = target.closest('[data-cs-prev],[data-cs-next]')
      const stepWrap = (dot || stepArrow)?.closest('[data-cs-carousel]')
      if (stepWrap?.querySelector('[data-cs-dot]')) {
        const track = stepWrap.querySelector('[data-cs-track]') as HTMLElement
        const count = track.children.length
        const current = steps.get(track) ?? 0
        const index = dot ? Number(dot.getAttribute('data-cs-dot')) : Math.min(count - 1, Math.max(0, current + (stepArrow!.hasAttribute('data-cs-next') ? 1 : -1)))
        goToStep(track, index)
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
    // Carousels: the arrows look active only when there is somewhere to go, the line under the reviews
    // and the numbered steps follow the scroll. The design's own active/idle looks are reused.
    const looks = new Map<Element, {active: [string, string]; idle: [string, string]}>()
    for (const wrap of element.querySelectorAll('[data-cs-carousel]')) {
      const next = wrap.querySelector('[data-cs-next]'), prev = wrap.querySelector('[data-cs-prev]')
      if (next && prev) looks.set(wrap, {active: [next.getAttribute('style') || '', next.innerHTML], idle: [prev.getAttribute('style') || '', prev.innerHTML]})
      // a dot's look = its circle style + its number's style (each dot keeps its own number)
      const dots = [...wrap.querySelectorAll('[data-cs-dot]')]
      // numbered carousels move by steps, so the cards must not snap to their own positions
      const stepTrack = wrap.querySelector<HTMLElement>('[data-cs-track]')
      if (dots.length && stepTrack) stepTrack.style.scrollSnapType = 'none'
      if (dots.length > 1) looks.set(dots[0], {
        active: [dots[0].getAttribute('style') || '', dots[0].firstElementChild?.getAttribute('style') || ''],
        idle: [dots[1].getAttribute('style') || '', dots[1].firstElementChild?.getAttribute('style') || ''],
      })
    }
    const paint = (el: Element, look: [string, string]) => { el.setAttribute('style', look[0]); el.innerHTML = look[1] }
    // numbered carousels keep a current step; the track's scroll position maps onto steps 1…n
    const steps = new Map<HTMLElement, number>()
    let stepping: HTMLElement | null = null
    function goToStep(track: HTMLElement, index: number) {
      const count = track.children.length, max = track.scrollWidth - track.clientWidth
      steps.set(track, index)
      stepping = track
      track.scrollTo({left: count > 1 ? (index / (count - 1)) * max : 0, behavior: 'smooth'})
      window.setTimeout(() => { if (stepping === track) stepping = null }, 600)
      update(track)
    }
    function update(track: HTMLElement) {
      const wrap = track.closest('[data-cs-carousel]')
      if (!wrap) return
      const max = track.scrollWidth - track.clientWidth
      const look = looks.get(wrap)
      const next = wrap.querySelector('[data-cs-next]'), prev = wrap.querySelector('[data-cs-prev]')
      const numbered = !!wrap.querySelector('[data-cs-dot]')
      const count = track.children.length
      // a swipe on a numbered carousel moves the current step with it
      if (numbered && stepping !== track && max > 0) steps.set(track, Math.round((track.scrollLeft / max) * (count - 1)))
      if (look && next && prev) {
        const step = steps.get(track) ?? 0
        const atStart = numbered ? step <= 0 : track.scrollLeft <= 2
        const atEnd = numbered ? step >= count - 1 : track.scrollLeft >= max - 2
        paint(prev, atStart ? look.idle : look.active); paint(next, atEnd ? look.idle : look.active)
        prev.setAttribute('aria-disabled', String(atStart)); next.setAttribute('aria-disabled', String(atEnd))
        // the active look carries a right arrow and the idle look a left one: flip where needed
        if (!atStart) prev.querySelector('svg')?.setAttribute('style', 'transform:scaleX(-1)')
        if (atEnd) next.querySelector('svg')?.setAttribute('style', 'transform:scaleX(-1)')
      }
      const index = steps.get(track) ?? 0
      const counter = wrap.querySelector('[data-cs-counter]')
      if (counter) counter.textContent = String(index + 1).padStart(2, '0')
      const dots = [...wrap.querySelectorAll('[data-cs-dot]')]
      const dotLook = dots[0] && looks.get(dots[0])
      if (dotLook) dots.forEach((d, i) => {
        const [circle, number] = i === index ? dotLook.active : dotLook.idle
        d.setAttribute('style', circle); d.firstElementChild?.setAttribute('style', number)
        d.setAttribute('aria-current', String(i === index))
      })
      const thumb = wrap.querySelector('[data-cs-progress]') as HTMLElement | null
      if (thumb && track.scrollWidth) {
        const width = (track.clientWidth / track.scrollWidth) * 100
        thumb.style.width = `${width}%`
        thumb.style.marginLeft = `${max > 0 ? (track.scrollLeft / max) * (100 - width) : 0}%`
        thumb.style.transition = 'margin-left .15s linear'
      }
    }
    function scroll(event: Event) { update(event.target as HTMLElement) }
    // Cards in a row line up: the same-named blocks get the height of the tallest one
    function equalize() {
      const groups = new Map<string, HTMLElement[]>()
      element!.querySelectorAll<HTMLElement>('[data-cs-equal]').forEach((el) => {
        el.style.minHeight = ''
        const key = `${el.closest('section')?.id}|${el.getAttribute('data-cs-equal')}`
        groups.set(key, [...(groups.get(key) || []), el])
      })
      for (const els of groups.values()) {
        const visible = els.filter((e) => e.offsetParent)
        const tallest = Math.max(0, ...visible.map((e) => e.offsetHeight))
        visible.forEach((e) => { e.style.minHeight = `${tallest}px` })
      }
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
    tracks.forEach((t) => { t.addEventListener('scroll', scroll, {passive: true}); update(t as HTMLElement) })
    equalize()
    const resize = () => { equalize(); tracks.forEach((t) => update(t as HTMLElement)) }
    window.addEventListener('resize', resize)
    document.fonts?.ready.then(resize)
    return () => {
      window.removeEventListener('resize', resize)
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
