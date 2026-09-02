import { describe, expect, it } from 'vitest'

import { CONTROL_KEYS, DEFAULT_CONTROLS } from '../core/controls'
import { SLIDER_BY_KEY, VIEW_KEYS } from './controls'
import { RATE_MAX, RATE_MIN, modSource } from './modSlots'
import {
  PRESETS,
  blendMod,
  blendPresets,
  controlsEqual,
  matchPreset,
  presetControls,
  randomPresetMix,
  randomSinglePreset,
  rollControls,
} from './presets'

import type { ControlKey, Controls } from '../core/controls'

// `useMix.applyPreset` reads an empty patch as "this click is the reset" and
// wipes the bay and the stab gate on it. A second preset written with an empty
// patch would silently become a second reset button.
describe('the empty patch', () => {
  it('belongs to "clean" and to nothing else', () => {
    const empty = PRESETS.filter(p => Object.keys(p.patch).length === 0)
    expect(empty.map(p => p.name)).toEqual(['clean'])
  })
})

// `matchPreset` no longer compares the board against each preset in full — it
// decides from the keys the board holds off stock, because the full comparison
// was 85 × 252 reads in a render body and cost 612 us against the live board.
// The rewrite is only worth having if it is the same question, so this holds it
// to the definition it replaced rather than to a handful of examples.
describe('matchPreset', () => {
  const byDefinition = (values: Controls) =>
    PRESETS.find(p => controlsEqual(presetControls(p.patch), values))

  const agree = (values: Controls, what: string) =>
    expect(matchPreset(values)?.name ?? null, what).toBe(
      byDefinition(values)?.name ?? null,
    )

  it('agrees on stock, on every preset, and on every preset nudged', () => {
    agree(DEFAULT_CONTROLS, 'stock')
    for (const p of PRESETS) {
      const full = presetControls(p.patch)
      agree(full, p.name)
      // One key off stock that the preset does not move: a superset, which
      // must match nothing. The size check is what has to catch this.
      const spare = CONTROL_KEYS.find(
        k => full[k] === DEFAULT_CONTROLS[k] && typeof full[k] === 'number',
      )
      if (spare !== undefined)
        agree({ ...full, [spare]: full[spare] + 1.5 }, `${p.name} + ${spare}`)
      // One key the preset does move, put back to stock: a subset, which must
      // also match nothing unless another preset happens to be exactly that.
      const moved = CONTROL_KEYS.find(k => full[k] !== DEFAULT_CONTROLS[k])
      if (moved !== undefined)
        agree(
          { ...full, [moved]: DEFAULT_CONTROLS[moved] },
          `${p.name} − ${moved}`,
        )
      // And moved somewhere else entirely: same key set, different value.
      if (moved !== undefined && typeof full[moved] === 'number')
        agree({ ...full, [moved]: full[moved] + 0.5 }, `${p.name} ~ ${moved}`)
    }
  })

  it('agrees on boards rolled out of the presets themselves', () => {
    let seed = 7
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < 200; i++) {
      const a = PRESETS[Math.floor(rand() * PRESETS.length)]
      const b = PRESETS[Math.floor(rand() * PRESETS.length)]
      agree(blendPresets(DEFAULT_CONTROLS, new Map([[a.name, rand()]])), 'one')
      agree(
        blendPresets(
          presetControls(a.patch),
          new Map([[b.name, rand() < 0.5 ? 1 : rand()]]),
        ),
        'two',
      )
    }
  })
})

