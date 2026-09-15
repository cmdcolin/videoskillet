import { useEffect, useRef } from 'react'

import { putCurrent } from './cloud'

import type { SourceBMode, SourceMode } from '../sources/modes'

// The session a signed-in user has open, mirrored onto their account so the home
// page can offer it back as a resume card. The same packed query the address bar
// carries, written by the same producer — `profileQuery()` in useUrlState.
//
// A null query is a session with nothing in it to resume, and the hook leaves
// the account alone. The app passes null while the engine is absent, when the
// controls it would read are the defaults and not the board, and for a board
// nobody has touched — see `worthResuming`.
//
// The address bar takes a write per settled change and costs nothing;
// a Firestore document takes a network round trip and counts against a quota, so
// this one is gated twice. A change waits `SETTLE_MS` for the board to stop
// moving, and no two writes land closer together than `MIN_GAP_MS` — a sustained
// drag therefore writes once every ten seconds while the address bar writes four
// times a second. A query identical to the one already on the account writes
// nothing at all.
export const SETTLE_MS = 5000
export const MIN_GAP_MS = 10000

// What the account holds and when it was put there.
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

// Whether the session is one the home page should offer back. A bare load
// opens the landing look on bars, and the app button on the home page opens
// exactly that, so a visitor who presses it and leaves has not made a session:
// writing the blank board would put it over the one they last dialled in, which
// is what the resume card then opened on. A control off rest, or a deck on
// something other than bars, is a session.
export const worthResuming = (
  edited: number,
  modeA: SourceMode,
  modeB: SourceBMode,
): boolean => edited > 0 || modeA !== 'bars' || modeB !== 'bars'

export function useCurrentSession(uid: string | null, query: string | null) {
  const gate = useRef<WriteGate>({ query: null, at: 0 })
  // The query as of the last render, for the handler below, which fires long
  // after the effect that installed it.
  const live = useRef(query)

  const send = (id: string, q: string) => {
    const at = Date.now()
    gate.current = { query: q, at }
    putCurrent(id, { query: q, at }).catch((e: unknown) => {
      // Dropped. The account keeps the previous session, the next settled change
      // tries again, and nothing on screen depends on this having landed.
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
    if (uid === null) {
      // Signing out forgets what the last account held, so signing into another
      // one on the same page writes its first session immediately.
      gate.current = { query: null, at: 0 }
      return undefined
    }
    if (query === null) return undefined
    const due = nextWriteAt(gate.current, query, Date.now())
    if (due === null) return undefined
    const id = setTimeout(() => send(uid, query), Math.max(0, due - Date.now()))
    return () => clearTimeout(id)
    // `send` reads only refs and the argument it is given.
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
        held !== null &&
        held !== gate.current.query
      )
        send(uid, held)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
}
