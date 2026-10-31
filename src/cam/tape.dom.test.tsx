import { afterEach, expect, it, vi } from 'vitest'

import { playLoop } from './tape'

afterEach(() => {
  vi.restoreAllMocks()
})

it('lets go of the URL of a loop that will not play', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tape')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
    new Error('no play'),
  )
  await expect(playLoop(new Blob())).rejects.toThrow('no play')
  expect(revoke).toHaveBeenCalledWith('blob:tape')
})

it('hands back the URL with the playing loop', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tape')
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const loop = await playLoop(new Blob())
  expect(loop.url).toBe('blob:tape')
  expect(loop.video.src).toBe('blob:tape')
})