describe('blendPresets', () => {
  it('at full weight over defaults, reproduces the preset exactly', () => {
    for (const p of PRESETS) {
      const blended = blendPresets(DEFAULT_CONTROLS, new Map([[p.name, 1]]))
      expect(blended, p.name).toEqual(presetControls(p.patch))
      expect(matchPreset(blended)?.name).toBe(p.name)
    }
  })

  it('at zero weight, leaves the baseline untouched', () => {
    const base = presetControls({ noiseIre: 7, cfbMix: 0.4 })
    expect(
      blendPresets(
        base,
        new Map([
          ['vhs', 0],
          ['neonTube', 0],
        ]),
      ),
    ).toEqual(base)
  })

  it('halves a fault at half weight', () => {
    const half = blendPresets(DEFAULT_CONTROLS, new Map([['broadcast', 0.5]]))
    expect(half.ghostGain).toBe(0.05)
    expect(half.noiseIre).toBe(0.6)
  })

  it('accumulates grain across stacked presets instead of clobbering it', () => {
    const worn = presetControls({ noiseIre: 7 })
    expect(blendPresets(worn, new Map([['roundTube', 1]])).noiseIre).toBe(7)
    expect(blendPresets(worn, new Map([['mixerLoop', 1]])).noiseIre).toBe(8.5)
  })

  // Retention does not add: two phosphors in front of each other hold light as
  // long as the slower one. Summed, a lead at 0.9 with a quarter of a follower
  // on top ran off the end of the dial — the top of that track is half a minute
  // of smear over whatever else the roll had just stacked up.
  it('takes the longest hold rather than summing two phosphors', () => {
    const both = blendPresets(
      DEFAULT_CONTROLS,
      new Map([
        ['stuckTape', 1],
        ['roundTube', 0.25],
      ]),
    )
    expect(both.phosphor).toBe(0.9)
    // The rest of what those two bring still stacks, this trim included —
    // 0.15 stock plus a quarter of the follower's 0.05, on a 0.01 grid.
    expect(both.phosphorBleed).toBe(0.16)
  })

  it('lets a follower carry the hold when the lead brought none', () => {
    const mixed = blendPresets(
      DEFAULT_CONTROLS,
      new Map([
        ['broadcast', 1],
        ['greenTerminal', 0.5],
      ]),
    )
    expect(mixed.phosphor).toBeCloseTo(0.495, 4)
  })

  it('keeps a hold the board already had, rather than adding to it', () => {
    const held = presetControls({ phosphor: 0.99 })
    expect(blendPresets(held, new Map([['stuckTape', 1]])).phosphor).toBe(0.99)
  })

  it('never starts a strobe on a board that has none', () => {
    // Every rate a roll can reach cuts the beam for ~95% of each cycle, so a
    // roll that starts one hides everything else it just did behind a
    // full-field flash a few times a second — and random nudge already refuses
    // to. This was the hole: the preset roll could pick the strobed tube as a
    // lead at 3.5 Hz or scale it down to 0.9 as a follower, on 3% of presses.
    for (const w of [1, 0.5, 0.25]) {
      const rolled = rollControls(
        new Map([['strobedTube', w]]),
        DEFAULT_CONTROLS,
      )
      expect(rolled.strobeHz).toBe(0)
      // The rest of that tube is a look, and it still arrives.
      expect(rolled.phosphor).toBeGreaterThan(0)
    }
  })

  // `bendShape` is an enum key, so a preset holding ripple would hand it over at
  // full strength however light the weight that brought the rest of that look
  // in. See ROLL_NEVER_LANDS.
  it('hands back no bend ripple on a board that has none', () => {
    for (const p of PRESETS) {
      for (const w of [1, 0.5, 0.25]) {
        const rolled = rollControls(new Map([[p.name, w]]), DEFAULT_CONTROLS)
        expect(rolled.bendShape, `${p.name} at ${w}`).not.toBe(3)
      }
    }
    // The rest of the yoke is a look, and it still arrives bent.
    const yoke = rollControls(new Map([['pastTheYoke', 1]]), DEFAULT_CONTROLS)
    expect(yoke.bendUs).toBe(70)
    expect(yoke.vSize).toBe(3.4)
  })

  it('keeps the HV tank light on a board that is not already ringing', () => {
    for (const p of PRESETS) {
      for (const w of [1, 0.5, 0.25]) {
        const rolled = rollControls(new Map([[p.name, w]]), DEFAULT_CONTROLS)
        expect(rolled.hvRing, `${p.name} at ${w}`).toBeLessThanOrEqual(0.6)
        expect(
          Math.abs(rolled.hvSagUs),
          `${p.name} at ${w}`,
        ).toBeLessThanOrEqual(12)
      }
    }
  })

  // The cap is a rule about rolls, not about the presets: a chip is a hand
  // choosing the look somebody tuned, and supply chaos is named for the tank.
  it('leaves the chip itself at what it was tuned at', () => {
    const clicked = blendPresets(
      DEFAULT_CONTROLS,
      new Map([['supplyChaos', 1]]),
    )
    expect(clicked.hvRing).toBe(0.85)
    expect(clicked.hvSagUs).toBe(16)
  })

  it('leaves a strobe alone on a board that is already running one', () => {
    const strobing = presetControls({ strobeHz: 2 })
    expect(rollControls(new Map([['strobedTube', 1]]), strobing).strobeHz).toBe(
      3.5,
    )
  })

  it('picks one mode rather than averaging enum controls', () => {
    const mixed = blendPresets(
      DEFAULT_CONTROLS,
      new Map([
        ['roundTube', 0.4],
        ['greenTerminal', 0.6],
      ]),
    )
    expect(mixed.phosphorMode).toBe(3)
    expect(
      blendPresets(
        DEFAULT_CONTROLS,
        new Map([
          ['roundTube', 0.6],
          ['greenTerminal', 0.4],
        ]),
      ).phosphorMode,
    ).toBe(2)
  })

  it('clamps a summed fault to the slider range', () => {
    const piled = blendPresets(
      DEFAULT_CONTROLS,
      new Map([
        ['deadChannel', 1],
        ['wornTape', 1],
        ['mistunedRf', 1],
      ]),
    )
    // Against the schema's own ceiling, not a copy of it — the point is that
    // the sum lands inside the slider, wherever the slider now ends.
    expect(piled.noiseIre).toBeLessThanOrEqual(
      SLIDER_BY_KEY.get('noiseIre')?.max ?? 0,
    )
  })
})

