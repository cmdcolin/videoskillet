// CROSS_REPO_SYNC_FILE(use-flash)
import { useEffect, useState } from 'react'

/** A mark that shows for `ms` after each `flash`, the clock restarting on every
    one, the same value again included. */
export function useFlash<T>(ms: number) {
  const [shown, setShown] = useState<{ value: T } | null>(null)
  useEffect(() => {
    if (shown !== null) {
      const id = setTimeout(() => setShown(null), ms)
      return () => clearTimeout(id)
    }
    return undefined
  }, [shown, ms])
  return {
    shown: shown === null ? null : shown.value,
    flash: (value: T) => setShown({ value }),
  }
}
