import { useEffect, useState } from 'react'

import { clockOf } from '../ui/format'

export function Elapsed(props: { since: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - props.since) / 1000))
  return <span>{clockOf(s)}</span>
}
