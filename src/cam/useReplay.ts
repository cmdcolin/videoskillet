import { useEffect } from 'react'

// Plays whatever `videos` names again when the page comes back. A phone that
// sends the page to the background can pause a <video>, and it stays paused.
export function useReplayOnReturn(videos: () => readonly HTMLVideoElement[]) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      for (const v of videos()) if (v.paused) v.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  })
}
