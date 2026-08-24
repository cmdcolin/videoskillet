import { useEffect, useState } from 'react'

import { Engine } from '../core/gpu/pipeline'
import { AudioState } from '../core/signal/audiostate'

import type { EngineApi } from '../core/gpu/engineapi'
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
// Which means none of this touches the budget that docs/adr/0004 is about — there
// is no second device to account for.
//
// That reuse is why the two creates are **sequential and not concurrent**. Run in
// parallel, both would race past the "is there a live device stashed?" check
// before either had stashed one, and the page would quietly cost two devices
// instead of one.
//
// Everything else follows useEngine's one rule: nothing here ever destroys a
// device. No pagehide handler, no cleanup that releases. See adr/0004 for what
// the tidier-looking line costs a tab.

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

// Engines in the order of their canvases, as a tuple the caller's ref tuple
// already spells: two refs in, `[EngineApi, EngineApi]` out.
export type EnginesFor<R extends readonly unknown[]> = {
  readonly [K in keyof R]: EngineApi
}

export function useVoteEngines<
  const R extends readonly RefObject<HTMLCanvasElement | null>[],
>(refs: R) {
  const [engines, setEngines] = useState<EnginesFor<R> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const canvases = refs.map(ref => ref.current)
    if (canvases.some(c => c === null)) return undefined
    for (const canvas of canvases) {
      if (canvas === null) continue
      canvas.width = VOTE_CANVAS.width
      canvas.height = VOTE_CANVAS.height
    }
    let live = true
    // One AudioState for all. Nothing on this page listens to anything, and the
    // constructor builds no AudioContext until something asks it to — but each
    // engine defaults to one of its own, and sharing says out loud that there is
    // only ever one audio graph in this document.
    const audio = new AudioState()
    const boot = async () => {
      const made: Engine[] = []
      for (const canvas of canvases) {
        if (canvas === null) continue
        // Sequential on purpose — see the header. By the second create the
        // device the first made is in the stash, so it adopts it rather than
        // asking the tab for another.
        made.push(await Engine.create(canvas, { audio }))
      }
      if (live) {
        // One engine per ref, in ref order, is exactly what the mapped tuple
        // says; the assertion is the only place that fact crosses into the type.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        setEngines(made as unknown as EnginesFor<R>)
        // The first engine, so the console and the screenshot harnesses have the
        // same handle they have on the app. Only one can hold the global; the
        // rest are reachable through the page's own state.
        window.vf = made[0]
      }
      // Deliberately no destroy() when `live` is false. A page that unmounted
      // mid-boot lets go of its engines instead.
    }
    boot().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e))
    })
    return () => {
      live = false
    }
    // The refs are a literal tuple the page never rebuilds.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { engines, error }
}
