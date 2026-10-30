import { useEffect, useRef, useState } from 'react'

import { reason } from '../ui/format'
import { dropLoop, playLoop } from './tape'
import { replay, useOnReturn } from './useReplay'

import type { Pattern } from './patterns'

// What is on source A: the camera, a clip of yours, or one of the set's own
// patterns.
export type ASource = 'camera' | 'clip' | Pattern

interface Clip {
  url: string
  video: HTMLVideoElement
}

const release = (c: Clip) => dropLoop(c.video, c.url)

// Source A when it is not the camera. The caller lets the camera go once
// something else is up, and `cameraShown` hears the camera come back on screen
// by any route, a flip or a swap included. The latest pick on A wins, and
// `cameraPicked` hears the camera picked.
export function useSourceA(
  eng: {
    showVideo: (video: HTMLVideoElement, mirror: boolean) => void
    showPattern: (pattern: Pattern) => void
  },
  onError: (message: string) => void,
) {
  const [on, setOn] = useState<ASource>('camera')
  const clip = useRef<Clip | null>(null)
  // Which pick on A is the latest. A clip that finishes loading after a later
  // pick lets go of itself. A camera that comes back on screen by itself, as
  // one does after the file picker, is no pick.
  const turn = useRef(0)

  const drop = () => {
    if (clip.current !== null) release(clip.current)
    clip.current = null
  }

  useEffect(
    () => () => {
      ++turn.current
      if (clip.current !== null) release(clip.current)
    },
    [],
  )

  useOnReturn(() => {
    if (clip.current !== null) replay([clip.current.video])
    return undefined
  })

  const cameraShown = () => {
    drop()
    setOn('camera')
  }

  const cameraPicked = () => {
    ++turn.current
  }

  const toPattern = (pattern: Pattern) => {
    ++turn.current
    eng.showPattern(pattern)
    drop()
    setOn(pattern)
  }

  const toClip = async (file: File) => {
    const mine = ++turn.current
    const url = URL.createObjectURL(file)
    let loaded: Clip | null = null
    try {
      loaded = { url, video: await playLoop(url) }
    } catch (e) {
      URL.revokeObjectURL(url)
      if (mine === turn.current) onError(`clip: ${reason(e)}`)
    }
    const latest = mine === turn.current
    if (loaded !== null) {
      if (latest) {
        eng.showVideo(loaded.video, false)
        drop()
        clip.current = loaded
        setOn('clip')
      } else release(loaded)
    }
    return loaded !== null && latest
  }

  return { on, cameraShown, cameraPicked, toPattern, toClip }
}
