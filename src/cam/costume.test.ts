import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { PRESET_BY_NAME, needsSourceB } from '../ui/presets'
import {
  AUTO_S,
  BOOP_JOLT,
  COSTUME_POOL,
  DEFAULT_SAY,
  autoGapMs,
  costumeSettings,
  joltOf,
  roused,
  rollBoop,
  wantsCostume,
} from './costume'
import { OPENERS, UNROLLED_GROUPS } from './looks'

describe('costume mode', () => {
  it('rolls only looks the camera can run alone', () => {
    expect(COSTUME_POOL.length).toBeGreaterThan(10)
    for (const name of COSTUME_POOL) {
      const def = PRESET_BY_NAME.get(name)
      expect(def, name).toBeDefined()
      expect(needsSourceB(def!), name).toBe(false)
      expect(UNROLLED_GROUPS.has(def!.group), name).toBe(false)
    }
  })

  it('opens on a look it would roll', () => {
    for (const name of OPENERS) expect(COSTUME_POOL, name).toContain(name)
  })

  it('never lands the look already up', () => {
    const current = { name: COSTUME_POOL[0]!, strength: 1, rolled: true }
    for (let i = 0; i < 50; i++)
      expect(rollBoop(current).look.name).not.toBe(current.name)
  })

  it('reads its settings off the link', () => {
    expect(costumeSettings('?costume')).toEqual({
      threshold: BOOP_JOLT,
      say: DEFAULT_SAY,
      autoS: AUTO_S,
    })
    expect(
      costumeSettings('?costume&boop=4&say=we come in peace&auto=0'),
    ).toEqual({ threshold: 4, say: 'WE COME IN PEACE', autoS: 0 })
    expect(costumeSettings('?costume&boop=-2&say=%20&auto=x')).toEqual({
      threshold: BOOP_JOLT,
      say: DEFAULT_SAY,
      autoS: AUTO_S,
    })
    expect(wantsCostume('?costume')).toBe(true)
    expect(wantsCostume('?look=x')).toBe(false)
  })

  it('waits between two fifths of the longest wait and all of it', () => {
    expect(autoGapMs(40, () => 0)).toBe(16000)
    expect(autoGapMs(40, () => 1)).toBe(40000)
  })

  it('measures a jolt as the change between samples', () => {
    expect(joltOf({ x: 0, y: 9.8, z: 0 }, { x: 0, y: 9.8, z: 0 })).toBe(0)
    expect(joltOf({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5)
  })

  it('wires the room into the set, and keeps a look that works it harder', () => {
    expect(roused(DEFAULT_CONTROLS).audioRoll).toBeGreaterThan(0)
    expect(roused({ ...DEFAULT_CONTROLS, audioSagUs: 90 }).audioSagUs).toBe(90)
  })
})
