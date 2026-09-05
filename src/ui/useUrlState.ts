import { useEffect } from 'react'

import { pageSearch } from '../core/gpu/env'
import { reason } from './format'
import {
  queryString,
  writeProfileParams,
  writeSessionParams,
} from './urlParams'

import type { Controls } from '../core/controls'
import type { SessionState } from './urlParams'

// The session, plus the three things that are about *mirroring* one rather than
// about what a session is.
//
// Extending rather than restating: this used to be `SessionState`'s thirteen
// fields written out a second time, which is the same shape as the drift
// urlParams.ts records at the interface itself — the writer and the reader kept
// apart until they disagreed. Adding a field to a link is now one edit there,
// and this hook stops compiling until the caller supplies it.
interface UrlStateArgs extends SessionState {
  // Gated on the engine existing: before it does, `controls` is the default
  // fallback and syncing would wipe the very params the loader is about to read.
  engineReady: boolean
  // Where a morph in flight is heading, or null when none is — the same
  // question `useMix.banked()` asks, and asked here for the same reason.
  //
  // It changes what a *capture* records and deliberately not what the address
  // bar says. The live URL is a mirror of the picture, so following the tween
  // is right there. A capture is a look being banked to come back to — a saved
  // profile, a strip row — and "a tween is a frame, not a look": bank the frame
  // and what comes back is a place on the way to somewhere, which nobody chose
  // and which the board cannot be returned to by any other means.
  getGlideTarget: () => Controls | null
  // Where a refused copy is reported. The clipboard is the one thing in here
  // the page does not control: it can be denied outright.
  onError: (message: string) => void
}

// Where a query string points. Split out from the writers because a saved look
// is stored as the query alone: it outlives the origin it was saved on (a dev
// server this morning, the deployed page tonight), so the link is assembled at
// the moment it is copied rather than baked into the store.
//
// After the `#`, and everything the app writes goes there now. Three reasons,
// in the order they matter here:
//
// A look is a client-side fact. The hash never reaches the server, so a session
// is not in anyone's request logs or `Referer` headers, and a page on a static
// host has nothing to gain from sending it. It also stops each look being its
// own cache key — under `?p=` every shared link was a fresh URL for the HTTP
// cache and the service worker to miss on, for the same bytes.
//
// The cost is the one thing to remember about it: changing a hash on a page that
// is already open does *not* reload it, where changing a query does. Anything
// arriving on a new link mid-session — a paste, back/forward, something driving
// the app — needs the reload to be arranged, and `useUrlState` arranges it
// below.
const linkFor = (query: string) =>
  `${location.origin}${location.pathname}${query ? `#${query}` : ''}`

// The same link with the opening burst switched on or off (snow.ts): seconds to
// arm it, null to strip it.
//
// It edits a finished link rather than going back through `writeSessionParams`,
// because the burst is not part of the session — the writer has nothing to ask
// about it, and every link the app builds is already assembled by the time the
// share dialog offers the choice. Which makes this the one place that has to
// know the params live after the `#`, alongside `linkFor` that put them there.
export const withSnow = (url: string, seconds: number | null): string => {
  const cut = url.indexOf('#')
  const base = cut === -1 ? url : url.slice(0, cut)
  const q = new URLSearchParams(cut === -1 ? '' : url.slice(cut + 1))
  if (seconds === null) q.delete('snow')
  else q.set('snow', String(seconds))
  const query = queryString(q)
  return `${base}${query ? `#${query}` : ''}`
}

export const hasSnow = (url: string): boolean => {
  const cut = url.indexOf('#')
  return cut !== -1 && new URLSearchParams(url.slice(cut + 1)).has('snow')
}

