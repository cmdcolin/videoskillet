import { Engine, EngineBuildError } from '../core/gpu/pipeline'
import { trace } from '../core/gpu/trace'
import { reason } from './format'
import { RebuildPolicy } from './rebuildPolicy'

import type { FrozenKind } from '../core/gpu/renderloop'
import type { AudioState } from '../core/signal/audiostate'
import type { Fatal } from './FatalScreen'

// Tries per rebuild, and the wait between them. requestAdapter can fail outright
// in the moments after a driver reset, while the GPU stack is still coming back,
// so a failed create is worth re-asking before calling the session over.
export const CREATE_TRIES = 3
export const CREATE_RETRY_MS = 700

// The two ways the GPU half of a session ends. `lost` is a device that said so:
// a driver reset, sleep/wake, a compositor that took it back. `hung` is a device
// that said nothing and stopped completing submitted work.
//
// - On Linux the common hang is a discrete card that runtime-suspended under a
//   hidden tab. The device is stale, nothing is wedged, and a replacement works.
// - The two look identical at the moment of the fault, so a hang gets a fresh
//   device like a loss does. It becomes fatal only once `RebuildPolicy` has
//   spent its devices on ones that never completed any work: a wedged GPU
//   process.
export type GpuFault = 'lost' | 'hung'

export interface Supervision {
  // Readies an engine before it goes live: the boot's, with `dead` null, and
  // each replacement, with the engine it replaces.
  adopt: (created: Engine, dead: Engine | null) => void
  onRebuilding: (fault: GpuFault | null) => void
  onFrozen: (frozen: FrozenKind | null) => void
  onFatal: (fatal: Fatal) => void
  // Returns true to refuse a new device for a rebuild (`fault`) or the boot
  // (null). `spend` buys it anyway.
  declines?: (fault: GpuFault | null, spend: () => void) => boolean
  create?: (canvas: HTMLCanvasElement, audio?: AudioState) => Promise<Engine>
}

const engineOn = (canvas: HTMLCanvasElement, audio?: AudioState) =>
  Engine.create(canvas, { audio })

