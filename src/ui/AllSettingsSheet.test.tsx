import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { AllSettingsSheet } from './AllSettingsSheet'
import { MIX_STAGE, PHASES, SOURCE_A_STAGE, sliderFor } from './controls'
import { ControlsContext, ControlStoreContext } from './ControlsContext'
import { ModSlotsContext } from './ModSlotsContext'

import type { Controls } from '../core/controls'
import type { ControlsApi } from './ControlsContext'
import type { ModSlotsApi } from './ModSlotsContext'

// The sheet rendered to markup on bare node. A server render refuses a store
// with no server snapshot, so the rows read the store's snapshot directly.
vi.mock('react', async actual => ({
  ...(await actual<typeof import('react')>()),
  useSyncExternalStore: (_: unknown, get: () => unknown) => get(),
}))

// A slider asks a media query which word to use for a press.
vi.stubGlobal('window', {
  matchMedia: () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

// The two APIs a row reads. Every verb is a no-op, every set is empty, and
// nothing is armed or routed.
const stub = <T,>(fields: Partial<T>): T =>
  new Proxy(fields, {
    get: (t, k) => (k in t ? t[k as keyof typeof t] : () => null),
  }) as T

const controlsApi = stub<ControlsApi>({
  favorites: new Set(),
  midiReady: false,
  armed: null,
  resetSeconds: 0,
  driftingGroups: new Set(),
})
const modApi = stub<ModSlotsApi>({ editing: new Set(), bpm: null, master: 1 })

const EVERY_STAGE = new Set(PHASES.map(p => p.name))

function render(
  board: Controls,
  o: { offOnly: boolean; openStages?: ReadonlySet<string> },
): string {
  return renderToStaticMarkup(
    <ControlStoreContext
      value={{ subscribe: () => () => {}, get: () => board }}
    >
      <ControlsContext value={controlsApi}>
        <ModSlotsContext value={modApi}>
          <AllSettingsSheet
            offOnly={o.offOnly}
            onToggleOffOnly={() => {}}
            openStages={o.openStages ?? EVERY_STAGE}
            generators={{ noise: false, synth: false }}
            onOpenStage={() => {}}
            onOpenGroup={() => {}}
            onClose={() => {}}
          />
        </ModSlotsContext>
      </ControlsContext>
    </ControlStoreContext>,
  )
}

// One control off stock, on the Source A stage.
const MOVED = 'invert'
const board = { ...DEFAULT_CONTROLS, [MOVED]: sliderFor(MOVED).max }
const movedGroup = PHASES.find(p => p.name === SOURCE_A_STAGE)!.groups.find(g =>
  g.sliders.some(s => s.key === MOVED),
)!
const otherGroup = PHASES.find(p => p.name === 'Screen')!.groups[0]!

describe('AllSettingsSheet', () => {
  it('lists every stage and group with nothing narrowed', () => {
    const html = render(board, { offOnly: false })
    expect(html).toContain(movedGroup.name)
    expect(html).toContain(otherGroup.name)
    expect(html).toContain('>Receiver<')
  })

  it('narrows to the groups holding a control off stock', () => {
    const html = render(board, { offOnly: true })
    expect(html).toContain(movedGroup.name)
    expect(html).toContain(sliderFor(MOVED).label)
    expect(html).not.toContain(otherGroup.name)
    expect(html).not.toContain('>Receiver<')
  })

  it('says so when "off stock only" has nothing to show', () => {
    const html = render(DEFAULT_CONTROLS, { offOnly: true })
    expect(html).toContain('every control is at its default')
  })

  it('makes a group heading a jump into its stage', () => {
    const html = render(board, { offOnly: true })
    expect(html).toContain(
      `title="open ${movedGroup.name} in the ${SOURCE_A_STAGE} stage"`,
    )
  })

  it('offers no jump into a stage with nothing patched in', () => {
    const shut = new Set([...EVERY_STAGE].filter(s => s !== MIX_STAGE))
    const html = render(DEFAULT_CONTROLS, {
      offOnly: false,
      openStages: shut,
    })
    const mix = PHASES.find(p => p.name === MIX_STAGE)!.groups[0]!
    expect(html).not.toContain(`title="open ${mix.name} in the`)
    expect(html).toContain('nothing patched in')
  })
})
