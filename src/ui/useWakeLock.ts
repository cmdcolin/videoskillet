import { useEffect } from 'react'

import { trace } from '../core/gpu/trace'

const drop = (sentinel: WakeLockSentinel) => {
  sentinel.release().catch((err: unknown) => {
    trace.add('lifecycle', `wake lock release failed: ${String(err)}`)
  })
}

// A phone dims and locks its screen after half a minute of not being touched,
// and watching the picture is not touching it. Held while the instrument is
// live, dropped the moment it isn't.
//
// The browser releases the lock itself whenever the page hides, and does not
// give it back on the way in, so this listens at both ends: the sentinel's own
// `release` forgets it, and the next visible re-asks. A lock taken once at mount
// would survive exactly one trip to the home screen.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    let held: WakeLockSentinel | null = null
    let stopped = false
    const acquire = () => {
      if (held === null && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(
          sentinel => {
            if (stopped) {
              drop(sentinel)
            } else {
              held = sentinel
              sentinel.addEventListener('release', () => {
                held = null
              })
            }
          },
          (err: unknown) => {
            // Refused, rather than missing: a laptop down to its last few
            // percent of battery declines, and so does a page that was
            // backgrounded between the ask and the answer. Neither is something
            // to say out loud, and both are worth a breadcrumb under a report
            // that the screen slept anyway.
            trace.add('lifecycle', `wake lock refused: ${String(err)}`)
          },
        )
      }
    }
    if (active && 'wakeLock' in navigator) {
      acquire()
      document.addEventListener('visibilitychange', acquire)
    }
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', acquire)
      if (held !== null) {
        drop(held)
        held = null
      }
    }
  }, [active])
}
