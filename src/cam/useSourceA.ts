import { useEffect, useRef, useState } from 'react'

import { playLoop } from './tape'

import type { Pattern } from './useCamEngine'

// What is on source A: the camera, a clip of yours, or one of the set's own
// patterns.
export type ASource = 'camera' | 'clip' | Pattern

interface Clip {
  url: string
  video: HTMLVideoElement
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

const release = (c: Clip) => {
  c.video.pause()
  c.video.removeAttribute('src')
  c.video.load()
  URL.revokeObjectURL(c.url)
}

// Source A when it is not the camera. The caller lets the camera go once
// something else is up, and `cameraShown` hears the camera come back on screen
// by any route, a flip or a swap included.
export function useSourceA(
  eng: {
    showVideo: (video: HTMLVideoElement, mirror: boolean) => void
    showPattern: (pattern: Pattern) => void
  },
  onError: (message: string) => void,
) {
  const [on, setOn] = useState<ASource>('camera')
  const clip = useRef<Clip | null>(null)

  const drop = () => {
    if (clip.current !== null) release(clip.current)
    clip.current = null
  }

  useEffect(
    () => () => {
      if (clip.current !== null) release(clip.current)
    },
    [],
  )

  const cameraShown = () => {
    drop()
    setOn('camera')
  }

  const toPattern = (pattern: Pattern) => {
    eng.showPattern(pattern)
    drop()
    setOn(pattern)
  }

  const toClip = async (file: File): Promise<boolean> => {
    const url = URL.createObjectURL(file)
    let video: HTMLVideoElement
    try {
      video = await playLoop(url)
    } catch (e) {
      URL.revokeObjectURL(url)
      onError(`clip: ${reason(e)}`)
      return false
    }
    eng.showVideo(video, false)
    drop()
    clip.current = { url, video }
    setOn('clip')
    return true
  }

  return { on, cameraShown, toPattern, toClip }
}