describe('blendMod', () => {
  // Two presets that carry motion, whichever they happen to be — this is about
  // the rule, not about which looks were authored to move.
  const moving = PRESETS.filter(p => p.mod !== undefined)

  it('every authored routing names a real control and a real source', () => {
    expect(moving.length).toBeGreaterThan(0)
    for (const p of moving) {
      for (const m of p.mod ?? []) {
        // A slider, not one of the bay's own knobs: a wire onto another wire
        // names a slot by position, and an authored look has no say in which
        // position a reader's bay puts it in.
        expect(
          SLIDER_BY_KEY.has(m.target as ControlKey),
          `${p.name}: ${m.target}`,
        ).toBe(true)
        expect(modSource(m.source), `${p.name}: ${m.source}`).not.toBe(null)
        expect(m.depth, `${p.name} depth`).toBeGreaterThan(0)
        expect(m.depth, `${p.name} depth`).toBeLessThanOrEqual(1)
        expect(m.rateHz, `${p.name} rate`).toBeGreaterThanOrEqual(RATE_MIN)
        expect(m.rateHz, `${p.name} rate`).toBeLessThanOrEqual(RATE_MAX)
      }
    }
  })

  it('no authored routing drives a filter control', () => {
    // Modulating one of these rebuilds the whole FIR bank every frame. Fine as
    // a deliberate patch, not fine hanging off a chip someone clicked.
    const FILTER_KEYS = [
      'encChromaMHz',
      'demodMHz',
      'chromaTail',
      'lumaMHz',
      'lumaPeak',
    ]
    for (const p of moving) {
      for (const m of p.mod ?? []) {
        expect(FILTER_KEYS, p.name).not.toContain(m.target)
      }
    }
  })

  it('at full weight, reproduces the preset’s own routings', () => {
    for (const p of moving) {
      expect(blendMod(new Map([[p.name, 1]])), p.name).toEqual(p.mod)
    }
  })

  it('scales depth by how much of the preset is in', () => {
    const [p] = moving
    const half = blendMod(new Map([[p.name, 0.5]])) ?? []
    expect(half.map(m => m.depth)).toEqual(
      (p.mod ?? []).map(m => m.depth * 0.5),
    )
  })

  it('lets the heaviest preset that carries motion win outright', () => {
    // Routings are patch cables, not summable scalars: half of one bay plus
    // half of another is a third bay nobody asked for.
    const [a, b] = moving
    const out = blendMod(
      new Map([
        [a.name, 0.4],
        [b.name, 0.9],
      ]),
    )
    expect(out?.map(m => m.target)).toEqual((b.mod ?? []).map(m => m.target))
    expect(out?.map(m => m.depth)).toEqual(
      (b.mod ?? []).map(m => m.depth * 0.9),
    )
  })

  it('says nothing when no preset in the recipe carries motion', () => {
    // Which the caller reads as "leave the bay alone" — a preset with no
    // opinion about motion must not silently unpatch hand-wired routings.
    expect(blendMod(new Map([['broadcast', 1]]))).toBe(null)
    expect(blendMod(new Map())).toBe(null)
  })

  it('ignores a preset that is dialed all the way out', () => {
    const [p] = moving
    expect(blendMod(new Map([[p.name, 0]]))).toBe(null)
  })
})

