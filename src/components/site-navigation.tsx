'use client'

import {useEffect, useRef, useState} from 'react'
import {liveMenu, servicesMenu} from '@/lib/site-navigation'

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

  function submenuToggle(label: string, controls: string) {
    const isExpanded = expanded.includes(label)
    return <button className="site-submenu-toggle" type="button" aria-label={`${label} services`}
      aria-expanded={isExpanded} aria-controls={controls} onClick={() => setExpanded(previous =>
        isExpanded ? previous.filter(item => item !== label) : [...previous, label])}>
      <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
    </button>
  }

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
            {submenuToggle(group.label, submenuId)}
            <ul className="site-submenu" id={submenuId}>
              {group.items.map(item => <li key={item.label}><a href={item.href} onClick={() => setOpen(false)}>{item.label}</a></li>)}
            </ul>
          </li>
        })}
        <li className={`site-menu-item has-sub${expanded.includes(servicesMenu.label) ? ' is-expanded' : ''}`}>
          <a href={servicesMenu.href} aria-haspopup="true" onClick={() => setOpen(false)}>{servicesMenu.label}</a>
          {submenuToggle(servicesMenu.label, 'site-services-submenu')}
          <ul className="site-submenu site-submenu-services" id="site-services-submenu">
            {servicesMenu.columns.flatMap((column, index) => {
              const col = index ? ' is-second-column' : ''
              return [
                <li className={`site-submenu-heading${col}`} key={column.heading}><span>{column.heading}</span></li>,
                ...[...column.items, column.all].map(item => <li className={`${item === column.all ? 'site-submenu-all' : ''}${col}`.trim() || undefined} key={item.label}>
                  <a href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
                </li>),
              ]
            })}
          </ul>
        </li>
      </ul>
    </nav>
  </div>
}
