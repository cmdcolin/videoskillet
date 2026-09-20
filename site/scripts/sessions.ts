// The "All sessions" page: every autosaved session on the account, not just
// the handful the home page has room for (home.ts's `EARLIER_PREVIEW`). Reuses
// the same cards and delete flow as the home page's "Earlier sessions"
// section — see sessionCards.ts for why those live outside home.ts.
//
// Stills come in a page at a time (`fetchStill` per id), not the whole
// account's collection at once (`fetchStills`, what the home page uses): the
// home page always draws every saved look plus one preview row of sessions, so
// fetching the lot is one request either way, but this page can be asked to
// show any of up to RECENT_MAX sessions, and paging keeps the request the size
// of what is actually on screen.
import {
  fetchHome,
  fetchStill,
  wasSignedIn,
  watchAuth,
} from '../../src/ui/cloud'
import { el, fillStills, sessionCard, stillIdsFor } from './sessionCards'

import type { CloudUser, HomeDoc, Still } from '../../src/ui/cloud'
import type { RecentSession } from '../../src/ui/profileModel'
import type { SessionEdits } from './sessionCards'

function need(id: string): HTMLElement {
  const node = document.getElementById(id)
  if (node === null) throw new Error(`no #${id}`)
  return node
}

const root = need('sessionsRoot')

// How many cards a page shows before "Show more" fetches another batch's
// stills. Independent of home.ts's EARLIER_PREVIEW, which is about how much
// fits before pointing here at all.
const PAGE_SIZE = 30

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

// How many of `doc.recent` are on screen. Reset per `doc` (a fresh load, or a
// delete that redraws), so a delete does not truncate what was already open.
let shown = PAGE_SIZE

function draw(user: CloudUser, doc: HomeDoc, stills: Map<string, Still>) {
  if (doc.recent.length === 0) {
    showMessage('No sessions saved yet.', { href: '/', label: '← Home' })
    return
  }
  shown = Math.min(shown, doc.recent.length)
  const now = Date.now()
  const edits: SessionEdits = {
    uid: user.uid,
    redraw: recent => {
      draw(user, { ...doc, recent }, stills)
    },
  }
  const page = doc.recent.slice(0, shown)
  const grid = el('ul', 'grid looks')
  for (const session of page)
    grid.append(sessionCard(doc, session, stills, now, edits))
  root.textContent = ''
  root.append(grid)

  const rest = doc.recent.length - shown
  if (rest > 0) {
    const more = el('p', 'sessionsMore')
    const go = el(
      'button',
      'btn',
      `Show ${Math.min(PAGE_SIZE, rest)} more (${rest} left)`,
    )
    go.type = 'button'
    go.addEventListener('click', () => {
      shown += PAGE_SIZE
      draw(user, doc, stills)
    })
    more.append(go)
    root.append(more)
  }

  // Fetches only the ids `stills` does not already hold, so a redraw after a
  // delete, or after "Show more" grows the page, does not refetch a still
  // already on screen.
  void fillPageStills(user.uid, doc, page, stills)
}

async function fillPageStills(
  uid: string,
  doc: HomeDoc,
  page: readonly RecentSession[],
  stills: Map<string, Still>,
) {
  const ids = stillIdsFor(doc, page).filter(id => !stills.has(id))
  if (ids.length === 0) return
  await Promise.all(
    ids.map(id =>
      fetchStill(uid, id).then(
        still => {
          if (still !== undefined) stills.set(id, still)
        },
        () => undefined,
      ),
    ),
  )
  fillStills(root, stills)
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
  const stills = new Map<string, Still>()
  draw(user, doc, stills)
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
