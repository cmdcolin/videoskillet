import { useRef, useState } from 'react'

import type { BSource } from './sources'
import type { Pattern } from './useCamEngine'
import type { Facing, useCamera } from './useCamera'
import type { useSecond } from './useSecond'
import type { ASource, useSourceA } from './useSourceA'

// Putting a picture on source A or B from the mixer's lists. `onMixing` hears
// a picture arrive on B and `onTakeOff` hears B go empty, so the page can move
// the mixer and the look with it.
export function useSourcePicks(opts: {
  cam: ReturnType<typeof useCamera>
  srcA: ReturnType<typeof useSourceA>
  second: ReturnType<typeof useSecond>
  onError: (message: string) => void
  onMixing: () => void
  onTakeOff: () => void
}) {
  const { cam, srcA, second, onError } = opts
  const clipA = useRef<HTMLInputElement>(null)
  const clipB = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<BSource>('none')

  const mixing = (from: BSource) => {
    setPicked(from)
    opts.onMixing()
  }
  const takeOff = () => {
    second.eject()
    opts.onTakeOff()
  }

  const putOnA = (key: Facing | ASource) => {
    onError('')
    if (key === 'clip') clipA.current?.click()
    else if (key === 'user' || key === 'environment') {
      if (srcA.on !== 'camera') cam.start(key)
      else if (second.live) void second.swap()
      else cam.flip()
    } else if (key !== 'camera') {
      srcA.toPattern(key)
      cam.stop()
    }
  }

  // The other camera goes on screen and the one that was there goes on B, live
  // or as a tape. The scene behind the phone and the person holding it share
  // the picture.
  const putCamera = () => {
    second.eject()
    onError('')
    void second.load().then(got => {
      if (got === null) {
        takeOff()
        return
      }
      if (got === 'tape' && cam.canFlip) cam.flip()
      mixing('camera')
    })
  }
  const putTape = () => {
    second.eject()
    onError('')
    void second.record().then(ok => (ok ? mixing('record') : takeOff()))
  }
  const putPattern = (p: Pattern) => {
    onError('')
    second.loadPattern(p)
    mixing(p)
  }
  const putOnB = (key: BSource) => {
    if (key === 'none') takeOff()
    else if (key === 'camera') putCamera()
    else if (key === 'record') putTape()
    else if (key === 'clip') clipB.current?.click()
    else putPattern(key)
  }

  const clipOnA = (file: File) =>
    void srcA.toClip(file).then(ok => ok && cam.stop())
  const clipOnB = (file: File) => {
    second.eject()
    onError('')
    void second.loadClip(file).then(ok => (ok ? mixing('clip') : takeOff()))
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
    putOnA,
    putOnB,
    clipOnA,
    clipOnB,
  }
}
