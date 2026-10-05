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
    expect(osd.step(false, 1, 4, 0, 0).visible).toBe(false)
    expect(osd.step(false, 0, 4, 0, 100).visible).toBe(false)
  })

  it('shows PLAY when switched on, and holds it for the hold time', () => {
    const osd = new OsdState()
    expect(osd.step(true, 1, 4, 0, 1000)).toMatchObject({
      label: OSD_PLAY,
      visible: true,
    })
    expect(osd.step(true, 1, 4, 0, 4900).visible).toBe(true)
    expect(osd.step(true, 1, 4, 0, 5000).visible).toBe(false)
  })

  it('restarts the hold when the transport changes speed', () => {
    const osd = new OsdState()
    osd.step(true, 1, 4, 0, 0)
    expect(osd.step(true, 1, 4, 0, 5000).visible).toBe(false)
    expect(osd.step(true, 0, 4, 0, 6000)).toMatchObject({
      label: OSD_PAUSE,
      visible: true,
    })
    expect(osd.step(true, 0, 4, 0, 9999).visible).toBe(true)
    expect(osd.step(true, 0, 4, 0, 10000).visible).toBe(false)
  })

  it('shows again when the display is switched off and on', () => {
    const osd = new OsdState()
    osd.step(true, 1, 4, 0, 0)
    osd.step(false, 1, 4, 0, 5000)
    expect(osd.step(true, 1, 4, 0, 6000).visible).toBe(true)
  })

  it('shows the blue background for the mute time and no longer', () => {
    const osd = new OsdState()
    expect(osd.step(true, 1, 4, 1.5, 0).muted).toBe(true)
    expect(osd.step(true, 1, 4, 1.5, 1400).muted).toBe(true)
    expect(osd.step(true, 1, 4, 1.5, 1500).muted).toBe(false)
  })

  it('never mutes outside the hold, whatever the mute time', () => {
    const osd = new OsdState()
    osd.step(true, 1, 2, 10, 0)
    expect(osd.step(true, 1, 2, 10, 2000)).toMatchObject({
      visible: false,
      muted: false,
    })
  })

  it('does not mute with a mute time of 0', () => {
    const osd = new OsdState()
    expect(osd.step(true, 1, 4, 0, 0).muted).toBe(false)
  })

  it('reports the frame the display is switched on, and no other', () => {
    const osd = new OsdState()
    expect(osd.step(true, 1, 4, 0, 0).engaged).toBe(true)
    expect(osd.step(true, 1, 4, 0, 16).engaged).toBe(false)
    expect(osd.step(true, 8, 4, 0, 32).engaged).toBe(false)
    osd.step(false, 8, 4, 0, 48)
    expect(osd.step(true, 8, 4, 0, 64).engaged).toBe(true)
  })

  it('does not show a speed change made while the display was off until it is switched on', () => {
    const osd = new OsdState()
    osd.step(false, 1, 4, 0, 0)
    osd.step(false, 8, 4, 0, 100)
    expect(osd.step(true, 8, 4, 0, 200)).toMatchObject({
      label: OSD_FF,
      visible: true,
    })
  })
})
