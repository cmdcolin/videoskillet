import { useEffect, useEffectEvent } from 'react'

// How long a picture back from the background is given to deliver again before
// it is checked.
const REVIVE_MS = 1500

// Plays each of `videos` that a phone paused while the page was in the
// background. A paused <video> stays paused.
export const replay = (videos: readonly HTMLVideoElement[]) => {
  for (const v of videos) if (v.paused) v.play().catch(() => {})
}

// Runs `back` each time the page comes back into view. A check it returns runs
// REVIVE_MS later, if the page is still in view by then.
export function useOnReturn(back: () => (() => void) | undefined) {
  const onBack = useEffectEvent(back)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onVisible = () => {
      clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      const check = onBack()
      if (check === undefined) return
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') check()
      }, REVIVE_MS)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
