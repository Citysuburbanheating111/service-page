import footer from '@/reference-pages/shared-footer.json'
import {withAppServiceLinks} from '@/lib/service-base-path'

// Service links stay in this app (relative), like the header menu.
const html = withAppServiceLinks(footer.html)

/** The same captured WordPress footer is used by collections and service pages. */
export function LiveSiteFooter() {
  return <>
    <style dangerouslySetInnerHTML={{__html: footer.style}} />
    <div dangerouslySetInnerHTML={{__html: html}} />
  </>
}
