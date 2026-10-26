import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { App } from '../app'
import { DEFAULT_CONTROLS } from '../core/controls'
import { Listeners } from '../core/listeners'
import { AllSettingsSheet } from './AllSettingsSheet'
import { ControlGroup, ControlRows, ControlSlider } from './ControlGroup'
import { GROUPS, MIXER_LOOP_GROUP } from './controls'
import { setSignalDiagrams } from './signalDiagrams'

import type { ControlKey, Controls } from '../core/controls'
import type { SliderDef } from './controls'

// A slider write re-renders the one control row it moves. Every other row
// skips the write only while each verb on ControlsApi and ModSlotsApi keeps its
// identity across it. Commit a7f26018 fixed three closures that changed
// identity on every write, so that every mounted row re-rendered, while every
// other check passed. This test mounts the real App, with every hook and
// provider it uses, on a fake GPU engine, and counts what React commits.

interface Fiber {
  type: unknown
  flags: number
  stateNode: unknown
  child: Fiber | null
  sibling: Fiber | null
  return: Fiber | null
  alternate: Fiber | null
  memoizedProps: unknown
}

interface Commit {
  rendered: Fiber[]
  unmounted: Fiber[]
}

// vi.hoisted installs React's DevTools hook before react-dom loads, so the
// renderer reports every commit to it. A component rendered in a commit when
// its fiber has the PerformedWork flag and is not the object that was in the
// tree at the last commit. React leaves a fiber it skipped in place with its
// old flags, and renders a component into the fiber's alternate.
const hook = vi.hoisted(() => {
  const state = {
    commits: [] as Commit[],
    root: null as Fiber | null,
  }
  let unmounted: Fiber[] = []
  let before = new WeakSet<Fiber>()
  const PERFORMED_WORK = 1
  Reflect.set(globalThis, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onPostCommitFiberRoot: () => {},
    onCommitFiberUnmount: (_id: number, fiber: Fiber) => {
      unmounted.push(fiber)
    },
    onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
      const now = new WeakSet<Fiber>()
      const rendered: Fiber[] = []
      const walk = (first: Fiber | null) => {
        for (let f = first; f !== null; f = f.sibling) {
          now.add(f)
          if (
            typeof f.type === 'function' &&
            !before.has(f) &&
            (f.flags & PERFORMED_WORK) !== 0
          ) {
            rendered.push(f)
          }
          walk(f.child)
        }
      }
      walk(root.current)
      before = now
      state.root = root.current
      state.commits.push({ rendered, unmounted })
      unmounted = []
    },
  })
  return state
})

// Every engine member the fake does not model is a function that returns
// undefined, and so is each property of one.
const deep = (): unknown =>
  new Proxy(() => undefined, {
    get: (_t, k) => (k === 'then' ? undefined : deep()),
  })

// The fake models the engine's control store, which is all the panel reads.
// It notifies on every write, where the real engine folds a burst into a
// leading and a trailing notify, so a burst here re-renders once per write.
class FakeEngine {
  private readonly controls: Controls = { ...DEFAULT_CONTROLS }
  private snapshot: Controls = { ...DEFAULT_CONTROLS }
  private readonly live = new Listeners()
  private readonly settled = new Listeners()
  private readonly idle = new Listeners()
  readonly sourceBOn = false
  readonly soundOutOn = false
  readonly subscribeControls = this.live.subscribe
  readonly getControls = () => this.snapshot
  readonly subscribeSettledControls = this.settled.subscribe
  readonly getSettledControls = () => this.snapshot
  readonly subscribeGlide = this.idle.subscribe
  readonly getGlide = () => null
  readonly subscribeStats = this.idle.subscribe
  readonly getStats = () => ({ fps: 0 })
  readonly getDbgView = () => 0
  readonly getCaption = () => ''
  readonly glideTarget = () => null
  readonly frameNo = () => 0
  setControl(key: ControlKey, value: number) {
    this.controls[key] = value
    this.emit()
  }
  applyControls(patch: Partial<Controls>) {
    Object.assign(this.controls, patch)
    this.emit()
  }
  private emit() {
    this.snapshot = { ...this.controls }
    this.live.emit()
    this.settled.emit()
  }
}

const engines: FakeEngine[] = []

vi.mock('../core/gpu/pipeline', () => ({
  EngineBuildError: class extends Error {},
  Engine: {
    create: () => {
      const engine = new FakeEngine()
      engines.push(engine)
      return Promise.resolve(
        new Proxy(engine, {
          get: (t, k) =>
            k in t
              ? t[k as keyof FakeEngine]
              : k === 'then'
                ? undefined
                : deep(),
        }),
      )
    },
  },
}))

