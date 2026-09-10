// What the offline renderer needs out of the app, bundled so it can be run
// without one.
//
// The point of going through a bundle rather than importing the sources
// directly is that `pipeline.ts` reaches its twenty-odd shaders through Vite's
// `?raw`, which only a Vite build resolves. Bundling is therefore what lets the
// renderer run **the app's own `Engine`** instead of a second transcription of
// the pass graph — and a second copy is the one thing a renderer cannot afford,
// because a look that comes out different here than in the tab is worse than no
// renderer at all. (`scripts/gpuprof/graph.ts` is that second copy, and says so
// in its header; it can live with mirroring because it times passes rather than
// producing files anybody keeps.)
export { Engine } from '../../src/core/gpu/pipeline'
export { DEFAULT_CONTROLS } from '../../src/core/controls'
export {
  ACTIVE_HEIGHT,
  ACTIVE_WIDTH,
  LINES,
} from '../../src/core/signal/constants'

// The sound half. `AudioState` is what the engine analyses through and what the
// buzz tap comes back to; `detect` is the arithmetic that turns a frame of tap
// measurements into audio samples, and it is the app's own — the renderer
// running a second version of it would make a file that does not sound like the
// instrument.
export { AudioState } from '../../src/core/signal/audiostate'
export { dcState, detect } from '../../src/core/signal/buzz'

// The look, in the two spellings a link can carry it. Both are `src/ui/`, which
// is a layer core may not import — but this entry is not core, and these two
// are pure functions over the control table with no React and no browser in
// them. `gpuprof/main.ts` reaches `presets.ts` the same way and for the same
// reason.
export { unpackControls } from '../../src/ui/packed'
export { PRESET_BY_NAME, presetControls } from '../../src/ui/presets'

// The whole of what a link says, parsed by the app's own reader rather than by
// a second one here. `?p=`, `?set=`, `?preset=`, `?mod=`, `?src=`, `?seed=` and
// the caption all come back layered in the order the app layers them, so
// pasting an address bar into `--look` reproduces what that address bar opens
// instead of the half a regex could pick out.
export { parseSessionParams } from '../../src/ui/urlParams'
// A link's `?mod=` is routings; the engine wants slots. This is the same
// conversion `useModSlots` runs every render, master amount and tempo lock
// included.
export { EMPTY_SLOT, toEngineSlots } from '../../src/ui/modSlots'
// The generated sources, as bytes. `pattern.ts` writes each one once and wraps
// it in a canvas for the app; the renderer takes the pixels.
export { smpteBarsPixels, sweepPixels } from '../../src/sources/pattern'

export type { ControlKey, Controls } from '../../src/core/controls'
