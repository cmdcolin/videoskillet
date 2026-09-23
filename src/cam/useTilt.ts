import { useEffect, useEffectEvent, useState } from 'react'

import { LEVEL, integrate } from './tilt'

import type { Tilt } from './tilt'

// iOS hands out motion only to a page that asked from inside a tap.
interface Asking {
  requestPermission: () => Promise<PermissionState>
}
const asks = (m: unknown): m is Asking =>
  typeof m === 'function' && 'requestPermission' in m

// A desktop browser defines DeviceMotionEvent and never fires one, so only a
// touch screen offers the switch.
const canTilt = () =>
  typeof DeviceMotionEvent !== 'undefined' &&
  matchMedia('(pointer: coarse)').matches

// The phone's gyro, while it is switched on, handed to `onTilt` as a Tilt on
// every motion event, and a level Tilt when it is switched off.
export function useTilt(onTilt: (t: Tilt) => void) {
  const [on, setOn] = useState(false)
  const [supported] = useState(canTilt)
  const report = useEffectEvent(onTilt)

  useEffect(() => {
    if (!on) return undefined
    let t = LEVEL
    let last = -1
    const onMotion = (e: DeviceMotionEvent) => {
      const dt = last < 0 ? 0 : Math.min((e.timeStamp - last) / 1000, 0.1)
      last = e.timeStamp
      const r = e.rotationRate
      if (r === null) return
      t = integrate(
        t,
        { alpha: r.alpha ?? 0, beta: r.beta ?? 0, gamma: r.gamma ?? 0 },
        screen.orientation?.angle ?? 0,
        dt,
      )
      report(t)
    }
    window.addEventListener('devicemotion', onMotion)
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      report(LEVEL)
    }
  }, [on])

  // False when the phone turned the request down.
  const toggle = async (): Promise<boolean> => {
    if (on) {
      setOn(false)
      return true
    }
    if (asks(DeviceMotionEvent)) {
      try {
        if ((await DeviceMotionEvent.requestPermission()) !== 'granted')
          return false
      } catch {
        return false
      }
    }
    setOn(true)
    return true
  }

  return { on, supported, toggle }
}
