import { useSyncExternalStore } from 'react'

import { Listeners } from '../core/listeners'
import { storedFlag, writeString } from './storage'

const STORE = 'videoskillet_signal_diagrams'
const listeners = new Listeners()
let on = storedFlag(STORE, false)

export function setSignalDiagrams(next: boolean) {
  on = next
  writeString(STORE, next ? '1' : '0')
  listeners.emit()
}

export const toggleSignalDiagrams = () => setSignalDiagrams(!on)

// Whether each group draws its schematic above its sliders. Off by default, so
// a first look at the panel shows plain sliders. One flag for the whole panel,
// so every group, in the docked panel and the popout alike, flips together.
export const useSignalDiagrams = () =>
  useSyncExternalStore(listeners.subscribe, () => on)
