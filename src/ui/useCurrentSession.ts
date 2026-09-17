import { useEffect, useRef, useState } from 'react'

import {
  STILL_MAX,
  deleteStill,
  putSession,
  putStill,
  sessionStill,
  stillTag,
} from './cloud'
import { newProfileId } from './profileModel'
import { takeSessionId } from './resumeHandoff'

// The session a signed-in user has open, mirrored onto their account so the home
// page can offer it back, as the resume card or one of the earlier sessions
// under it. The same packed query the address bar carries, written by the same
// producer — `profileQuery()` in useUrlState. Every write from one page load
// updates one entry in the account's list; resumeHandoff.ts says which entry a
// load continues.
//
// A null query is a session with nothing in it to resume, and the hook leaves
// the account alone. The app passes null while the engine is absent, when the
// controls it would read are the defaults and not the board. A board the page
// opened on is not written either — see `observe`.
//
// The address bar takes a write per settled change and costs nothing;
// a Firestore document takes a network round trip and counts against a quota, so
// this one is gated twice. A change waits `SETTLE_MS` for the board to stop
// moving, and no two writes land closer together than `MIN_GAP_MS` — a sustained
// drag therefore writes once every ten seconds while the address bar writes four
// times a second. A query identical to the one already on the account writes
// nothing at all.
// CROSS_REPO_SYNC(current-session-gate)
export const SETTLE_MS = 5000
export const MIN_GAP_MS = 10000

// The query last written to the account, and when it landed.
export interface WriteGate {
  query: string | null
  at: number
}

// When a newly settled query may be written, or null when the account already
// has it. The later of the two gates wins: the debounce measures from now, the
// rate limit from the last write that landed.
export function nextWriteAt(
  gate: WriteGate,
  query: string,
  now: number,
): number | null {
  if (query === gate.query) return null
  return Math.max(now + SETTLE_MS, gate.at + MIN_GAP_MS)
}

// The board this page opened on, and whether it has moved off it since.
export interface Opened {
  query: string | null
  moved: boolean
}

// A bare load opens on bars, and a link — a gallery look, a look somebody sent,
// the resume card itself — opens on a finished board. None of those is a
// session the visitor made, and writing one put it over the session the account
// held, so a gallery card opened from the home page took the resume card's
// place. The first query the page shows is where it opened, and the session
// starts when the board first differs from it.
export function observe(opened: Opened, query: string | null): Opened {
  if (query === null || opened.moved) return opened
  if (opened.query === null) return { query, moved: false }
  return query === opened.query ? opened : { ...opened, moved: true }
}
// CROSS_REPO_SYNC_END(current-session-gate)

// `grabThumb` gives the session's card a picture. A write made while the tab is
// hidden goes without one, because the grab waits for a frame and a hidden tab
// draws none; the home page then shows no still rather than an older board's.
export function useCurrentSession(
  uid: string | null,
  query: string | null,
  grabThumb?: (max: number) => Promise<string | null>,
) {
  const [sessionId] = useState(() => takeSessionId() ?? newProfileId())
  const gate = useRef<WriteGate>({ query: null, at: 0 })
  const opened = useRef<Opened>({ query: null, moved: false })
  // The query as of the last render, for the handler below, which fires long
  // after the effect that installed it.
  const live = useRef(query)

  const send = (id: string, q: string, withStill: boolean) => {
    const at = Date.now()
    gate.current = { query: q, at }
    // Taken now, so the picture is of the board the query describes, and
    // written once the session has landed, so a still is never newer than a
    // session the account refused. It is tagged with that board, because the
    // hide write below leaves the entry newer than its own picture. The stills
    // of sessions that left the list go too, best effort: a still left behind
    // is a document nothing reads.
    const still = withStill ? grabThumb?.(STILL_MAX) : undefined
    putSession(id, { id: sessionId, query: q, at })
      .then(dropped => {
        for (const gone of dropped)
          deleteStill(id, sessionStill(gone)).catch(() => undefined)
        return still
      })
      .then(webp =>
        webp === null || webp === undefined
          ? undefined
          : putStill(id, sessionStill(sessionId), webp, stillTag(q)),
      )
      .catch((e: unknown) => {
        // Dropped. The account keeps the previous session, the next settled
        // change tries again, and nothing on screen depends on this having
        // landed.
        console.error('saving the current session failed', e)
      })
  }

  // The dependency is the query string itself, so a render that rebuilds an
  // identical board does not restart the debounce (the same choice useUrlState
  // makes for the address bar).
  // An effect's cleanup return is conditional by nature (React's own documented pattern).
  // oxlint-disable-next-line typescript/consistent-return
  useEffect(() => {
    live.current = query
    opened.current = observe(opened.current, query)
    if (uid === null) {
      // Signing out forgets what the last account held, so signing into another
      // one on the same page writes its first session immediately.
      gate.current = { query: null, at: 0 }
      return undefined
    }
    if (query === null || !opened.current.moved) return undefined
    const due = nextWriteAt(gate.current, query, Date.now())
    if (due === null) return undefined
    const id = setTimeout(
      () => {
        // The hide handler below may have written this query while the timer
        // waited.
        if (query !== gate.current.query) send(uid, query, true)
      },
      Math.max(0, due - Date.now()),
    )
    return () => clearTimeout(id)
    // `send` reads only refs, the session id and the arguments it is given.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, query])

  // One last write on the way out, so a session closed mid-debounce is still the
  // one the home page offers back. `visibilitychange` rather than `pagehide`:
  // the firestore lite SDK sends an ordinary fetch with no keepalive flag, and a
  // request started at pagehide is cancelled with the document. Hiding the tab
  // happens before that — switching tabs, locking the phone — and leaves the
  // page alive long enough for the write to go.
  // oxlint-disable-next-line typescript/consistent-return
  useEffect(() => {
    if (uid === null) return undefined
    const onHide = () => {
      const held = live.current
      if (
        document.visibilityState === 'hidden' &&
        opened.current.moved &&
        held !== null &&
        held !== gate.current.query
      )
        send(uid, held, false)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
}