// Boots an engine on `canvas` and replaces it in place each time its device is
// lost or hangs. It never destroys a device (docs/adr/0004): `pagehide` lets go
// of it, and the returned teardown hands it on alive to the next engine, which
// is what a remount or a hot update wants. Returns that teardown.
export function superviseEngine(
  canvas: HTMLCanvasElement,
  s: Supervision,
): () => void {
  const create = s.create ?? engineOn
  let live: Engine | null = null
  // Latched by pagehide too, which can land while a create is in flight.
  let disposed = false
  // Separate counts, so a run of losses is not forgiven by a hang that proved
  // a device had worked, and a run of hangs does not inherit a count of losses.
  const losses = new RebuildPolicy()
  const hangs = new RebuildPolicy()
  let busy = false
  // Set once the fatal screen is up. A hung engine left behind it usually loses
  // its device later, and a rebuild there would spend a device on a session the
  // user has been told is over, adopting an audio graph already closed.
  let gaveUp = false
  let retryId: ReturnType<typeof setTimeout> | undefined

  // While a rebuild is pending, `live` is the dead engine, already destroyed
  // with its audio graph kept for the replacement. Nothing owns that graph until
  // a replacement goes live, so ending the session closes it here, or a live
  // microphone outlasts the page that opened it.
  const closePendingAudio = () => {
    if (busy) live?.audioState.close()
  }

  const onPageHide = () => {
    disposed = true
    live?.destroy()
    closePendingAudio()
  }
  window.addEventListener('pagehide', onPageHide)

  const goLive = (created: Engine, dead: Engine | null) => {
    live = created
    // Bound to this engine, so a late `lost` from it cannot tear down the
    // successor that replaced it.
    created.onDeviceLost = m => rebuild(created, 'lost', m)
    created.onHang = () =>
      rebuild(created, 'hung', 'submitted work stopped completing')
    created.onFrozen = s.onFrozen
    s.adopt(created, dead)
    // A stall latched against the old loop never clears itself: the new loop
    // only reports edges.
    s.onFrozen(null)
  }

  const rebuild = (dead: Engine, fault: GpuFault, message: string): void => {
    trace.add(
      fault === 'hung' ? 'deviceHung' : 'deviceLost',
      message.slice(0, 120),
    )
    trace.flush(true)
    if (disposed || gaveUp || busy || live !== dead) return
    const policy = fault === 'hung' ? hangs : losses
    // A device that completed work before it hung was worth replacing, and the
    // gap between two such hangs is time spent in another tab. Only a device
    // that never completed anything counts toward giving up.
    if (fault === 'hung' && dead.gpuConfirmed) policy.reset()
    if (policy.record(performance.now()) === 'give-up') {
      // Nothing will adopt the graph after the fatal screen.
      gaveUp = true
      dead.audioState.close()
      s.onFatal(
        fault === 'hung'
          ? {
              title: 'The GPU stopped responding',
              body: `Submitted work stopped completing, and ${policy.limit} fresh devices never completed any, so the fault is behind them rather than in this session.`,
              kind: 'hung',
            }
          : {
              title: 'WebGPU device lost',
              body: `The GPU device was replaced ${policy.limit} times and kept going away${message === '' ? '' : ` (${message})`}, so the session stopped trying.`,
              kind: 'lost',
            },
      )
      return
    }
    busy = true
    s.onRebuilding(fault)
    console.warn(
      fault === 'hung'
        ? `GPU work stopped completing (${message}); replacing the device (${policy.attempt}/${policy.limit})`
        : `WebGPU device lost (${message || 'no reason given'}); rebuilding on a fresh device (${policy.attempt}/${policy.limit})`,
    )
    // The replacement adopts the audio graph: a <video> binds to one
    // AudioContext for life.
    dead.destroy({ keepAudio: true })
    // `busy` stays set while declined, so nothing tries again behind the screen.
    if (s.declines?.(fault, () => replace(dead, fault, CREATE_TRIES))) {
      s.onRebuilding(null)
      return
    }
    replace(dead, fault, CREATE_TRIES)
  }

  const replace = (dead: Engine, fault: GpuFault, tries: number): void => {
    create(canvas, dead.audioState).then(
      created => {
        busy = false
        s.onRebuilding(null)
        if (disposed) {
          created.destroy()
          return
        }
        goLive(created, dead)
        trace.add(
          'rebuilt',
          `attempt ${fault === 'hung' ? hangs.attempt : losses.attempt}`,
        )
        trace.flush(true)
        console.warn('engine rebuilt on a fresh device')
      },
      (e: unknown) => {
        if (disposed) return
        if (tries > 1) {
          console.warn(
            `rebuild failed (${reason(e)}); retrying in ${CREATE_RETRY_MS}ms`,
          )
          retryId = setTimeout(
            () => replace(dead, fault, tries - 1),
            CREATE_RETRY_MS,
          )
          return
        }
        busy = false
        gaveUp = true
        s.onRebuilding(null)
        dead.audioState.close()
        s.onFatal({
          title:
            fault === 'hung'
              ? 'The GPU stopped responding'
              : 'WebGPU device lost',
          body: `${fault === 'hung' ? 'Submitted work stopped completing' : 'The GPU device went away'} and could not be replaced: ${reason(e)}`,
          kind: fault,
        })
      },
    )
  }

  const boot = () => {
    create(canvas).then(
      created => {
        if (disposed) created.destroy()
        else goLive(created, null)
      },
      (e: unknown) =>
        s.onFatal(
          e instanceof EngineBuildError
            ? {
                title: 'The signal path failed to build',
                body: e.message,
                kind: 'build',
              }
            : {
                title: 'WebGPU unavailable',
                body: reason(e),
                kind: 'unavailable',
              },
        ),
    )
  }

  if (!s.declines?.(null, boot)) boot()

  return () => {
    disposed = true
    clearTimeout(retryId)
    window.removeEventListener('pagehide', onPageHide)
    live?.destroy({ keepDevice: true })
    closePendingAudio()
    live = null
  }
}