describe('controlsEqual', () => {
  it('is true only when every control matches', () => {
    const base = presetControls({ noiseIre: 7 })
    expect(controlsEqual(base, presetControls({ noiseIre: 7 }))).toBe(true)
    expect(controlsEqual(base, presetControls({ noiseIre: 7.1 }))).toBe(false)
  })

  // The fills stay honest: once anything moves the look off what the mix
  // produced, controlsEqual goes false and the UI drops the weights to zero.
  it('goes false when a look diverges from its mix', () => {
    const base = presetControls({ ghostGain: 0.2 })
    const weights = new Map([['vhs', 0.5]])
    expect(controlsEqual(base, blendPresets(base, weights))).toBe(false)
    expect(
      controlsEqual(blendPresets(base, weights), blendPresets(base, weights)),
    ).toBe(true)
  })
})

// A cycling generator rather than Math.random, so a failure names a roll
// somebody can reproduce.
const seq = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

const movedBy = (name: string) => {
  const full = blendPresets(DEFAULT_CONTROLS, new Map([[name, 1]]))
  return CONTROL_KEYS.filter(k => full[k] !== DEFAULT_CONTROLS[k])
}

describe('randomPresetMix', () => {
  it('leads with one preset whole and dials the rest partly in', () => {
    for (let s = 0; s < 200; s++) {
      const roll = [...randomPresetMix(true).values()]
      expect(roll[0]).toBe(1)
      for (const w of roll.slice(1)) {
        expect(w).toBeGreaterThanOrEqual(0.25)
        expect(w).toBeLessThan(0.5)
      }
    }
  })

  // The whole point of crossing families: two presets from the same group
  // deepen one fault instead of stacking two.
  it('never draws twice from one group', () => {
    for (let s = 0; s < 200; s++) {
      const groups = [...randomPresetMix(true).keys()].map(
        n => PRESETS.find(p => p.name === n)?.group,
      )
      expect(new Set(groups).size).toBe(groups.length)
    }
  })

  // What keeps a roll off the summing edge of blendPresets: a follower may meet
  // the lead on a control or two, but not argue with it up and down the board.
  it('will not stack a follower that treads on what is already claimed', () => {
    for (let s = 0; s < 300; s++) {
      const names = [...randomPresetMix(true).keys()]
      const claimed = new Set(movedBy(names[0]))
      for (const n of names.slice(1)) {
        const keys = movedBy(n)
        expect(keys.filter(k => claimed.has(k)).length).toBeLessThanOrEqual(2)
        for (const k of keys) claimed.add(k)
      }
    }
  })

  // 'Full board' presets are complete looks. One can lead; layering a second
  // whole board over a look is the mush this roll is supposed to avoid.
  it('keeps whole-board presets out of the follower slots', () => {
    for (let s = 0; s < 300; s++) {
      const groups = [...randomPresetMix(true).keys()]
        .slice(1)
        .map(n => PRESETS.find(p => p.name === n)?.group)
      expect(groups).not.toContain('Full board')
    }
  })

  it('drops the A/B presets when there is no second source', () => {
    for (let s = 0; s < 200; s++) {
      const groups = [...randomPresetMix(false).keys()].map(
        n => PRESETS.find(p => p.name === n)?.group,
      )
      expect(groups).not.toContain('A/B mixing')
    }
  })

  // Threading the generator is what lets a roll be written down and rolled
  // again — the seeded sampler in vote/candidates.ts wants this shape.
  it('is reproducible from its generator', () => {
    const draw = () => randomPresetMix(true, seq([0.11, 0.42, 0.73, 0.28, 0.9]))
    expect([...draw().entries()]).toEqual([...draw().entries()])
  })
})

