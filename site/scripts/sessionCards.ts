// Session and look cards, shared between the signed-in home and the "All
// sessions" page: the still a card shows, its link, and the copy/delete row
// under it. Pulled out of home.ts so a second page can render the same cards
// without importing home.ts's page-specific wiring (it queries `#home`,
// `#landing` and the rest by id at module load, which a page without them
// would throw on).
import {
  deleteStill,
  dropSession,
  sessionStill,
  stillShows,
  stillTag,
} from '../../src/ui/cloud'
import { handOffSession } from '../../src/ui/resumeHandoff'
import { sinceWords } from '../lib/relativeTime'

import type { HomeDoc, Still } from '../../src/ui/cloud'
import type { RecentSession } from '../../src/ui/profileModel'

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export const linkFor = (query: string) => `/app/#${query}`

// The link a copied card carries, whole, so it opens from a chat window.
export const shareLink = (query: string) =>
  new URL(linkFor(query), location.href).href

export function section(
  id: string,
  heading: string,
  sub?: string,
): HTMLElement {
  const box = el('section', 'homeSec')
  box.id = id
  box.append(el('h2', 'head', heading))
  if (sub !== undefined) box.append(el('p', 'sub', sub))
  return box
}

// The still of a saved look, or the panel a look with no still gets. A profile
// saved before stills existed, or one whose still has not been written yet,
// shows the app mark on the card's own black.
export function shotOf(still: string | undefined): HTMLElement {
  const shot = el('span', 'shot')
  if (still === undefined) {
    shot.classList.add('blank')
    const mark = el('img', 'blankMark')
    mark.src = '/favicon.svg'
    mark.alt = ''
    mark.width = 40
    mark.height = 40
    shot.append(mark)
    return shot
  }
  const img = el('img', 'still')
  img.src = `data:image/webp;base64,${still}`
  img.alt = ''
  img.width = 640
  img.height = 512
  img.loading = 'lazy'
  img.decoding = 'async'
  shot.append(img)
  return shot
}

// Which still a card shows: `id`'s when it is a picture of the board the card
// is offering, and otherwise `or`'s.
export interface StillPick {
  id?: string
  // The board, as `stillTag` writes it. A tagged still matches or it does not,
  // and the clock never enters into it.
  q?: string
  // The fallback test for a still written before tagging: taken no earlier than
  // the entry it belongs to.
  since?: number
  or?: string
}

export function pickStill(
  stills: Map<string, Still>,
  pick: StillPick,
): string | undefined {
  const own = pick.id === undefined ? undefined : stills.get(pick.id)
  if (own !== undefined && stillShows(own, pick)) return own.webp
  return pick.or === undefined ? undefined : stills.get(pick.or)?.webp
}

// The stills arrive after a card is drawn, since they can be most of a
// megabyte between them. Until then a look that may have one gets the card's
// black with nothing on it. Every shot keeps its pick, so `fillStills` can swap
// in the picture, the mark, or a newer picture on a return by Back.
export function shotFor(
  pick: StillPick,
  stills: Map<string, Still> | undefined,
): HTMLElement {
  if (pick.id === undefined && pick.or === undefined) return shotOf(undefined)
  const shot =
    stills === undefined ? el('span', 'shot') : shotOf(pickStill(stills, pick))
  if (pick.id !== undefined) shot.dataset.look = pick.id
  if (pick.q !== undefined) shot.dataset.q = pick.q
  if (pick.since !== undefined) shot.dataset.since = String(pick.since)
  if (pick.or !== undefined) shot.dataset.or = pick.or
  return shot
}

export function fillStills(root: HTMLElement, stills: Map<string, Still>) {
  for (const shot of root.querySelectorAll<HTMLElement>(
    '.shot[data-look], .shot[data-or]',
  )) {
    const { look, q, since, or } = shot.dataset
    const pick = {
      id: look,
      q,
      since: since === undefined ? undefined : Number(since),
      or,
    }
    const webp = pickStill(stills, pick)
    const img = shot.querySelector<HTMLImageElement>('img.still')
    const same =
      webp === undefined
        ? shot.classList.contains('blank')
        : img?.src === `data:image/webp;base64,${webp}`
    if (!same) shot.replaceWith(shotFor(pick, stills))
  }
}

