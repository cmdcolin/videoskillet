import { useEffect, useEffectEvent } from 'react'

import { debugLog } from '../core/gpu/env'
import { SOUND_BOOP_HIT, SOUND_REST_MS, joltOf } from './costume'

import type { Accel } from './costume'

export type BoopSource = 'tap' | 'motion' | 'key' | 'sound'

const SOUND_POLL_MS = 50

const accelOf = (e: DeviceMotionEvent): Accel | null => {
  const a = e.accelerationIncludingGravity
  return a === null ? null : { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 }
}

// A knock on the phone while `motion` is on, a loud onset while `sound` is
// on, and any key, which is what a Bluetooth camera remote sends.
export function useBoops(opts: {
  motion: boolean
  threshold: number
  sound: boolean
  hit: () => number
  onBoop: (source: BoopSource) => void
}) {
  const boop = useEffectEvent(opts.onBoop)
  const hitNow = useEffectEvent(opts.hit)
  const { motion, threshold, sound } = opts

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
