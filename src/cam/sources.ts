import { PATTERNS, PATTERN_TITLE } from './useCamEngine'

import type { Pattern } from './useCamEngine'
import type { Facing } from './useCamera'
import type { ASource } from './useSourceA'

export type BSource = 'none' | 'camera' | 'record' | 'clip' | Pattern

interface Option<K> {
  key: K
  label: string
  title?: string
}

const CLIP: Option<'clip'> = {
  key: 'clip',
  label: 'clip',
  title: 'any video of yours, looped',
}

const patterns = (): Option<Pattern>[] =>
  PATTERNS.map(p => ({ key: p, label: p, title: PATTERN_TITLE[p] }))

// What source A can be: the camera, or both of a phone's cameras by name, then
// a clip and the set's own patterns.
export function aOptions(
  canFlip: boolean,
  sided: boolean,
  facing: Facing,
): Option<Facing | ASource>[] {
  const cameras: Option<Facing>[] =
    canFlip && sided
      ? [
          { key: 'environment', label: 'back camera' },
          { key: 'user', label: 'front camera' },
        ]
      : [{ key: facing, label: 'camera' }]
  return [...cameras, CLIP, ...patterns()]
}

export function bOptions(canFlip: boolean): Option<BSource>[] {
  return [
    { key: 'none', label: 'none', title: 'nothing on B' },
    ...(canFlip
      ? [
          {
            key: 'camera' as const,
            label: 'other camera',
            title:
              'the other camera, live where the phone runs both, else a 4 s tape',
          },
        ]
      : []),
    {
      key: 'record',
      label: 'record 4 s',
      title: 'record 4 s of this camera and loop it on B',
    },
    CLIP,
    ...patterns(),
  ]
}
