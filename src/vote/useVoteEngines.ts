import { useEffect, useMemo, useState } from 'react'

import { Engine } from '../core/gpu/pipeline'
import { AudioState } from '../core/signal/audiostate'
import { superviseEngine } from '../ui/engineSupervisor'
import { BOOTING, haltsOf, liveEngines } from './halt'

import type { EngineApi } from '../core/gpu/engineapi'
import type { Side } from './halt'
import type { RefObject } from 'react'

// One engine per canvas — two for the vote page's pair, one for the stream —
// so every candidate on screen is live at once.
//
// Why there are two: with one engine the pair could not be on screen together, so
// each candidate was rendered in turn and captured to a webm the page looped in a
// `<video>`. That cost ~11 s of real time per pair against ~3 s to judge one, and
// prefetching hid none of it. Two engines measured 3.7 s from a vote to the next
// judgeable pair, and made the recorder unnecessary — the canvases *are* the
// previews now, which also took the codec out from between the labeller and the
// pixels and made the two candidates literally simultaneous rather than merely
// equal in frame count.
//
// It fixed the contamination inside a pair for free, too: neither candidate
// develops in the other's leftovers any more. Across pairs it still can, which is
// why prepare.ts flushes both engines to stock signal between them.
//
// **Both engines share one GPUDevice, and that is not an accident.** `initGpu`
// stashes the device it creates on `globalThis` and hands it to the next caller
// that asks, so the second `Engine.create` configures a second canvas against the
// device the first one made: one device, two swapchains, `gpuBuilds()` still 1.
//
// That reuse is why the creates are **sequential and not concurrent**. Run in
// parallel, both would race past the "is there a live device stashed?" check
// before either had stashed one, and the page would quietly cost two devices
// instead of one. `oneAtATime` holds that for the rebuilds too: a lost device
// takes both engines with it, and the second replacement adopts the device the
// first one made.
//
// Each engine runs under `superviseEngine`, as the app's and /cam/'s do, so a
// lost or hung device is replaced in place. The supervisor never destroys a
// device (docs/adr/0004): its pagehide handler and its teardown let go of one.

// Fixed, and not scaled by devicePixelRatio.
//
// The app sizes its backing store to the display, because there the canvas is the
// picture and a blurry one is the bug. Here the canvas produces a *stimulus*, and
// two labellers on two machines have to be judging the same one — a retina display
// recording at 1280x960 and a laptop at 640x480 would be encoding different
// amounts of grain per pixel and voting on it.
//
// 640x480 rather than something smaller: dot crawl, grain and the chroma fringe on
// an edge stop being legible much below this, and a vote cast on a look whose
// texture was scaled away is a vote about its gross shape only.
const VOTE_CANVAS = { width: 640, height: 480 }

declare global {
  interface Window {
    // Every engine on a vote page, in canvas order, for the hot-update dispose
    // in main.tsx and stream.tsx. `vf` is the first of them.
    vfs?: Engine[]
  }
}

// Engines in the order of their canvases, as a tuple the caller's ref tuple
// already spells: two refs in, `[EngineApi, EngineApi]` out.
export type EnginesFor<R extends readonly unknown[]> = {
  readonly [K in keyof R]: EngineApi
}

// Starts each call once the previous one has settled, whether it resolved or
// rejected.
export function oneAtATime<A extends unknown[], T>(
  make: (...args: A) => Promise<T>,
) {
  let last: Promise<unknown> = Promise.resolve()
  return (...args: A) => {
    const next = last.then(() => make(...args))
    last = next.catch(() => undefined)
    return next
  }
}

export function useVoteEngines<
  const R extends readonly RefObject<HTMLCanvasElement | null>[],
>(refs: R) {
  const [sides, setSides] = useState<readonly Side<Engine>[]>(() =>
    refs.map(() => BOOTING),
  )

  useEffect(() => {
    const report = <K extends keyof Side<Engine>>(
      i: number,
      key: K,
      value: Side<Engine>[K],
    ) =>
      setSides(all =>
        all[i]?.[key] === value
          ? all
          : all.map((side, j) => (j === i ? { ...side, [key]: value } : side)),
      )
    // One AudioState for all. Nothing on this page listens to anything, and the
    // constructor builds no AudioContext until something asks it to — but each
    // engine defaults to one of its own, and sharing says out loud that there is
    // only ever one audio graph in this document.
    const audio = new AudioState()
    const create = oneAtATime(
      (canvas: HTMLCanvasElement, adopted: AudioState = audio) =>
        Engine.create(canvas, { audio: adopted }),
    )
    const held: Engine[] = []
    window.vfs = held
    const supervise = (canvas: HTMLCanvasElement, i: number) => {
      canvas.width = VOTE_CANVAS.width
      canvas.height = VOTE_CANVAS.height
      return superviseEngine(canvas, {
        adopt: created => {
          held[i] = created
          // The console and the screenshot harnesses get the same handle they
          // have on the app.
          if (i === 0) window.vf = created
          report(i, 'engine', created)
        },
        onRebuilding: fault => report(i, 'rebuilding', fault),
        onFrozen: frozen => report(i, 'frozen', frozen),
        onFatal: fatal => report(i, 'fatal', fatal),
        create,
      })
    }
    const stops = refs.map((ref, i) =>
      ref.current === null ? () => undefined : supervise(ref.current, i),
    )
    return () => {
      for (const stop of stops) stop()
    }
    // The refs are a literal tuple the page never rebuilds.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new tuple whenever an engine is replaced or comes back from a halt, so
  // whatever is rolled onto it starts again on the picture now showing.
  const engines = useMemo(() => {
    const live = liveEngines(sides)
    // One engine per ref, in ref order, is exactly what the mapped tuple says;
    // the assertion is the only place that fact crosses into the type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return live === null ? null : (live as unknown as EnginesFor<R>)
  }, [sides])

  // The worst of them when more than one side is down: a lost device takes both
  // with it, and one sentence covers the pair.
  const [halt] = haltsOf(sides)
  return { engines, halt }
}