describe('randomSinglePreset', () => {
  // The whole difference from the mix above, and the only thing this roll
  // promises: one authored look, at the strength it was authored at.
  it('draws exactly one preset, whole', () => {
    for (let s = 0; s < 300; s++) {
      const roll = [...randomSinglePreset(true).entries()]
      expect(roll.length).toBe(1)
      expect(roll[0][1]).toBe(1)
      expect(PRESETS.some(p => p.name === roll[0][0])).toBe(true)
    }
  })

  // 'clean' is the reset. A random button that lands on it now and then is a
  // random button that occasionally wipes your board and calls it a look.
  it('never draws the empty patch, and drops A/B without a second source', () => {
    for (let s = 0; s < 300; s++) {
      const group = (on: boolean) =>
        PRESETS.find(p => p.name === [...randomSinglePreset(on).keys()][0])
          ?.group
      expect(group(true)).not.toBe('Clean')
      expect(group(false)).not.toBe('A/B mixing')
    }
  })

  it('is reproducible from its generator', () => {
    const draw = () => randomSinglePreset(true, seq([0.11, 0.42, 0.73]))
    expect([...draw().entries()]).toEqual([...draw().entries()])
  })

  // The one roll where a repeat is visible: the chip that lights up is the same
  // chip that was already lit, which reads as a button that did not fire.
  it('never draws the preset that is already on the board', () => {
    let held = 'vhs'
    for (let s = 0; s < 400; s++) {
      const drawn = [...randomSinglePreset(true, Math.random, held).keys()][0]
      expect(drawn).not.toBe(held)
      held = drawn
    }
  })

  // Whichever preset is excluded — including one that is the only member of its
  // family, which has to take the family out of the draw rather than leave an
  // empty group for the pick to land in.
  it('still draws a whole look whatever it is told to avoid', () => {
    for (const p of PRESETS) {
      const roll = randomSinglePreset(true, Math.random, p.name)
      expect(roll.size, p.name).toBe(1)
      expect([...roll.values()], p.name).toEqual([1])
    }
  })
})

describe('rollControls', () => {
  // The bug this exists to make impossible: a roll that draws a view preset
  // ('nose against the glass' winds the magnifier to 5) moving your eye. Both
  // roll paths go through here, so one test covers both.
  it('never lets a roll move a view control', () => {
    const framed = { ...DEFAULT_CONTROLS, crtZoom: 3.5, crtZoomX: 0.2 }
    for (let s = 0; s < 300; s++) {
      const out = rollControls(randomPresetMix(true), framed)
      for (const key of VIEW_KEYS) expect(out[key], key).toBe(framed[key])
    }
  })

  // Every preset by name, not just the ones a random roll happened to draw:
  // a view preset added later has to be caught by this on the first run.
  it('holds for every authored preset at full weight', () => {
    const framed = { ...DEFAULT_CONTROLS, crtZoom: 2 }
    for (const p of PRESETS) {
      const out = rollControls(new Map([[p.name, 1]]), framed)
      for (const key of VIEW_KEYS)
        expect(out[key], `${p.name} ${key}`).toBe(framed[key])
    }
  })

  // What the reset lands on, and the reason it goes through here rather than
  // writing DEFAULT_CONTROLS: no recipe at all is stock everywhere but the
  // view, which stays where the viewer aimed it.
  it('is stock under an empty recipe, view apart', () => {
    const framed = { ...DEFAULT_CONTROLS, crtZoom: 2, timeScale: 0.5 }
    expect(rollControls(new Map(), framed)).toEqual(framed)
    expect(rollControls(new Map(), DEFAULT_CONTROLS)).toEqual(DEFAULT_CONTROLS)
  })

  // Everything that is not the view still arrives, or the pin would be a way of
  // quietly dropping half a preset.
  it('leaves everything outside the view to the recipe', () => {
    const weights = new Map([['vhs', 1]])
    const out = rollControls(weights, DEFAULT_CONTROLS)
    expect(out).toEqual(blendPresets(DEFAULT_CONTROLS, weights))
  })
})

