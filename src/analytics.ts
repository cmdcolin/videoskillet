// Google Analytics, on every page the site serves. It counts visits, and
// /privacy/ says what it collects and how to switch it off.
//
// The id lives here so it is written once. The three Vite pages — the app, the
// vote tool and the stream view — call installAnalytics() from their entry
// module. The two Astro pages render site/components/Analytics.astro, which
// reads GA_ID from here and writes out Google's own snippet, because those
// pages inline their scripts and run no bundle.
export const GA_ID = 'G-QWGTGSZ447'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function installAnalytics(): void {
  const tag = document.createElement('script')
  tag.async = true
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.append(tag)

  const queue = (window.dataLayer ??= [])
  // The arguments object, as Google's snippet pushes it: the tag reads each
  // entry by index and length, and an array literal in its place changes what
  // the reader gets.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    queue.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID)
}
