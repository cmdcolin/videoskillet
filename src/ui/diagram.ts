import { useState } from 'react'

import { atRest } from '../core/controls'
import { NEEDS, sliderFor } from './controls'
import { useControlReading } from './ControlsContext'
import { readingOf } from './format'

import type { ControlKey, Controls } from '../core/controls'

// CROSS_REPO_SYNC(diagram-boxes)
export const LINE_H = 13
const PAD = 7

export interface BoxSpec {
  x: number
  y: number
  w: number
  /** Taller than its text needs, so a row of boxes shares one height. */
  h?: number
  /** A `\n` breaks the name over two lines. */
  name: string
  off?: boolean
  touched: boolean
  help: string
  /** Pressing the box picks it, and the rows under the drawing become its
      `keys`. A box with no keys is drawn and does nothing. */
  id?: string
  keys?: readonly ControlKey[]
  note?: string
}

// Which box the drawing has open. A second press on it puts the rows away.
export function useSelectedBox(initial: string | null = null) {
  const [selected, setSelected] = useState<string | null>(initial)
  return {
    selected,
    toggle: (id: string) => setSelected(now => (now === id ? null : id)),
  }
}

export const CHAR_W = 5.8

export const boxWidth = (name: string) =>
  Math.ceil(
    Math.max(...name.split('\n').map(line => line.length * CHAR_W)) + 2 * PAD,
  )

export const boxHeight = (name: string) =>
  PAD + LINE_H * name.split('\n').length
// CROSS_REPO_SYNC_END(diagram-boxes)

// The figures a drawing prints, read off the board as one string so the drawing
// redraws only for a write that moved one of them.
export function useReadings<K extends ControlKey>(keys: readonly K[]) {
  const joined = useControlReading(c => keys.map(k => c[k]).join('|'))
  const values = joined.split('|').map(Number)
  const value = (key: K) => values[keys.indexOf(key)]!
  return {
    value,
    read: (key: K) => {
      const s = sliderFor(key)
      return readingOf(value(key), s.step, s.unit, s.choices)
    },
    touched: (...ks: K[]) => ks.some(k => !atRest(value(k), k)),
  }
}

// The row whose need is the outermost shut gate on a key's chain of needs, or
// undefined when every gate up the chain is open. Opening a nearer gate leaves
// the key inert, so BoxRows names the outermost one.
export function shutBy(key: ControlKey, c: Controls): ControlKey | undefined {
  let owner: ControlKey | undefined
  for (let k = key, need = NEEDS[k]; need; k = need.key, need = NEEDS[k])
    if (!need.ok(c[need.key])) owner = k
  return owner
}

// An open box's rows, each either '' to draw it or the key `shutBy` names. A
// row moved off its default always draws, so no setting goes out of sight.
export const boxFold = (keys: readonly ControlKey[], c: Controls) =>
  keys.map(k => (atRest(c[k], k) ? (shutBy(k, c) ?? '') : '')).join(',')
