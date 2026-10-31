import { useRef, useState } from 'react'

import type { Pattern } from './patterns'
import type { BSource } from './sources'
import type { Facing, useCamera } from './useCamera'
import type { Landing, useSecond } from './useSecond'
import type { ASource, useSourceA } from './useSourceA'

// Putting a picture on source A or B from the mixer's lists. `onMixing` hears
// a picture arrive on B and `onTakeOff` hears B go empty, so the page can move
// the mixer and the look with it.
export function useSourcePicks(opts: {
  cam: ReturnType<typeof useCamera>
  srcA: ReturnType<typeof useSourceA>
  second: ReturnType<typeof useSecond>
  firstB: Pattern | null
  onError: (message: string) => void
  onMixing: () => void
  onTakeOff: () => void
}) {
  const { cam, srcA, second, onError } = opts
  const clipA = useRef<HTMLInputElement>(null)
  const clipB = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<BSource>(opts.firstB ?? 'none')

  const mixing = (from: BSource) => {
    setPicked(from)
    opts.onMixing()
  }
  const takeOff = () => {
    second.eject()
    opts.onTakeOff()
  }
  // A pick that a later one superseded leaves B and the panels to that one.
  const landed = (got: Landing, from: BSource) => {
    if (got === 'shown') mixing(from)
    else if (got === 'failed') takeOff()
  }

  // The camera leaving A takes its copy off B with it.
  const stopCamera = () => {
    cam.stop()
    if (second.holds() === 'same') takeOff()
  }

  // Starting the camera or turning it round by hand is a pick on A, so a clip
  // still loading there lets go of itself when it arrives.
  const startCamera = (want?: Facing) => {
    srcA.cameraPicked()
    cam.start(want)
  }
  const flipCamera = () => {
    srcA.cameraPicked()
    if (second.live) void second.swap()
    else cam.flip()
  }

  const putOnA = (key: Facing | ASource) => {
    onError('')
    if (key === 'clip') clipA.current?.click()
    else if (key === 'user' || key === 'environment') {
      if (srcA.on !== 'camera') startCamera(key)
      else flipCamera()
    } else if (key !== 'camera') {
      srcA.toPattern(key)
      stopCamera()
    }
  }

  // The other camera goes on screen and the one that was there goes on B, live
  // or as a tape. The scene behind the phone and the person holding it share
  // the picture.
  const putCamera = () => {
    second.eject()
    onError('')
    void second.load().then(got => {
      if (got === 'failed') takeOff()
      else if (got !== 'superseded') {
        if (got === 'tape' && cam.canFlip) cam.flip()
        mixing('camera')
      }
    })
  }
  const putTape = () => {
    second.eject()
    onError('')
    void second.record().then(got => landed(got, 'record'))
  }
  // The camera on B as well as A, for the chroma keyer, which leaves the panels
  // where they are.
  const keySame = async () => {
    onError('')
    const got = await second.loadSame()
    if (got === 'shown') setPicked('same')
    return got
  }
  const putSame = () =>
    void keySame().then(got => {
      if (got === 'shown') opts.onMixing()
      else if (got === 'failed') takeOff()
    })
  const putPattern = (p: Pattern) => {
    onError('')
    second.loadPattern(p)
    mixing(p)
  }
  const putOnB = (key: BSource) => {
    if (key === 'none') takeOff()
    else if (key === 'camera') putCamera()
    else if (key === 'same') putSame()
    else if (key === 'record') putTape()
    else if (key === 'clip') clipB.current?.click()
    else putPattern(key)
  }

  const clipOnA = (file: File) =>
    void srcA.toClip(file).then(ok => ok && stopCamera())
  const clipOnB = (file: File) => {
    second.eject()
    onError('')
    void second.loadClip(file).then(got => landed(got, 'clip'))
  }

  return {
    attachA: (el: HTMLInputElement | null) => {
      clipA.current = el
    },
    attachB: (el: HTMLInputElement | null) => {
      clipB.current = el
    },
    onA: srcA.on === 'camera' ? cam.facing : srcA.on,
    onB: second.kind === null ? 'none' : picked,
    startCamera: () => startCamera(),
    flipCamera,
    putOnA,
    putOnB,
    keySame,
    clipOnA,
    clipOnB,
  }
}
