import { useState } from 'react'

// Whether the room's sound drives the set, which asks for the microphone.
export function useSound(
  hear: (on: boolean) => Promise<unknown>,
  onError: (message: string) => void,
) {
  const [on, setOn] = useState(false)
  const toggle = () => {
    onError('')
    const next = !on
    hear(next).then(
      () => setOn(next),
      () =>
        onError(
          'Microphone access was turned down. Allow it in the browser’s site settings and try again.',
        ),
    )
  }
  return { on, toggle }
}
