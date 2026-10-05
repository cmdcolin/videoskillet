import { describe, expect, it } from 'vitest'

import {
  OSD_FF,
  OSD_PAUSE,
  OSD_PLAY,
  OSD_REW,
  OSD_SLOW,
  OsdState,
  osdLabel,
} from './osdstate'

describe('osdLabel', () => {
  it('names the transport state', () => {
    expect(osdLabel(1)).toBe(OSD_PLAY)
    expect(osdLabel(0)).toBe(OSD_PAUSE)
    expect(osdLabel(0.5)).toBe(OSD_SLOW)
    expect(osdLabel(8)).toBe(OSD_FF)
    expect(osdLabel(-2)).toBe(OSD_REW)
  })
})

describe('OsdState', () => {
  it('stays down while the display is off', () => {
    const osd = new OsdState()
    expect(osd.step(false, 1, 4, 0).visible).toBe(false)
    expect(osd.step(false, 0, 4, 100).visible).toBe(false)
  })

  it('shows PLAY when switched on, and holds it for the hold time', () => {
    const osd = new OsdState()
    expect(osd.step(true, 1, 4, 1000)).toEqual({
      label: OSD_PLAY,
      visible: true,
    })
    expect(osd.step(true, 1, 4, 4900).visible).toBe(true)
    expect(osd.step(true, 1, 4, 5000).visible).toBe(false)
  })

  it('restarts the hold when the transport changes speed', () => {
    const osd = new OsdState()
    osd.step(true, 1, 4, 0)
    expect(osd.step(true, 1, 4, 5000).visible).toBe(false)
    expect(osd.step(true, 0, 4, 6000)).toEqual({
      label: OSD_PAUSE,
      visible: true,
    })
    expect(osd.step(true, 0, 4, 9999).visible).toBe(true)
    expect(osd.step(true, 0, 4, 10000).visible).toBe(false)
  })

  it('shows again when the display is switched off and on', () => {
    const osd = new OsdState()
    osd.step(true, 1, 4, 0)
    osd.step(false, 1, 4, 5000)
    expect(osd.step(true, 1, 4, 6000).visible).toBe(true)
  })

  it('does not show a speed change made while the display was off until it is switched on', () => {
    const osd = new OsdState()
    osd.step(false, 1, 4, 0)
    osd.step(false, 8, 4, 100)
    expect(osd.step(true, 8, 4, 200)).toEqual({ label: OSD_FF, visible: true })
  })
})