// jsdom has none of these, and the app calls each while it mounts.
vi.stubGlobal('matchMedia', (media: string) => ({
  matches: false,
  media,
  addEventListener: () => {},
  removeEventListener: () => {},
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = () => {}
    unobserve = () => {}
    disconnect = () => {}
  },
)
vi.stubGlobal(
  'OffscreenCanvas',
  class {
    getContext() {
      return deep()
    }
  },
)
vi.stubGlobal(
  'ImageData',
  class {
    constructor(readonly data: Uint8ClampedArray) {}
  },
)

const nameOf = (f: Fiber) =>
  typeof f.type === 'function' ? f.type.name : String(f.type)
const rowKey = (f: Fiber) =>
  (f.memoizedProps as { slider: SliderDef }).slider.key

function* up(f: Fiber | null) {
  for (; f !== null; f = f.return) yield f
}

function* down(f: Fiber): Generator<Fiber> {
  for (let c = f.child; c !== null; c = c.sibling) {
    yield c
    yield* down(c)
  }
}

// `cost` reports the control rows a gesture re-rendered, mounted or unmounted
// anywhere in the app, and how many instances of each other component it
// re-rendered inside `scope`. A component inside a row counts as that row, and
// one inside a drawing named in `drawings` counts as the drawing. React renders
// an instance into one of two fibers that point at each other through
// `alternate`, so an instance rendered twice in a burst counts once.
function cost(
  commits: Commit[],
  scope: unknown,
  drawings: readonly string[] = [],
) {
  const rows = new Set<string>()
  const seen = new WeakSet<Fiber>()
  const others: Record<string, number> = {}
  const mounted: string[] = []
  const unmounted: string[] = []
  for (const { rendered, unmounted: gone } of commits) {
    for (const f of rendered) {
      const chain = [...up(f)]
      const row = chain.find(a => a.type === ControlSlider)
      if (row !== undefined) {
        rows.add(rowKey(row))
        if (f === row && f.alternate === null) mounted.push(rowKey(f))
      } else if (chain.some(a => a.type === scope)) {
        const drawing = chain.find(a => drawings.includes(nameOf(a))) ?? f
        if (
          !seen.has(drawing) &&
          (drawing.alternate === null || !seen.has(drawing.alternate))
        ) {
          seen.add(drawing)
          const name = nameOf(drawing)
          others[name] = (others[name] ?? 0) + 1
        }
      }
    }
    for (const f of gone) {
      if (f.type === ControlSlider) unmounted.push(rowKey(f))
    }
  }
  return {
    rows: brief([...rows].toSorted()),
    others,
    mounted,
    unmounted,
  }
}

// A long list shortens to its first eight keys and a count of the rest, so a
// failure prints a short diff.
const brief = (keys: string[]) =>
  keys.length <= 8 ? keys : [...keys.slice(0, 8), `and ${keys.length - 8} more`]

async function gesture(run: () => void): Promise<Commit[]> {
  hook.commits.length = 0
  await act(async () => {
    run()
  })
  return [...hook.commits]
}

const settle = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0))
  })

function rowInput(key: ControlKey, scope: unknown): HTMLInputElement {
  const row = [...down(hook.root!)].find(
    f =>
      f.type === ControlSlider &&
      rowKey(f) === key &&
      [...up(f)].some(a => a.type === scope),
  )
  if (row === undefined) throw new Error(`no row for ${key} is mounted`)
  const input = [...down(row)].find(
    f =>
      f.stateNode instanceof HTMLInputElement && f.stateNode.type === 'range',
  )
  if (input === undefined) throw new Error(`the ${key} row has no track`)
  return input.stateNode as HTMLInputElement
}

// `drag` presses the track, which banks the board for undo, and then fires one
// change event per stop, each the write a drag makes. A stop is a fraction of
// the track's travel.
async function drag(key: ControlKey, scope: unknown, stops: readonly number[]) {
  const input = rowInput(key, scope)
  const at = (t: number) =>
    String(Number(input.min) + t * (Number(input.max) - Number(input.min)))
  const press = await gesture(() => {
    fireEvent.pointerDown(input)
  })
  const moves = await gesture(() => {
    for (const t of stops) fireEvent.change(input, { target: { value: at(t) } })
  })
  return { press, moves }
}

const rowsUnder = (scope: unknown) =>
  [...down(hook.root!)]
    .filter(
      f => f.type === ControlSlider && [...up(f)].some(a => a.type === scope),
    )
    .map(rowKey)
    .toSorted()

function groupOf(key: ControlKey) {
  const group = GROUPS.find(g => g.sliders.some(s => s.key === key))
  if (group === undefined) throw new Error(`${key} is in no group`)
  return group
}

