import { useEffect, useEffectEvent } from 'react'

import { debugLog } from '../core/gpu/env'
import { SOUND_BOOP_HIT, SOUND_REST_MS, autoGapMs, joltOf } from './costume'

import type { Accel } from './costume'

export type BoopSource = 'tap' | 'motion' | 'key' | 'sound' | 'voice' | 'auto'

const SOUND_POLL_MS = 50
const AUTO_POLL_MS = 1000

const accelOf = (e: DeviceMotionEvent): Accel | null => {
  const a = e.accelerationIncludingGravity
  return a === null ? null : { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 }
}

// A knock on the phone while `motion` is on, a loud onset while `sound` is
// on, any key, which is what a Bluetooth camera remote sends, and a boop by
// itself once `idle` has run past a random wait under `autoS` seconds.
export function useBoops(opts: {
  motion: boolean
  threshold: number
  sound: boolean
  hit: () => number
  autoS: number
  idle: () => number
  onBoop: (source: BoopSource) => void
}) {
  const boop = useEffectEvent(opts.onBoop)
  const hitNow = useEffectEvent(opts.hit)
  const idleNow = useEffectEvent(opts.idle)
  const { motion, threshold, sound, autoS } = opts

  useEffect(() => {
    if (autoS > 0) {
      let gap = autoGapMs(autoS)
      const id = window.setInterval(() => {
        if (idleNow() >= gap) {
          debugLog(`boop auto after ${Math.round(gap / 1000)}s`)
          gap = autoGapMs(autoS)
          boop('auto')
        }
      }, AUTO_POLL_MS)
      return () => window.clearInterval(id)
    }
    return undefined
  }, [autoS])

  useEffect(() => {
    if (sound) {
      let last = -Infinity
      const id = window.setInterval(() => {
        const hit = hitNow()
        const now = performance.now()
        if (hit >= SOUND_BOOP_HIT && now - last >= SOUND_REST_MS) {
          debugLog(`boop sound: hit ${hit.toFixed(2)}`)
          last = now
          boop('sound')
        }
      }, SOUND_POLL_MS)
      return () => window.clearInterval(id)
    }
    return undefined
  }, [sound])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) {
        debugLog(`boop key: ${e.key}`)
        boop('key')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (motion) {
      let last: Accel | null = null
      const onMotion = (e: DeviceMotionEvent) => {
        const now = accelOf(e)
        if (now !== null && last !== null) {
          const jolt = joltOf(last, now)
          if (jolt > threshold / 2) debugLog(`jolt ${jolt.toFixed(1)}`)
          if (jolt > threshold) boop('motion')
        }
        last = now
      }
      window.addEventListener('devicemotion', onMotion)
      return () => window.removeEventListener('devicemotion', onMotion)
    }
    return undefined
  }, [motion, threshold])
}
