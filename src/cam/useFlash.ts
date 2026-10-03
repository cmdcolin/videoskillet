import { useRef, useState } from 'react'

// A word shown over the picture for a moment.
export function useFlash() {
  const [flash, setFlash] = useState('')
  const timer = useRef(0)
  const announce = (text: string) => {
    setFlash(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(''), 900)
  }
  return { flash, announce }
}
