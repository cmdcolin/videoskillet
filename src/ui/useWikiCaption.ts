import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { refKey } from '../sources/pool'
import { clampCardText } from '../sources/teletype'
import { passageAbout } from '../sources/wikitext'

import type { PoolRef } from '../sources/pool'
import type { Passage } from '../sources/wikitext'

export interface WikiCaption {
  follow: boolean
  setFollow: (on: boolean) => void
  busy: boolean
  passage: Passage | null
  error: string
  roll: () => void
}

// Fills the caption with a passage from Wikipedia about `shown`, the pick on
// the picture deck. The button asks once; `follow` asks again every time a new
// pick lands, which is what keeps the words on the subject through a
// slideshow.
export function useWikiCaption(
  shown: PoolRef | null,
  onCaption: (text: string) => void,
): WikiCaption {
  const [follow, setFollow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [passage, setPassage] = useState<Passage | null>(null)
  const [error, setError] = useState('')
  const seq = useRef(0)
  const articleRef = useRef('')

  const fetchFor = (ref: PoolRef | null, avoid: string) => {
    seq.current += 1
    const mine = seq.current
    passageAbout(ref, avoid).then(
      found => {
        if (mine !== seq.current) return
        articleRef.current = found.article
        setPassage(found)
        setError('')
        setBusy(false)
        onCaption(clampCardText(found.text))
      },
      (e: unknown) => {
        if (mine !== seq.current) return
        setBusy(false)
        setError(e instanceof Error ? e.message : String(e))
      },
    )
  }

  const shownKey = shown === null ? '' : refKey(shown)
  const onShown = useEffectEvent(() => {
    fetchFor(shown, '')
  })

  useEffect(() => {
    if (!follow || shownKey === '') return
    onShown()
  }, [follow, shownKey])

  return {
    follow,
    setFollow,
    busy,
    passage,
    error,
    roll: () => {
      setBusy(true)
      setError('')
      fetchFor(shown, articleRef.current)
    },
  }
}