const engine = () => engines.at(-1)!

// The app writes the look into the address bar and restores it on mount, so
// each mount starts from a bare address.
async function mountApp() {
  history.replaceState(null, '', '/')
  render(<App />)
  await settle()
  if (hook.commits.length === 0) {
    throw new Error(
      'the React DevTools hook saw no commit: react-dom loaded before it was installed, so nothing below measures anything',
    )
  }
  if (engines.length === 0) throw new Error('the app never built an engine')
}

const COMPILED = /const \$ = \(0, ?[\w$]+\.c\)\(\d+\)/

test('the React Compiler has compiled every component under test', () => {
  for (const component of [
    App,
    AllSettingsSheet,
    ControlGroup,
    ControlRows,
    ControlSlider,
  ]) {
    expect(
      String(component),
      `${component.name} is not compiled, so no memoization below is the compiler's`,
    ).toMatch(COMPILED)
  }
})

// Expected `others` when a gesture re-renders nothing outside the rows.
const NOTHING = {}

// What a write that crosses no stock re-renders anywhere in the app, besides
// its row. CurrentSession follows the settled board to keep the account's copy
// of the look current, and renders nothing.
const MID_DRAG = { CurrentSession: 1 }

// What re-renders in the sheet when a write takes a control off stock or puts
// it back. AllSettingsSheet counts the controls off stock in its lead line, and
// PanelSheet frames that line. StageHead and GroupBlock are the headings over
// the dragged row, and each counts the controls under it off stock.
const SHEET_CROSSING = {
  AllSettingsSheet: 1,
  GroupBlock: 1,
  PanelSheet: 1,
  StageHead: 1,
}

// What re-renders in the open stage when a write takes a control off stock.
// ControlGroup counts the controls off stock in the dragged row's group, and
// Section draws that count in the group's header.
const GROUP_CROSSING = { ControlGroup: 1, Section: 1 }

describe('All settings', () => {
  beforeAll(async () => {
    await mountApp()
    await act(async () => {
      fireEvent.click(screen.getByText('all settings', { selector: 'button' }))
    })
    await settle()
  })
  afterAll(cleanup)
  afterEach(() =>
    act(async () => {
      engine().applyControls(DEFAULT_CONTROLS)
    }),
  )

  test('a drag re-renders the row it moves and the counts it changes', async () => {
    const key = 'noiseIre'
    const { press, moves } = await drag(key, AllSettingsSheet, [1])
    expect(cost(press, AllSettingsSheet)).toEqual({
      rows: [],
      others: NOTHING,
      mounted: [],
      unmounted: [],
    })
    expect(cost(moves, AllSettingsSheet)).toEqual({
      rows: [key],
      others: SHEET_CROSSING,
      mounted: [],
      unmounted: [],
    })
  })

  test('a burst of writes to one key re-renders that row alone', async () => {
    const key = 'noiseIre'
    const { moves } = await drag(
      key,
      AllSettingsSheet,
      [0.2, 0.5, 0.9, 0.4, 0.7, 0.1, 1, 0.3],
    )
    expect(moves.length).toBeGreaterThan(1)
    expect(cost(moves, AllSettingsSheet)).toEqual({
      rows: [key],
      others: SHEET_CROSSING,
      mounted: [],
      unmounted: [],
    })
  })

  test('a write that crosses no stock re-renders nothing in the app but its row', async () => {
    const key = 'noiseIre'
    await drag(key, AllSettingsSheet, [1])
    const { moves } = await drag(key, AllSettingsSheet, [0.5, 0.7, 0.3])
    expect(cost(moves, App)).toEqual({
      rows: [key],
      others: MID_DRAG,
      mounted: [],
      unmounted: [],
    })
  })

  test('off stock only keeps every row mounted through a write', async () => {
    const key = 'noiseIre'
    await act(async () =>
      engine().applyControls({ noiseIre: 9, rfAdjacent: 0.5, cfbGain: 1.2 }),
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'off stock only' }))
    })
    await settle()
    expect(rowsUnder(AllSettingsSheet)).toEqual([
      'cfbGain',
      'noiseIre',
      'rfAdjacent',
    ])
    // Stock noise is the left end of the track, so this drags the row back to
    // stock and out again. The sheet keeps the row, since unmounting it would
    // end the drag under the pointer.
    const { moves } = await drag(key, AllSettingsSheet, [0, 0.1])
    expect(cost(moves, AllSettingsSheet)).toEqual({
      rows: [key],
      others: SHEET_CROSSING,
      mounted: [],
      unmounted: [],
    })
  })
})

