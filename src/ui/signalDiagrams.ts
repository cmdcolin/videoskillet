import { useSyncExternalStore } from 'react'

import { storedFlag, writeString } from './storage'

const STORE = 'videoskillet_signal_diagrams'
const listeners = new Set<() => void>()
let on = storedFlag(STORE, true)

export function setSignalDiagrams(next: boolean) {
  on = next
  writeString(STORE, next ? '1' : '0')
  listeners.forEach(notify => {
    notify()
  })
}

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

// Whether each group draws its schematic above its sliders. One flag for the
// whole panel, so every group, in the docked panel and the popout alike, flips
// together.
export const useSignalDiagrams = () => useSyncExternalStore(subscribe, () => on)
