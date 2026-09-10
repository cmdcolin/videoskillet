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
export { ACTIVE_HEIGHT, ACTIVE_WIDTH } from '../../src/core/signal/constants'

// The look, in the two spellings a link can carry it. Both are `src/ui/`, which
// is a layer core may not import — but this entry is not core, and these two
// are pure functions over the control table with no React and no browser in
// them. `gpuprof/main.ts` reaches `presets.ts` the same way and for the same
// reason.
export { unpackControls } from '../../src/ui/packed'
export { PRESET_BY_NAME, presetControls } from '../../src/ui/presets'

export type { ControlKey, Controls } from '../../src/core/controls'
