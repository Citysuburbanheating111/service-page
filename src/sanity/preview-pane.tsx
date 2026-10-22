'use client'

import {useEffect, useState} from 'react'
import {useClient, useCurrentUser, type SanityClient} from 'sanity'
import {migrateServiceUrls} from '../lib/service-base-path'

type PreviewDocument = {livePath?: string; clusterSlug?: string; slug?: {current?: string}}

/** The page path a service landing page renders at, as Presentation resolves it. */
function pagePath(document: PreviewDocument | undefined) {
  if (!document) return undefined
  if (document.livePath) return migrateServiceUrls(document.livePath)
  return document.clusterSlug && document.slug?.current ? `/services/${document.clusterSlug}/${document.slug.current}/` : undefined
}

/**
 * A one-hour preview secret, written exactly as Presentation writes it, so the existing
 * /api/draft-mode/enable route accepts it (from @sanity/preview-url-secret's createPreviewSecret).
 */
async function createPreviewSecret(client: SanityClient, studioUrl: string, userId?: string) {
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const scoped = client.withConfig({apiVersion: '2025-02-19'})
  await scoped.transaction()
    .createOrReplace({_id: `drafts.${crypto.randomUUID()}`, _type: 'sanity.previewUrlSecret', secret, source: 'service-page-preview-tab', studioUrl, userId})
    .commit({tag: 'sanity.preview-url-secret'})
  return secret
}

const button = {padding: '6px 12px', border: '1px solid #c7ccd4', borderRadius: 4, background: '#fff', color: '#1f2937',
  font: '500 13px/1.4 system-ui, sans-serif', cursor: 'pointer', textDecoration: 'none'}

/**
 * "Preview" tab beside the editor: the page as it will look, drafts included. It enables
 * draft mode with a short-lived Studio-signed secret, the same handshake Presentation uses.
 */
export function ServicePagePreview(props: {document: {displayed: PreviewDocument}}) {
  const path = pagePath(props.document.displayed)
  const client = useClient({apiVersion: '2026-03-01'})
  const user = useCurrentUser()
  const [enableUrl, setEnableUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const origin = window.location.origin
    createPreviewSecret(client, `${origin}/services/studio`, user?.id)
      .then((secret) => {
        if (cancelled) return
        const params = new URLSearchParams({'sanity-preview-secret': secret, 'sanity-preview-pathname': path})
        setEnableUrl(`${origin}/services/api/draft-mode/enable/?${params}`)
      })
      .catch((reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : String(reason)))
    return () => {
      cancelled = true
    }
  }, [client, user?.id, path])

  if (!path) return <p style={{padding: 16, font: '14px system-ui, sans-serif'}}>Add a live path to preview this page.</p>
  if (error) return <p style={{padding: 16, font: '14px system-ui, sans-serif', color: '#b91c1c'}}>Preview unavailable: {error}</p>

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
      <div style={{display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb',
        font: '13px system-ui, sans-serif', color: '#4b5563'}}>
        <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{path} · shows unpublished changes</span>
        <button type="button" style={button} onClick={() => setReload((count) => count + 1)} disabled={!enableUrl}>Reload</button>
        {enableUrl && <a style={button} href={enableUrl} target="_blank" rel="noreferrer">Open in new tab</a>}
      </div>
      {enableUrl
        ? <iframe key={reload} src={enableUrl} title={`Preview of ${path}`} style={{flex: 1, width: '100%', border: 0, background: '#fff'}} />
        : <p style={{padding: 16, font: '14px system-ui, sans-serif'}}>Loading preview…</p>}
    </div>
  )
}
