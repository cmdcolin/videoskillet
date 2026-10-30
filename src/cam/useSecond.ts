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

// How a pick on B ended. A superseded pick leaves B to the later one.
export type Landing = 'shown' | 'failed' | 'superseded'
type Loaded = 'live' | 'tape' | 'failed' | 'superseded'

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
// of the set's own patterns. The latest pick on B wins. `left` counts down a
// tape's seconds; `opening` covers the ask for the second camera.
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
  // Which pick on B is the latest. Every pick and every change to B moves it
  // on, and a pick that finishes loading after a later one lets go of what it
  // loaded.
  const turn = useRef(0)
  const laying = useRef(false)

  useEffect(
    () => () => {
      ++turn.current
      if (held.current !== null) unload(held.current)
    },
    [],
  )

  const show = (next: Second | null) => {
    ++turn.current
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

  const land = (mine: number, next: Second): Landing => {
    const latest = mine === turn.current
    if (latest) show(next)
    else unload(next)
    return latest ? 'shown' : 'superseded'
  }

  const failed = (mine: number, message: string): Exclude<Landing, 'shown'> => {
    const latest = mine === turn.current
    if (latest) onError(message)
    return latest ? 'failed' : 'superseded'
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

  const goLive = async (o: Opened): Promise<Second> => {
    const relay = await relayCamera(
      { video: o.video, mirror: o.faces === 'user', crop: 1 },
      eng.layoutNow,
    )
    o.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      const b = held.current
      if (b !== null && b.kind === 'live' && b.cam === o) eject()
    })
    return { kind: 'live', cam: o, relay }
  }

  const tape = async (mine: number): Promise<Landing> => {
    const c = eng.camera()
    if (mine !== turn.current) return 'superseded'
    if (c === null) return 'failed'
    setLeft(TAPE_SECONDS)
    let landing: Landing
    try {
      const url = URL.createObjectURL(
        await recordTape(c, eng.layoutNow(), setLeft),
      )
      landing = land(mine, { kind: 'tape', url, video: await playLoop(url) })
    } catch (e) {
      landing = failed(mine, `tape: ${reason(e)}`)
    }
    setLeft(0)
    return landing
  }

  // The other camera goes on A and the one that was there on B, live.
  const putLive = async (mine: number, other: Opened): Promise<Loaded> => {
    if (mine !== turn.current) {
      stopAll(other.stream)
      return 'superseded'
    }
    const prev = cam.adopt(other)
    if (prev === null) return 'failed'
    let landing: Landing
    try {
      landing = land(mine, await goLive(prev))
    } catch (e) {
      stopAll(prev.stream)
      landing = failed(mine, `second camera: ${reason(e)}`)
    }
    return landing === 'shown' ? 'live' : landing
  }

  const load = async (): Promise<Loaded> => {
    if (held.current !== null || left > 0 || opening) return 'failed'
    const mine = ++turn.current
    let live: Loaded | null = null
    if (dual !== 'no') {
      setOpening(true)
      const answer = await cam.openOther()
      setDual(dualAfter(answer.kind, dual))
      live = answer.kind === 'ok' ? await putLive(mine, answer.other) : null
      setOpening(false)
    }
    if (live !== null) return live
    const taped = await tape(mine)
    return taped === 'shown' ? 'tape' : taped
  }

  const loadClip = async (file: File): Promise<Landing> => {
    if (held.current !== null || left > 0 || opening) return 'failed'
    const mine = ++turn.current
    const url = URL.createObjectURL(file)
    let video: HTMLVideoElement | null = null
    try {
      video = await playLoop(url)
      const relay = await relayCamera(
        { video, mirror: false, crop: 1 },
        eng.layoutNow,
      )
      return land(mine, { kind: 'clip', url, video, relay })
    } catch (e) {
      if (video === null) URL.revokeObjectURL(url)
      else dropLoop(video, url)
      return failed(mine, `clip: ${reason(e)}`)
    }
  }

  // A tape of the camera on screen, which stays on screen.
  const record = async (): Promise<Landing> =>
    held.current !== null || left > 0 || opening
      ? 'failed'
      : tape(++turn.current)

  // A second press while the relay is still being laid is turned away and
  // leaves B to the first.
  const loadSame = async (): Promise<Landing> => {
    if (eng.camera() === null || left > 0 || opening) return 'failed'
    if (laying.current) return 'superseded'
    eject()
    const mine = ++turn.current
    laying.current = true
    let landing: Landing
    try {
      landing = land(mine, {
        kind: 'same',
        relay: await relayCamera(eng.camera, eng.layoutNow),
      })
    } catch (e) {
      landing = failed(mine, `camera on B: ${reason(e)}`)
    }
    laying.current = false
    return landing
  }

  const loadPattern = (pattern: Pattern) => {
    eject()
    show({ kind: 'pattern', pattern })
  }

  // With both cameras live, the flip trades them between A and B. The camera
  // that was on B is on A from the start of the swap, so nothing that changes
  // B in the meantime may stop it.
  const swap = async () => {
    const b = held.current
    if (b === null || b.kind !== 'live') return
    const back = cam.adopt(b.cam)
    b.relay.stop()
    const mine = ++turn.current
    held.current = null
    if (back === null) show(null)
    else {
      try {
        land(mine, await goLive(back))
      } catch (e) {
        if (mine === turn.current) show(null)
        stopAll(back.stream)
        onError(`second camera: ${reason(e)}`)
      }
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
