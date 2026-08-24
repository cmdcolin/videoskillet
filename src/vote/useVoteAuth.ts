import { useEffect, useState } from 'react'

import { signIn, signOut, wasSignedIn, watchAuth } from '../ui/cloud'

import type { CloudUser } from '../ui/cloud'

// Reading the sign-in state without making every visitor pay for the Firebase SDK.
// Same trade cloud.ts describes: the ~110kB is fetched on a load that already
// knows this browser has signed in before, or on a press of the button, and a
// session that does neither downloads none of it.
export function useVoteAuth() {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!wasSignedIn()) return undefined
    let live = true
    const stop = watchAuth(u => {
      if (live) setUser(u)
    })
    return () => {
      live = false
      void stop.then(off => off())
    }
  }, [])

  return {
    user,
    busy,
    start: async () => {
      setBusy(true)
      try {
        setUser(await signIn())
      } catch {
        // A dismissed popup is not an error worth a banner — the page keeps
        // working, votes keep queueing, and the button is still there.
      } finally {
        setBusy(false)
      }
    },
    stop: async () => {
      await signOut()
      setUser(null)
    },
  }
}
