import type {Metadata} from 'next'
import {Inter, Noto_Sans, Ubuntu} from 'next/font/google'
import {draftMode} from 'next/headers'
import {VisualEditing} from 'next-sanity/visual-editing'
import {DisableDraftMode} from '@/components/disable-draft-mode'
import {GoogleTagManager, GoogleTagManagerNoScript} from '@/components/google-tag-manager'
import {siteUrl} from '@/sanity/env'
import {SanityLive} from '@/sanity/lib/live'
import './globals.css'

const inter = Inter({subsets: ['latin'], variable: '--font-inter', display: 'swap'})
// The live citysuburbanheating.com header and footer use Noto Sans, with Ubuntu headings.
const notoSans = Noto_Sans({subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-noto-sans', display: 'swap'})
const ubuntu = Ubuntu({subsets: ['latin'], weight: ['500', '700'], variable: '--font-ubuntu', display: 'swap'})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {default: 'City & Suburban Service Pages', template: '%s | City & Suburban Heating & Cooling'},
  description: 'Heating, cooling, and indoor-air-quality services for Chicago homes and buildings.',
  icons: {
    icon: [{url: '/services/images/city-suburban-logo.png', type: 'image/png'}],
    apple: [{url: '/services/images/city-suburban-logo.png', type: 'image/png'}],
  },
}

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const draft = await draftMode()
  return (
    <html lang="en">
      <body className={`${inter.variable} ${notoSans.variable} ${ubuntu.variable}`}>
        {!draft.isEnabled && <GoogleTagManagerNoScript />}
        {children}
        <SanityLive />
        {draft.isEnabled ? <><VisualEditing /><DisableDraftMode /></> : <GoogleTagManager />}
      </body>
    </html>
  )
}
