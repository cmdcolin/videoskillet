import { useEffect, useRef, useState } from 'react'

import { reason } from '../ui/format'
import { usePersistedString } from '../ui/storage'
import { dualAfter } from './dual'
import {
  TAPE_SECONDS,
  dropLoop,
  playLoop,
  recordTape,
  relayCamera,
} from './tape'
import { stalled, stopAll } from './useCamera'
import { replay, useOnReturn } from './useReplay'

import type { OtherAnswer } from './dual'
import type { Pattern } from './patterns'
import type { Camera, Layout, Relay } from './tape'
import type { Shown } from './useCamEngine'
import type { Opened } from './useCamera'

// What is on source B: a tape of one camera, the other camera live, the camera
// on A live, a clip from the phone's library, or a pattern the set makes
// itself.
type Second =
  | { kind: 'tape'; url: string; video: HTMLVideoElement }
  | { kind: 'live'; cam: Opened; relay: Relay }
  | { kind: 'same'; relay: Relay }
  | { kind: 'clip'; url: string; video: HTMLVideoElement; relay: Relay }
  | { kind: 'pattern'; pattern: Pattern }

// Whether this phone ran both cameras at once when asked. A phone that cannot
// may take the first camera down to answer, so once it has, it is not asked
// again.
const DUAL_STORE = 'videoskillet_cam_dual'

const unload = (b: Second) => {
  if (b.kind === 'live') {
    b.relay.stop()
    stopAll(b.cam.stream)
    return
  }
  if (b.kind === 'pattern') return
  if (b.kind === 'same') {
    b.relay.stop()
    return
  }
  if (b.kind === 'clip') b.relay.stop()
  dropLoop(b.video, b.url)
}

const videosOf = (b: Second | null): HTMLVideoElement[] => {
  if (b === null || b.kind === 'pattern') return []
  if (b.kind === 'live') return [b.cam.video, b.relay.video]
  if (b.kind === 'clip') return [b.video, b.relay.video]
  if (b.kind === 'same') return [b.relay.video]
  return [b.video]
}

// The second picture on source B. `load` puts the other camera there live where
// the phone runs both cameras at once, and moves the screen to it; elsewhere it
// records a tape of the camera on screen, and the caller flips to the other
// one. `record` tapes the camera on screen and leaves it there, `loadClip` puts
// a video file on B, `loadSame` whichever camera is on A and `loadPattern` one
// of the set's own patterns. `left` counts down a tape's seconds; `opening`
// covers the ask for the second camera.
export function useSecond(
  eng: {
    camera: () => Camera | null
    showSecond: (second: Shown['second']) => void
    layoutNow: () => Layout
  },
  cam: {
    openOther: () => Promise<OtherAnswer<Opened>>
    adopt: (next: Opened) => Opened | null
  },
  onError: (message: string) => void,
  first: Pattern | null,
) {
  const [second, setSecond] = useState<Second | null>(
    first === null ? null : { kind: 'pattern', pattern: first },
  )
  const [left, setLeft] = useState(0)
  const [opening, setOpening] = useState(false)
  const [dual, setDual] = usePersistedString(DUAL_STORE)
  // The same as `second`, for the teardown on the way out. A swap moves a live
  // camera between A and B, so B is unloaded by hand where it changes and
  // never by an effect that cannot tell a moved camera from a dropped one.
  const held = useRef<Second | null>(second)
  const laying = useRef(false)

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
        : next.kind === 'pattern'
          ? next.pattern
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

  // A live camera on B, taken off when the phone ends it, when another app
  // takes it, or when it has not resumed after the page comes back.
  useOnReturn(() => {
    const b = held.current
    replay(videosOf(b))
    if (b?.kind !== 'live') return undefined
    return () => {
      if (held.current === b && stalled(b.cam)) eject()
    }
  })

  const goLive = async (o: Opened) => {
    const relay = await relayCamera(
      { video: o.video, mirror: o.faces === 'user', crop: 1 },
      eng.layoutNow,
    )
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
      const url = URL.createObjectURL(
        await recordTape(c, eng.layoutNow(), setLeft),
      )
      loaded = { kind: 'tape', url, video: await playLoop(url) }
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
      const answer = await cam.openOther()
      setDual(dualAfter(answer.kind, dual))
      const prev = answer.kind === 'ok' ? cam.adopt(answer.other) : null
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
      if (ok) return 'live'
      if (prev !== null) return null
    }
    return (await tape()) ? 'tape' : null
  }

  const loadClip = async (file: File): Promise<boolean> => {
    if (held.current !== null || left > 0 || opening) return false
    const url = URL.createObjectURL(file)
    try {
      const video = await playLoop(url)
      const relay = await relayCamera(
        { video, mirror: false, crop: 1 },
        eng.layoutNow,
      )
      show({ kind: 'clip', url, video, relay })
      return true
    } catch (e) {
      URL.revokeObjectURL(url)
      onError(`clip: ${reason(e)}`)
      return false
    }
  }

  // A tape of the camera on screen, which stays on screen.
  const record = async (): Promise<boolean> => {
    if (held.current !== null || left > 0 || opening) return false
    return tape()
  }

  // A second press while the relay is still being laid is turned away, and a
  // pick that lands on B in the meantime wins over the relay.
  const loadSame = async (): Promise<boolean> => {
    if (eng.camera() === null || left > 0 || opening || laying.current)
      return false
    eject()
    laying.current = true
    const relay = await relayCamera(eng.camera, eng.layoutNow).catch(
      (e: unknown) => {
        onError(`camera on B: ${reason(e)}`)
        return null
      },
    )
    laying.current = false
    if (relay === null) return false
    if (held.current !== null) {
      relay.stop()
      return false
    }
    show({ kind: 'same', relay })
    return true
  }

  const loadPattern = (pattern: Pattern) => {
    eject()
    show({ kind: 'pattern', pattern })
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
    kind: second?.kind ?? null,
    pattern: second?.kind === 'pattern' ? second.pattern : null,
    loaded: second !== null,
    live: second?.kind === 'live',
    left,
    opening,
    load,
    loadClip,
    loadSame,
    loadPattern,
    record,
    eject,
    swap,
  }
}
