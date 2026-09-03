import { useEffect } from 'react'

import { publicUrl } from '../publicUrl'

// Taking delivery of a file the OS share sheet sent — a clip off the camera
// roll, a photo out of a gallery app.
//
// The worker parked it (public/sw.js) because a page cannot read the POST that
// carries it, and it says so by sending the app back with `?shared`. Both
// halves have to agree on a cache name and a key, and a page and its worker
// share nothing but strings, so these are the strings.
const SHARE_CACHE = 'videoskillet-share'
const SHARE_KEY = 'shared-media'
const PARAM = 'shared'

export function useSharedMedia(
  ready: boolean,
  onFile: (file: File) => void,
  onError: (message: string) => void,
) {
  useEffect(() => {
    if (ready && new URLSearchParams(location.search).has(PARAM)) {
      const at = publicUrl(SHARE_KEY)
      const take = async () => {
        const cache = await caches.open(SHARE_CACHE)
        const parked = await cache.match(at)
        if (parked) {
          await cache.delete(at)
          const named = parked.headers.get('x-share-name')
          const blob = await parked.blob()
          onFile(
            new File(
              [blob],
              named === null ? 'shared' : decodeURIComponent(named),
              { type: blob.type },
            ),
          )
        }
        // The param is spent either way: a reload should land on the board the
        // share opened, not go looking for a file that is no longer parked.
        const address = new URL(location.href)
        address.searchParams.delete(PARAM)
        history.replaceState(null, '', address)
      }
      take().catch((err: unknown) => {
        onError(`shared file: ${String(err)}`)
      })
    }
  }, [ready, onFile, onError])
}
