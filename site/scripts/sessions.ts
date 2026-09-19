// The "All sessions" page: every autosaved session on the account, not just
// the handful the home page has room for (home.ts's `EARLIER_PREVIEW`). Reuses
// the same cards and delete flow as the home page's "Earlier sessions"
// section — see sessionCards.ts for why those live outside home.ts.
import {
  fetchHome,
  fetchStills,
  wasSignedIn,
  watchAuth,
} from '../../src/ui/cloud'
import { el, fillStills, sessionCard } from './sessionCards'

import type { CloudUser, HomeDoc, Still } from '../../src/ui/cloud'
import type { SessionEdits } from './sessionCards'

function need(id: string): HTMLElement {
  const node = document.getElementById(id)
  if (node === null) throw new Error(`no #${id}`)
  return node
}

const root = need('sessionsRoot')

function showMessage(text: string, link?: { href: string; label: string }) {
  root.textContent = ''
  const box = el('div', 'empty')
  box.append(el('p', 'emptySays', text))
  if (link !== undefined) {
    const go = el('a', 'btn primary', link.label)
    go.href = link.href
    box.append(go)
  }
  root.append(box)
}

const showSignedOut = () =>
  showMessage('Sign in on the home page to see your sessions.', {
    href: '/',
    label: 'Go to the home page →',
  })

function draw(user: CloudUser, doc: HomeDoc, stills?: Map<string, Still>) {
  if (doc.recent.length === 0) {
    showMessage('No sessions saved yet.', { href: '/', label: '← Home' })
    return
  }
  const now = Date.now()
  const edits: SessionEdits = {
    uid: user.uid,
    redraw: recent => {
      draw(user, { ...doc, recent }, stills)
    },
  }
  const grid = el('ul', 'grid looks')
  for (const session of doc.recent)
    grid.append(sessionCard(doc, session, stills, now, edits))
  root.textContent = ''
  root.append(grid)
}

async function load(user: CloudUser) {
  showMessage('Loading your sessions…')
  let doc: HomeDoc
  try {
    doc = await fetchHome(user.uid)
  } catch {
    showMessage('Your sessions did not load. Check the connection and reload.')
    return
  }
  draw(user, doc)
  const stills = await fetchStills(user.uid).catch(() => undefined)
  if (stills !== undefined) {
    draw(user, doc, stills)
    fillStills(root, stills)
  }
}

// Mirrors cloud.ts's own rule: a browser that has never signed in fetches
// nothing, and gets the sign-in prompt with no Firebase SDK downloaded.
if (wasSignedIn())
  watchAuth(user => {
    if (user === null) showSignedOut()
    else void load(user)
  }).catch(() => {
    showSignedOut()
  })
else showSignedOut()
