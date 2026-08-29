import { createContext, use } from 'react'

// What line 21 is carrying, and how to change it — read from context for the
// same reason the signal tap is: the box that types it lives inside
// ControlGroup, several components below app.tsx where eng.caption sits. It is
// deliberately not a control, because it is not a quantity: a preset, a morph
// or a random nudge has no business rewriting what a caption says.
interface CaptionApi {
  caption: string
  onCaption: (v: string) => void
}

export const CaptionContext = createContext<CaptionApi | null>(null)

export function useCaptionApi(): CaptionApi {
  const api = use(CaptionContext)
  if (api === null) throw new Error('caption read outside the panel')
  return api
}
