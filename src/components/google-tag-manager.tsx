import Script from 'next/script'

// The same Tag Manager container as the WordPress site. It already fires GA4 (G-KPCRPN3203),
// the Google Ads tag (AW-959205901) and Clarity, so no separate gtag.js is loaded here.
const containerId = 'GTM-55JMQMTH'

// Only visits on the public domain are counted, not the Vercel URLs (production or preview)
// or localhost. The Studio is skipped too: its preview iframe loads these pages.
const publicHosts = ['citysuburbanheating.com', 'www.citysuburbanheating.com']

const snippet = `(function(w,d,s,l,i){if(${JSON.stringify(publicHosts)}.indexOf(w.location.hostname)<0||w.location.pathname.indexOf('/services/studio')===0)return;
w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`

export function GoogleTagManager() {
  return <Script id="google-tag-manager" strategy="afterInteractive">{snippet}</Script>
}

// For visitors without JavaScript; it sits right after the opening <body>, as Google asks.
export function GoogleTagManagerNoScript() {
  return (
    <noscript>
      <iframe src={`https://www.googletagmanager.com/ns.html?id=${containerId}`} height="0" width="0" style={{display: 'none', visibility: 'hidden'}} />
    </noscript>
  )
}