// The map labels each box with the stage name, which can differ from the
// group's `place`: the mixer loop's group has place `mixer`, and its box is
// labelled "Mixer feedback". A group already open is left open, since a second
// press on its box would fold the stage.
async function openGroup(key: ControlKey, box: string) {
  if (rowsUnder(ControlGroup).includes(key)) return
  const group = groupOf(key)
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${box} —`) }),
    )
  })
  await settle()
  const escaped = group.name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const head = screen.queryByRole('button', {
    name: new RegExp(`^▸ ?${escaped}$`),
    expanded: false,
  })
  if (head !== null) {
    await act(async () => {
      fireEvent.click(head)
    })
  }
  await settle()
}

describe('a stage in the panel', () => {
  beforeAll(async () => {
    setSignalDiagrams(true)
    await mountApp()
  })
  afterAll(cleanup)
  afterEach(() =>
    act(async () => {
      engine().applyControls(DEFAULT_CONTROLS)
    }),
  )

  test('a drag re-renders the row it moves and the counts it changes', async () => {
    const key = 'osdHoldS'
    await openGroup(key, 'Channel')
    const { press, moves } = await drag(key, ControlGroup, [1])
    expect(cost(press, ControlGroup)).toEqual({
      rows: [],
      others: NOTHING,
      mounted: [],
      unmounted: [],
    })
    // The look bar shows a row for every control off stock, so the write that
    // takes this control off stock mounts a second row for it there.
    expect(cost(moves, ControlGroup)).toEqual({
      rows: [key],
      others: GROUP_CROSSING,
      mounted: [key],
      unmounted: [],
    })
  })

  test('a write that crosses no stock re-renders nothing in the app but its row', async () => {
    const key = 'osdHoldS'
    await openGroup(key, 'Channel')
    await drag(key, ControlGroup, [1])
    const { moves } = await drag(key, ControlGroup, [0.5, 0.6, 0.4])
    expect(cost(moves, App)).toEqual({
      rows: [key],
      others: MID_DRAG,
      mounted: [],
      unmounted: [],
    })
  })

  test('a row behind a schematic redraws the schematic and no other row', async () => {
    const key = 'cfbGain'
    expect(groupOf(key).name).toBe(MIXER_LOOP_GROUP)
    await openGroup(key, 'Mixer feedback')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^▸ \d+ sliders$/ }))
    })
    await drag(key, ControlGroup, [1])
    const { moves } = await drag(key, ControlGroup, [0.5])
    // The schematic draws the loop's gain.
    expect(cost(moves, ControlGroup, ['MixerLoopDiagram'])).toEqual({
      rows: [key],
      others: { MixerLoopDiagram: 1 },
      mounted: [],
      unmounted: [],
    })
  })

  test('switching the signal diagrams off leaves the rows and no schematic', async () => {
    const key = 'cfbGain'
    const drawing = () =>
      screen.queryByRole('group', { name: 'mixer feedback loop' })
    expect(drawing()).not.toBe(null)
    await act(async () => {
      setSignalDiagrams(false)
    })
    try {
      expect(drawing()).toBe(null)
      expect(screen.queryByRole('button', { name: /sliders$/ })).toBe(null)
      expect(rowsUnder(ControlGroup)).toContain(key)
    } finally {
      await act(async () => {
        setSignalDiagrams(true)
      })
    }
    expect(drawing()).not.toBe(null)
  })

  test('a group unfolds its own schematic with the rest switched off', async () => {
    const drawing = () =>
      screen.queryByRole('group', { name: 'mixer feedback loop' })
    await act(async () => {
      setSignalDiagrams(false)
    })
    try {
      expect(drawing()).toBe(null)
      const fold = screen.getByRole('button', { name: '▸ diagram' })
      await act(async () => {
        fireEvent.click(fold)
      })
      expect(drawing()).not.toBe(null)
      expect(screen.getAllByRole('button', { name: '▾ diagram' })).toHaveLength(
        1,
      )
    } finally {
      await act(async () => {
        setSignalDiagrams(true)
      })
    }
    expect(drawing()).not.toBe(null)
  })

  test('a schematic reopens on the box it left open', async () => {
    const box = () =>
      screen.queryByRole('button', { name: 'resonance controls' })
    const head = (expanded: boolean) =>
      screen.getByRole('button', {
        name: /Mixer loop \(electrical\)$/,
        expanded,
      })
    await act(async () => {
      fireEvent.click(box()!)
    })
    expect(box()?.getAttribute('aria-pressed')).toBe('true')
    await act(async () => {
      fireEvent.click(head(true))
    })
    expect(box()).toBe(null)
    await act(async () => {
      fireEvent.click(head(false))
    })
    expect(box()?.getAttribute('aria-pressed')).toBe('true')
  })
})