// A mixer loop displaces its return inside the line — the delay, the varactor
// and the read clock all do — and the crossfade covers the whole waveform, so
// past a certain mix the sync tip that comes back lands mid-line and the
// separator downstream stops finding a line start. What the picture does then
// is not the loop: the flywheel free-runs and throws the loop's structure
// across a raster that is no longer under it. `cfbGenlock` is the frame
// synchronizer that keeps the return off the blanking interval.
//
// Measured before it existed, 16 of the 44 feedback looks were running with the
// separator finding an edge on under 30% of lines, none of them authored to.
// `scripts/gpuprof/looplock.ts` is what reads that, and it needs a GPU; this
// holds the same line from the patch data alone, which is where a new preset
// will trip it.
describe('the mixer loop and the sync tip', () => {
  // Looks whose subject is the receiver losing the line start. The bare cable
  // is the patch, and the tearing is what they are for — each measured at
  // lock 0, and each saying so in its own blurb or its group.
  //
  //   meltdown           the loop rewrites its own timing every lap
  //   everyColourButOne  names the sync tip going over to product, and the two
  //                      timings either side of the seam that follows
  //   railSlam           Past the redline, 22 us of delay, a third of a line
  const tearsOnPurpose = new Set(['meltdown', 'everyColourButOne', 'railSlam'])

  // Loops that displace inside the line and keep the raster anyway, measured
  // rather than assumed: a modest mix, a sub-microsecond delay, and nothing
  // multiplying or holding in the return. Named so a change to any of them has
  // to be re-measured instead of inheriting a verdict about a patch it no
  // longer is.
  //
  //   keyIntoTheLoop   lock 100.0
  //   bentEnhancer     lock  99.8
  //   howlroundLoom    lock  99.1
  const holdsWithoutIt = new Set([
    'keyIntoTheLoop',
    'bentEnhancer',
    'howlroundLoom',
  ])

  it('leaves the cable bare only where that was measured or meant', () => {
    const displacing = PRESETS.filter(p => {
      const c = presetControls(p.patch)
      return (
        c.cfbMix > 0.5 &&
        (c.cfbDelayUs > 0.05 || c.cfbServoUs !== 0 || c.cfbClockPct !== 0)
      )
    })
    expect(displacing.length).toBeGreaterThan(20)
    const bare = displacing
      .filter(p => presetControls(p.patch).cfbGenlock === 0)
      .map(p => p.name)
    expect(new Set(bare)).toEqual(
      new Set([...tearsOnPurpose, ...holdsWithoutIt]),
    )
  })
})

// The camera loop crossfades too, so what decides whether it does anything is
// `fbMix * fbGain` and never the gain alone. Every camera preset in the library
// was once authored against the gain, and ran round trips of 0.53 to 0.97 while
// reading as though it were above unity.
describe('the camera loop round trip', () => {
  const cameraLoops = PRESETS.filter(p => presetControls(p.patch).fbMix > 0)

  // Elsewhere in the library a camera loop is seasoning on a look that is about
  // something else, and a lap that gives back a third is a fair way to season.
  // In this group the loop is the subject, and a round trip of 0.66 there was
  // a preset describing a tunnel over a picture three frames deep.
  it('leaves no loop-group camera loop so far under unity that it is a smear', () => {
    const weak = cameraLoops
      .filter(p => p.group === 'Feedback loops' && p.name !== 'meltdown')
      .map(p => {
        const c = presetControls(p.patch)
        return { name: p.name, trip: c.fbMix * c.fbGain }
      })
      .filter(x => x.trip < 0.6)
    expect(weak).toEqual([])
  })

  // Above unity the transport decides whether there is a picture: a loop that
  // expands spreads what it gains over the whole raster and walks to white
  // within a second, while one that collapses concentrates it into a shrinking
  // core and holds contrast well past it. Measured in docs/CURATION.md.
  it('only runs past unity where the transport collapses inward', () => {
    const hot = cameraLoops
      .map(p => {
        const c = presetControls(p.patch)
        return { name: p.name, trip: c.fbMix * c.fbGain, zoom: c.fbZoom }
      })
      .filter(x => x.trip > 1 && x.zoom >= 1)
    expect(hot).toEqual([])
  })
})