export function nameRow(name: string): HTMLElement {
  const row = el('span', 'name')
  row.append(document.createTextNode(name), el('span', 'open', 'open →'))
  return row
}

// A saved look with the session's query is the same board. The newest one names
// the session's card and lends it a still.
export const savedAs = (doc: HomeDoc, session: RecentSession) =>
  doc.profiles
    .filter(p => p.query === session.query)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0]

// The session's own still, when it is a picture of the board the card resumes.
// A session written from a hidden tab carries no new picture, and the entry it
// updates keeps the one an earlier write left, so the test is the board and not
// the clock. The matching saved look's still serves next; failing both, the
// card shows the mark.
export function sessionShot(
  doc: HomeDoc,
  session: RecentSession,
  stills: Map<string, Still> | undefined,
) {
  return shotFor(
    {
      id: sessionStill(session.id),
      q: stillTag(session.query),
      since: session.at,
      or: savedAs(doc, session)?.id,
    },
    stills,
  )
}

// A link that continues the session it opens.
export function resumeLink(
  session: RecentSession,
  className: string,
): HTMLElement {
  const go = el('a', className)
  go.href = linkFor(session.query)
  go.addEventListener('click', () => {
    handOffSession(session.id)
  })
  return go
}

// What a session card's verbs need: whose account it belongs to, and how to
// draw the page again from the list a delete left on the account.
export interface SessionEdits {
  uid: string
  redraw: (recent: RecentSession[]) => void
}

// Copy link and delete, in a row under a session card. Mirrors home.ts's
// `cardActions` for a saved look, minus rename: a session carries no name to
// change.
export function sessionActions(
  session: RecentSession,
  edits: SessionEdits,
): HTMLElement {
  const row = el('div', 'cardActions')
  const status = el('span', 'cardStatus')
  status.setAttribute('role', 'status')

  const act = (label: string, run: () => void) => {
    const button = el('button', 'cardAct', label)
    button.type = 'button'
    button.addEventListener('click', run)
    return button
  }
  const show = (...nodes: HTMLElement[]) => {
    row.replaceChildren(...nodes, status)
  }
  const busy = () => {
    for (const node of row.querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >('button, input'))
      node.disabled = true
  }

  const idle = (focus?: string) => {
    const buttons = [act('Copy link', copy), act('Delete', askDelete)]
    show(...buttons)
    buttons.find(button => button.textContent === focus)?.focus()
  }

  function copy() {
    const link = shareLink(session.query)
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(link))
      .then(
        () => {
          status.textContent = 'Link copied'
        },
        () => {
          status.textContent = 'Could not copy the link'
        },
      )
  }

  function askDelete() {
    status.textContent = ''
    const keep = act('Keep', () => idle('Delete'))
    show(
      el('span', 'cardAsk', 'Delete this session?'),
      act('Delete', remove),
      keep,
    )
    keep.focus()
  }

  function remove() {
    busy()
    dropSession(edits.uid, session.id).then(
      next => {
        // Best effort, like a deleted look's still: a still left behind is a
        // document nothing reads.
        deleteStill(edits.uid, sessionStill(session.id)).catch((e: unknown) => {
          console.error('deleting the still failed', e)
        })
        edits.redraw(next)
      },
      () => {
        idle('Delete')
        status.textContent = 'Could not delete. Try again.'
      },
    )
  }

  idle()
  return row
}

export function sessionCard(
  doc: HomeDoc,
  session: RecentSession,
  stills: Map<string, Still> | undefined,
  now: number,
  edits: SessionEdits,
): HTMLElement {
  const item = el('li')
  const link = resumeLink(session, 'demo')
  const match = savedAs(doc, session)
  link.append(
    sessionShot(doc, session, stills),
    nameRow(sinceWords(session.at, now)),
  )
  if (match !== undefined)
    link.append(el('span', 'says', `saved as “${match.name}”`))
  item.append(link, sessionActions(session, edits))
  return item
}
