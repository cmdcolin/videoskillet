import { afterEach, describe, expect, it, vi } from 'vitest'

import { RenderEngineReplaced, renderTake } from './render'

const recorder = vi.hoisted(() => ({
  frame: vi.fn(),
  error: vi.fn(() => ''),
  finish: vi.fn(() => Promise.resolve(new Blob())),
  abort: vi.fn(),
}))

vi.mock('./record', () => ({
  startRecording: () => Promise.resolve(recorder),
}))

function fakeEngine() {
  return {
    isDestroyed: false,
    pauseLoop: vi.fn(() => false),
    resumeLoop: vi.fn(),
    startTake: vi.fn(),
    endTake: vi.fn(),
    pullVideo: vi.fn(() => Promise.resolve()),
    step: vi.fn(),
  }
}

const canvas = { width: 8, height: 8 } as HTMLCanvasElement

afterEach(() => {
  vi.clearAllMocks()
})

describe('renderTake', () => {
  it('records every frame of a take', async () => {
    const engine = fakeEngine()
    await renderTake(engine, canvas, { frames: 30, fps: 60, seed: 1 })
    expect(engine.step).toHaveBeenCalledTimes(30)
    expect(recorder.frame).toHaveBeenCalledTimes(30)
    expect(recorder.finish).toHaveBeenCalled()
  })

  it('abandons the take when its engine is destroyed partway', async () => {
    const engine = fakeEngine()
    const take = renderTake(engine, canvas, {
      frames: 30,
      fps: 60,
      seed: 1,
      onFrame: frame => {
        if (frame === 5) engine.isDestroyed = true
      },
    })
    await expect(take).rejects.toBeInstanceOf(RenderEngineReplaced)
    expect(engine.step).toHaveBeenCalledTimes(5)
    expect(recorder.frame).toHaveBeenCalledTimes(5)
    expect(recorder.abort).toHaveBeenCalled()
    expect(recorder.finish).not.toHaveBeenCalled()
  })

  it('starts no take on an engine destroyed before it began', async () => {
    const engine = fakeEngine()
    engine.isDestroyed = true
    await expect(
      renderTake(engine, canvas, { frames: 30, fps: 60, seed: 1 }),
    ).rejects.toBeInstanceOf(RenderEngineReplaced)
    expect(engine.startTake).not.toHaveBeenCalled()
    expect(engine.step).not.toHaveBeenCalled()
  })
})
