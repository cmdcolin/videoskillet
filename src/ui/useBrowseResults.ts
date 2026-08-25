import { useEffect, useState } from 'react'

import { browsePool } from '../sources/pools'
import { reason } from './format'

import type { BrowseHit, PoolOrigin } from '../sources/pools'

// The media browser's results, kept in step with which archive is selected and
// what was last asked of it.
//
// This is one of the few genuine Effects in the app, and it is the case the
// React docs single out: the results are not caused by a *particular* click —
// switching tabs re-asks the same phrase of the other archive, and a preset
// button and the search field both land here — they are the answer to "what
// should be on screen for this (origin, query)". That is synchronisation with an
// external system, which is what an Effect is for.
//
// It lives in a hook rather than in the dialog for the reason those same docs
// give: the correctness of a fetching Effect is entirely in its cleanup, and
// that is worth having in one place with a name on it rather than inline among
// the markup. Type "sunset" quickly and five searches go out; without `live`
// they resolve in whatever order the network feels like and the grid ends up
// showing the answer to "suns".

// What the browser is showing, as one value rather than three.
//
// A tuple of {busy, hits, error} can say "loading, with an error, and eleven
// results" — three booleans' worth of states for four that exist — and every
// reader then has to decide which wins. A tagged union cannot: the dialog
// switches on `status` and each branch has exactly the fields it draws.
type Browsing =
  // Nothing asked for yet, which is what the dialog opens on.
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; hits: BrowseHit[] }
  | { status: 'failed'; error: string }

const IDLE: Browsing = { status: 'idle' }
const BUSY: Browsing = { status: 'busy' }

// What a search came back with, stamped with what was asked. Kept together so
// "is this the answer to the question on screen?" is a comparison rather than a
// second piece of state to keep in step: anything else is still in flight, which
// is the whole of `busy`.
interface Answered {
  origin: PoolOrigin
  query: string
  result: Browsing
}

export function useBrowseResults(origin: PoolOrigin, query: string): Browsing {
  const [answered, setAnswered] = useState<Answered>()

  useEffect(() => {
    // Set false on the way out and checked before every write: a reply that
    // arrives after the query moved on updates nothing.
    let live = true
    if (query !== '') {
      browsePool(origin, query).then(
        hits => {
          if (live) {
            setAnswered({ origin, query, result: { status: 'done', hits } })
          }
        },
        (e: unknown) => {
          if (live) {
            setAnswered({
              origin,
              query,
              result: { status: 'failed', error: reason(e) },
            })
          }
        },
      )
    }
    return () => {
      live = false
    }
  }, [origin, query])

  return query === ''
    ? IDLE
    : answered !== undefined &&
        answered.origin === origin &&
        answered.query === query
      ? answered.result
      : BUSY
}
