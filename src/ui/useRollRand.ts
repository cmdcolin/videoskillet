import { useState } from 'react'

import { pageSearch } from '../core/gpu/env'
import { rngFor } from '../core/rng'
import { parseSessionParams } from './urlParams'

import type { Rand } from '../core/rng'

// Where every roll in a session draws its numbers from: `Math.random`, or the
// seeded generator `?seed=n` asks for (urlParams.ts).
//
// One generator for the whole session, handed to the boot roll and to the look
// bar's buttons alike, which is why it is made here rather than by each of
// them. Two generators off one seed would start at the same place, so
// `?surprise&seed=7` would land on a look and then hand back that same look to
// the first press of the button — a coincidence that reads as a broken button.
//
// Held in state, and the state is the function: a generator carries the
// position it has reached, so one rebuilt during a render would rewind the
// session's sequence to its first roll every time React re-rendered the app.
//
// One sequence for the rolls is what `adr/0006` declines for the *engine*, and
// the two are not in tension: what it forbids is a module-level generator the
// per-frame modulators share, where the order the code happens to ask decides
// what a take renders. Here the order is the order a hand pressed the button,
// which is the thing being reproduced. The engine keeps its own dice
// (`startTake`), and nothing in this file reaches them.
export function useRollRand(): Rand {
  const [rand] = useState<Rand>(() => {
    const { seed } = parseSessionParams(pageSearch())
    return seed === null ? Math.random : rngFor(seed)
  })
  return rand
}
