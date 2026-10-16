'use client'

import {useEffect, useRef, useState} from 'react'
import {liveMenu, servicesLink} from '@/lib/site-navigation'

/** One crawlable menu shared by desktop and mobile, with no duplicate link tree. */
export function SiteNavigation() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function outside(event: MouseEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('click', outside)
    return () => document.removeEventListener('click', outside)
  }, [open])

  return <div className="site-navigation" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') {setOpen(false); toggle.current?.focus()}
  }}>
    <button className="site-menu-toggle" type="button" ref={toggle}
      aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={open} aria-controls="site-primary-navigation" onClick={() => setOpen(!open)}>
      <span /><span /><span />
    </button>
    <nav id="site-primary-navigation" className={`site-nav${open ? ' is-open' : ''}`} aria-label="Main">
      <ul className="site-menu">
        {liveMenu.map((group, index) => {
          const isExpanded = expanded.includes(group.label)
          const submenuId = `site-service-submenu-${index}`
          return <li className={`site-menu-item has-sub${isExpanded ? ' is-expanded' : ''}`} key={group.label}>
            <a href={group.href} aria-haspopup="true" onClick={() => setOpen(false)}>{group.label}</a>
            <button className="site-submenu-toggle" type="button" aria-label={`${group.label} services`}
              aria-expanded={isExpanded} aria-controls={submenuId} onClick={() => setExpanded(previous =>
                isExpanded ? previous.filter(label => label !== group.label) : [...previous, group.label])}>
              <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
            </button>
            <ul className="site-submenu" id={submenuId}>
              {group.items.map(item => <li key={item.label}><a href={item.href} onClick={() => setOpen(false)}>{item.label}</a></li>)}
            </ul>
          </li>
        })}
        <li className="site-menu-item"><a href={servicesLink.href} onClick={() => setOpen(false)}>{servicesLink.label}</a></li>
      </ul>
    </nav>
  </div>
}
