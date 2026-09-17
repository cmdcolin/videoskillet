import { useSyncExternalStore } from 'react'

// The stacked phone layout in app.module.css, where the picture sits over the
// panel. Keep the query in step with that stylesheet.
const STACKED = '(orientation: portrait) and (max-width: 900px)'

const subscribe = (notify: () => void) => {
  const list = matchMedia(STACKED)
  list.addEventListener('change', notify)
  return () => list.removeEventListener('change', notify)
}

export const useStacked = () =>
  useSyncExternalStore(subscribe, () => matchMedia(STACKED).matches)
