// The switches over `drift.ts`: which scopes are wandering, and the two verbs
// that set one going and stop it.
//
// The walk lives outside React (`makeDrift`), and the only thing React holds is
// the set of names the switches read — which is the split `useStrip` explains
// at length: state that moves on a clock React does not own belongs outside it,
// and a ref written during render is one of the two patterns that make the
// compiler silently give up on a component (`scripts/compilercheck.mjs`).
//
// The dependencies arrive at the first press rather than at the render, which
// is what keeps this hook free of them. Everything a leg reads it reads through
// the closures it was handed — the live controls, the glide target, the engine
// — so a walk started ten minutes ago still acts on the board as it is now, and
// a second switch flipped later joins the walk that is already running instead
// of replacing it and losing what it was tethered to.

import { useEffect, useRef, useState } from 'react'

import { makeDrift } from './drift'

import type { Drift, DriftDeps, DriftScope } from './drift'

export function useDrift() {
  const [scopes, setScopes] = useState<ReadonlySet<string>>(new Set())
  const walk = useRef<Drift | null>(null)

  // An interval outliving the component would go on writing looks to an engine
  // nobody is showing — the popout closing and a hot update both unmount this.
  useEffect(() => () => walk.current?.stop(), [])

  return {
    scopes,
    start: (deps: DriftDeps, scope: DriftScope) => {
      const walking = walk.current ?? makeDrift(deps)
      walk.current = walking
      walking.add(scope)
      setScopes(new Set(walking.running()))
    },
    // One scope, or every scope when nothing is named — which is what an
    // unmount needs, since a walk with nobody watching it writes looks to an
    // engine nobody is showing.
    stop: (name?: string) => {
      const walking = walk.current
      if (walking !== null) {
        if (name === undefined) walking.stop()
        else walking.remove(name)
        setScopes(new Set(walking.running()))
      }
    },
  }
}
