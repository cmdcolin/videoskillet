// Bundled video sources: played through the same <video> path as a picked
// file (videoSlot.ts's playUrl) — the video counterpart to CAT_URL's bundled
// photo. `clip-test` ships in `public/`, same-origin.

import { publicUrl } from '../publicUrl'

export const CLIP_IDS = ['clip-test'] as const
type ClipId = (typeof CLIP_IDS)[number]

interface BundledClip {
  label: string
  url: string
}

export const CLIPS: Record<ClipId, BundledClip> = {
  'clip-test': {
    label: 'Test pattern — bars, timecode, motion',
    url: publicUrl('test.mp4'),
  },
}

const CLIP_ID_SET: ReadonlySet<string> = new Set(CLIP_IDS)
export const isClipId = (mode: string): mode is ClipId => CLIP_ID_SET.has(mode)

export const clipUrl = (id: ClipId): string => CLIPS[id].url
