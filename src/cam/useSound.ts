import { useState } from 'react'

import type { Failure } from './failure'

// Whether the room's sound drives the set, which asks for the microphone.
export function useSound(
  hear: (on: boolean) => Promise<unknown>,
  onError: (failure: Failure | null) => void,
) {
  const [on, setOn] = useState(false)
  const toggle = () => {
    onError(null)
    const next = !on
    hear(next).then(
      () => setOn(next),
      (e: unknown) => onError({ during: 'sound', error: e }),
    )
  }
  return { on, toggle }
}
