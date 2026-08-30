// Preset table as data, for the offline half of curation: what each one moves,
// and how far apart two of them are in control space. The pixel answer is
// `survey presets`; this is the one that does not need a GPU.
import { DEFAULT_CONTROLS } from '../../src/core/controls'

const m = await import(new URL('../../src/ui/presets.ts', import.meta.url).href)
const ui = await import(
  new URL('../../src/ui/controls.ts', import.meta.url).href
)
const span = new Map(
  ui.ALL_SLIDERS.map(s => [s.key, Math.max(s.max - s.min, 1e-9)]),
)
const rows = m.PRESETS.map(p => {
  const full = m.presetControls(p.patch)
  const keys = Object.keys(full).filter(k => full[k] !== DEFAULT_CONTROLS[k])
  return {
    name: p.name,
    display: p.displayName ?? p.name,
    group: p.group,
    n: keys.length,
    keys,
    // Every moved control as a fraction of its own travel, so a hue in degrees
    // and a mix in 0..1 are comparable.
    norm: Object.fromEntries(
      keys.map(k => [k, (full[k] - DEFAULT_CONTROLS[k]) / (span.get(k) ?? 1)]),
    ),
    mod: (p.mod ?? []).map(r => `${r.target}:${r.source}`),
    blurb: p.blurb,
  }
})
console.log(JSON.stringify(rows))
