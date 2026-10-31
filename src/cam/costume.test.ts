import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { PRESET_BY_NAME, needsSourceB } from '../ui/presets'
import {
  BOOP_JOLT,
  COSTUME_POOL,
  boopThreshold,
  joltOf,
  roused,
  rollBoop,
  wantsCostume,
} from './costume'

describe('costume mode', () => {
  it('rolls only looks the camera can run alone', () => {
    expect(COSTUME_POOL.length).toBeGreaterThan(10)
    for (const name of COSTUME_POOL) {
      const def = PRESET_BY_NAME.get(name)
      expect(def, name).toBeDefined()
      expect(needsSourceB(def!), name).toBe(false)
    }
  })

  it('never lands the look already up', () => {
    const current = { name: COSTUME_POOL[0]!, strength: 1, rolled: true }
    for (let i = 0; i < 50; i++)
      expect(rollBoop(current).look.name).not.toBe(current.name)
  })

  it('reads the threshold off the link', () => {
    expect(boopThreshold('?costume&boop=4')).toBe(4)
    expect(boopThreshold('?costume')).toBe(BOOP_JOLT)
    expect(boopThreshold('?costume&boop=-2')).toBe(BOOP_JOLT)
    expect(wantsCostume('?costume')).toBe(true)
    expect(wantsCostume('?look=x')).toBe(false)
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
