import { useEffect, useState } from 'react'

import { TAPE_SECONDS, playTape, recordTape } from './tape'

import type { Camera } from './tape'

interface Loaded {
  url: string
  video: HTMLVideoElement
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

const unload = (tape: Loaded) => {
  tape.video.pause()
  tape.video.removeAttribute('src')
  tape.video.load()
  URL.revokeObjectURL(tape.url)
}

// A tape of the camera, looping on source B once it is recorded. `left` counts
// down the seconds while the deck is recording.
export function useTape(
  eng: {
    camera: () => Camera | null
    showTape: (video: HTMLVideoElement | null) => void
  },
  onError: (message: string) => void,
) {
  const [tape, setTape] = useState<Loaded | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (tape === null) return undefined
    return () => unload(tape)
  }, [tape])

  // True once a tape is on B.
  const record = async (): Promise<boolean> => {
    const cam = eng.camera()
    if (cam === null || left > 0) return false
    setLeft(TAPE_SECONDS)
    let loaded: Loaded | null = null
    try {
      const url = URL.createObjectURL(await recordTape(cam, setLeft))
      loaded = { url, video: await playTape(url) }
    } catch (e) {
      onError(`tape: ${reason(e)}`)
    }
    setLeft(0)
    if (loaded === null) return false
    eng.showTape(loaded.video)
    setTape(loaded)
    return true
  }

  const eject = () => {
    eng.showTape(null)
    setTape(null)
  }

  return { loaded: tape !== null, left, record, eject }
}