// Mirrors the live look into the query string so a reload or shared link
// restores it, and hands back a copy-to-clipboard action — plus the two halves
// the saved-look library needs: the query string for the look on screen, and the
// link for a query string it kept.
export function useUrlState(args: UrlStateArgs) {
  // The session is the rest: whatever is left once the three above are taken
  // off. Nothing here lists its fields, which is the point — the list lives at
  // `SessionState` and this hook reads it by subtraction.
  const { engineReady, getGlideTarget, onError, ...session } = args
  // The whole query-string rule lives in urlParams beside the parser that has
  // to read it back; what is left here is the browser half — which params are
  // already on the address bar, and where the link points.
  //
  // Named, so the bar reads back. `pageSearch()` rather than `location.search`
  // is what carries a session across the move: the first write of a session that
  // arrived on a query takes everything it found there into the hash, and every
  // write after that reads its own.
  const stateUrl = linkFor(
    queryString(
      writeSessionParams(new URLSearchParams(pageSearch()), session, 'named'),
    ),
  )
  // The same look packed, for the share dialog. Built here beside the other so
  // the two cannot describe different boards.
  const shareUrl = linkFor(
    queryString(
      writeSessionParams(new URLSearchParams(pageSearch()), session, 'packed'),
    ),
  )

  // Keep the address bar current on every change (replaceState, so it doesn't
  // flood history). Trailing-debounced: a slider drag emits a move per frame,
  // and the browser rate-limits the history API — so coalesce to one write once
  // the value settles.
  //
  // The dependency is the finished URL rather than a memoized closure over the
  // session's thirteen fields, and that is the better dep as well as the shorter
  // one: a string compares by value, so a render that rebuilds `controls` into
  // an identical board does not restart the debounce. Which also means no
  // hand-written `useCallback` — the React Compiler holds the identity of
  // everything above (see ARCHITECTURE.md › React Compiler is on).
  // An effect's cleanup return is conditional by nature (React's own documented pattern).
  // oxlint-disable-next-line typescript/consistent-return
  useEffect(() => {
    if (engineReady) {
      const id = setTimeout(() => history.replaceState(null, '', stateUrl), 250)
      return () => clearTimeout(id)
    }
  }, [engineReady, stateUrl])

  // A hash arriving from outside: someone pasting a link into the bar of a tab
  // that is already open, back or forward across one, an agent navigating.
  //
  // Under `?` the browser did this for us — a new query is a new document and
  // the loader ran again. A new hash is not, so without this the address bar
  // would say one look and the picture would show another, which is worse than
  // the link not working: it is a link that reports success.
  //
  // A reload rather than applying the session in place, and that is a decision
  // rather than a shortcut. Restoring an arbitrary link is the whole of the
  // mount path — sources, cues, the teletype card, the bay, the stash — and a
  // second copy of it that runs against a live engine is a copy to keep in step.
  // Reloading is what the query did, exactly, and under adr/0004 a reload in one
  // tab is cheap again. `replaceState` does not fire this, so the app's own
  // writes never land here.
  useEffect(() => {
    const onHash = () => {
      location.reload()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Whether the text actually reached the clipboard. `writeText` rejects for
  // reasons that have nothing to do with the link and everything to do with
  // where the page is running: an insecure origin (plain http on a LAN, which is
  // exactly how this gets shown on a projector), a denied permission, a browser
  // that wanted a fresher user gesture than the one that arrived here. Swallowed
  // — which it was — the saved-look row still ticked, and the palette's copy was
  // silent whether it worked or not, so the failure looked identical to success
  // right up until the paste.
  // Written with await rather than a rejection handler because the failure
  // arrives in two shapes: on an insecure origin the clipboard API is not
  // refusing but *absent*, so reading `.writeText` off it throws synchronously
  // where a permission denial rejects. Inside an async function both are the
  // same catch.
  const writeClip = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      onError(`could not copy to the clipboard: ${reason(e)}`)
      return false
    }
  }

  // Handed out whole, because the share dialog holds two links and copies
  // whichever row was pressed. Every other caller in here is a link this hook
  // built itself.
  const copyUrl = (url: string) => writeClip(url)

  // What a saved look records — the same serialization, minus the params that
  // only make sense for the session that is running (see writeProfileParams).
  const profileQuery = () =>
    queryString(
      writeProfileParams({
        ...session,
        // The destination when a morph is running, per `getGlideTarget` above.
        controls: getGlideTarget() ?? session.controls,
      }),
    )

  const copyQuery = (query: string) => writeClip(linkFor(query))

  return { copyQuery, copyUrl, profileQuery, shareUrl, stateUrl }
}
