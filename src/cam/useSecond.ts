import { useEffect, useRef, useState } from 'react'

import { usePersistedString } from '../ui/storage'
import { TAPE_SECONDS, playTape, recordTape, relayCamera } from './tape'
import { stopAll } from './useCamera'

import type { Camera, Relay } from './tape'
import type { Opened } from './useCamera'

// What is on source B: a tape of one camera, or the other camera live.
type Second =
  | { kind: 'tape'; url: string; video: HTMLVideoElement }
  | { kind: 'live'; cam: Opened; relay: Relay }

// Whether this phone ran both cameras at once when asked. A phone that cannot
// may take the first camera down to answer, so it is asked once.
const DUAL_STORE = 'videoskillet_cam_dual'

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

const unload = (b: Second) => {
  if (b.kind === 'tape') {
    b.video.pause()
    b.video.removeAttribute('src')
    b.video.load()
    URL.revokeObjectURL(b.url)
  } else {
    b.relay.stop()
    stopAll(b.cam.stream)
  }
}

// The second picture on source B. `load` puts the other camera there live where
// the phone runs both cameras at once, and moves the screen to it; elsewhere it
// records a tape of the camera on screen, and the caller flips to the other
// one. `left` counts down a tape's seconds; `opening` covers the ask for the
// second camera.
export function useSecond(
  eng: {
    camera: () => Camera | null
    showSecond: (video: HTMLVideoElement | null) => void
  },
  cam: {
    openOther: () => Promise<Opened | null>
    adopt: (next: Opened) => Opened | null
  },
  onError: (message: string) => void,
) {
  const [second, setSecond] = useState<Second | null>(null)
  const [left, setLeft] = useState(0)
  const [opening, setOpening] = useState(false)
  const [dual, setDual] = usePersistedString(DUAL_STORE)
  // The same as `second`, for the teardown on the way out. A swap moves a live
  // camera between A and B, so B is unloaded by hand where it changes and
  // never by an effect that cannot tell a moved camera from a dropped one.
  const held = useRef<Second | null>(null)

  useEffect(
    () => () => {
      if (held.current !== null) unload(held.current)
    },
    [],
  )

  const show = (next: Second | null) => {
    held.current = next
    setSecond(next)
    eng.showSecond(
      next === null
        ? null
        : next.kind === 'tape'
          ? next.video
          : next.relay.video,
    )
  }

  const eject = () => {
    const b = held.current
    show(null)
    if (b !== null) unload(b)
  }

  // A live camera on B, taken off when the phone ends it: in the background,
  // or when another app takes it.
  const goLive = async (o: Opened) => {
    const relay = await relayCamera({
      video: o.video,
      mirror: o.faces === 'user',
    })
    o.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      const b = held.current
      if (b !== null && b.kind === 'live' && b.cam === o) eject()
    })
    show({ kind: 'live', cam: o, relay })
  }

  const tape = async (): Promise<boolean> => {
    const c = eng.camera()
    if (c === null) return false
    setLeft(TAPE_SECONDS)
    let loaded: Second | null = null
    try {
      const url = URL.createObjectURL(await recordTape(c, setLeft))
      loaded = { kind: 'tape', url, video: await playTape(url) }
    } catch (e) {
      onError(`tape: ${reason(e)}`)
    }
    setLeft(0)
    if (loaded === null) return false
    show(loaded)
    return true
  }

  const load = async (): Promise<'live' | 'tape' | null> => {
    if (held.current !== null || left > 0 || opening) return null
    if (dual !== 'no') {
      setOpening(true)
      const other = await cam.openOther()
      const prev = other === null ? null : cam.adopt(other)
      let ok = false
      if (prev !== null) {
        try {
          await goLive(prev)
          ok = true
        } catch (e) {
          stopAll(prev.stream)
          onError(`second camera: ${reason(e)}`)
        }
      }
      setOpening(false)
      setDual(ok ? 'yes' : 'no')
      if (ok) return 'live'
      if (prev !== null) return null
    }
    return (await tape()) ? 'tape' : null
  }

  // With both cameras live, the flip trades them between A and B.
  const swap = async () => {
    const b = held.current
    if (b === null || b.kind !== 'live') return
    const back = cam.adopt(b.cam)
    b.relay.stop()
    if (back === null) {
      show(null)
      return
    }
    try {
      await goLive(back)
    } catch (e) {
      show(null)
      stopAll(back.stream)
      onError(`second camera: ${reason(e)}`)
    }
  }

  return {
    loaded: second !== null,
    live: second?.kind === 'live',
    left,
    opening,
    load,
    eject,
    swap,
  }
}
