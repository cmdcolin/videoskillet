import { packControls } from '../ui/packed'
import { modParam } from '../ui/urlParams'
import { boardOf, routingsOf, sliceOf } from './scene'

import type { Pattern } from './patterns'
import type { Scene } from './scene'

// The instrument, opened on the board this page is showing, asking for the
// camera again or putting up the same patterns. The mixer travels only with a
// pattern on B, since a clip is a file the link cannot carry.
export function instrumentHref(
  scene: Scene,
  a: 'webcam' | Pattern | null,
  b: Pattern | null,
): string {
  const shown = b === null ? { ...scene, mix: null } : scene
  const q = new URLSearchParams()
  q.set('p', packControls(boardOf(shown, sliceOf('whole')).controls))
  const mod = routingsOf(scene)
  if (mod.length > 0) q.set('mod', modParam(mod))
  if (a !== null) q.set('src', a)
  if (b !== null) q.set('srcb', b)
  return `../app/?${q}`
}
