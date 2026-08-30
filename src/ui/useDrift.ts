// The switch over `drift.ts`: whether the board is wandering, and the two verbs
// that start and stop it.
//
// The walk lives outside React (`makeDrift`), and the only thing React holds is
// the boolean the button reads — which is the split `useStrip` explains at
// length: state that moves on a clock React does not own belongs outside it,
// and a ref written during render is one of the two patterns that make the
// compiler silently give up on a component (`scripts/compilercheck.mjs`).
//
// The dependencies arrive at the press rather than at the render, which is what
// keeps this hook free of them. Everything a leg reads it reads through the
// closures it was handed — the live controls, the glide target, the engine — so
// a walk started ten minutes ago still acts on the board as it is now.

import { useEffect, useRef, useState } from 'react'

import { makeDrift } from './drift'

import type { Drift, DriftDeps } from './drift'

export function useDrift() {
  const [drifting, setDrifting] = useState(false)
  const walk = useRef<Drift | null>(null)

  const stop = () => {
    walk.current?.stop()
    walk.current = null
    setDrifting(false)
  }

  // An interval outliving the component would go on writing looks to an engine
  // nobody is showing — the popout closing and a hot update both unmount this.
  useEffect(() => () => walk.current?.stop(), [])

  return {
    drifting,
    stop,
    start: (deps: DriftDeps) => {
      walk.current?.stop()
      const next = makeDrift(deps)
      walk.current = next
      setDrifting(true)
      next.start()
    },
  }
}
