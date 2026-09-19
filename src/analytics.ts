import { PRIVACY_URL } from './ui/links'

// Google Analytics, on every page the site serves, once the visitor has said
// yes. It counts visits, and /privacy/ says what it collects.
//
// The id lives here so it is written once. The three Vite pages — the app, the
// vote tool and the stream view — call startAnalytics() from their entry
// module, and the Astro pages call it from site/components/Analytics.astro.
export const GA_ID = 'G-QWGTGSZ447'
const CONSENT_KEY = 'videoskillet.js_analytics'
const PRIVACY = PRIVACY_URL

// CROSS_REPO_SYNC(analytics-consent)
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export type AnalyticsAnswer = 'yes' | 'no'

// The answer stored on this browser, or null when nobody has answered. Storage
// that is switched off throws on any touch, and reads as unanswered.
export function analyticsAnswer(): AnalyticsAnswer | null {
  try {
    const answer = localStorage.getItem(CONSENT_KEY)
    return answer === 'yes' || answer === 'no' ? answer : null
  } catch {
    return null
  }
}

function remember(answer: AnalyticsAnswer | null) {
  try {
    if (answer === null) localStorage.removeItem(CONSENT_KEY)
    else localStorage.setItem(CONSENT_KEY, answer)
  } catch {
    // No storage: the notice asks again on the next page.
  }
}

function loadAnalytics() {
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

const NOTICE_CSS = `
.consent {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 9999;
  box-sizing: border-box;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--border-faint, #2e2e38);
  border-radius: 0.5rem;
  background: var(--surface, #16161a);
  color: var(--fg, #e6e6ee);
  font: 0.875rem/1.5 var(--font, system-ui, sans-serif);
  box-shadow: 0 6px 24px #0008;
}
.consent p {
  margin: 0 0 0.6rem;
}
.consent a {
  color: inherit;
}
.consent button {
  margin-right: 0.45rem;
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--border-faint, #2e2e38);
  border-radius: 0.35rem;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.consent button.yes {
  border-color: var(--accent, #7fd0a0);
  background: var(--accent, #7fd0a0);
  color: var(--accent-ink, #0b160f);
  font-weight: 600;
}
`

function askAnalytics() {
  const style = document.createElement('style')
  style.textContent = NOTICE_CSS
  const notice = document.createElement('div')
  notice.className = 'consent'
  notice.setAttribute('role', 'region')
  notice.setAttribute('aria-label', 'Analytics')

  const says = document.createElement('p')
  const privacy = document.createElement('a')
  privacy.href = PRIVACY
  privacy.textContent = 'What it collects'
  says.append('This site uses Google Analytics', privacy)

  const answer = (value: AnalyticsAnswer, label: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    if (value === 'yes') button.className = 'yes'
    button.addEventListener('click', () => {
      remember(value)
      notice.remove()
      style.remove()
      if (value === 'yes') loadAnalytics()
    })
    return button
  }

  notice.append(says, answer('yes', 'OK'), answer('no', 'No thanks'))
  document.head.append(style)
  document.body.append(notice)
}

// Loads Google Analytics when this browser said yes, asks when it has not
// answered, and does nothing when it said no. A browser a script is driving
// does nothing either: the harnesses that screenshot and record these pages
// would capture the notice, and their visits are nobody's.
export function startAnalytics(): void {
  if (navigator.webdriver) return
  const answer = analyticsAnswer()
  if (answer === 'yes') loadAnalytics()
  else if (answer === null) askAnalytics()
}

// Clears the answer, so the next page asks again.
export function forgetAnalyticsAnswer(): void {
  remember(null)
}
// CROSS_REPO_SYNC_END(analytics-consent)
