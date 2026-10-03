import type { Look } from './looks'
import type { Pattern } from './useCamEngine'

// The instrument, opened on the look this page is showing, asking for the
// camera again or putting up the same patterns. A look at full strength is a
// preset the link can name; a weaker one is a blend, which only the
// instrument's own link format carries. A clip is a file the link cannot carry.
export function instrumentHref(
  look: Look | null,
  a: 'webcam' | Pattern | null,
  b: Pattern | null,
): string {
  const q = new URLSearchParams()
  if (look !== null && look.strength === 1) q.set('preset', look.name)
  if (a !== null) q.set('src', a)
  if (b !== null) q.set('srcb', b)
  return q.size === 0 ? '../app/' : `../app/?${q}`
}
