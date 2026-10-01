import { readRecord, readStored, removeStored, writeJSON } from './storage'

// A recording in progress keeps a note of how far it has got, and the next
// page load reports a note it finds to Google Analytics. A crashed tab runs no
// code, so a note left behind is the only trace of a take that killed it. Both
// reports go out only where the visitor said yes to analytics, which is the
// only case `window.gtag` exists; /privacy/ says what they carry.
const KEY = 'videoskillet_take'

// GA drops a parameter value longer than this.
const MAX_VALUE = 100

export interface TakeNote {
  page: string
  width: number
  height: number
  fps: number
  codec: string
  // Whether the platform offers a hardware encoder for this config. Chrome on
  // Android falls back to a far slower software encoder where it does not.
  hardware: 'yes' | 'no' | 'unknown'
  seconds: number
  frames: number
  held: number
  deepest: number
  stage: 'recording' | 'finishing'
  // Whether the page was hidden at any point. A phone may kill a hidden tab
  // to reclaim memory, which is not the take's doing.
  hidden: boolean
}

export const noteTake = (note: TakeNote) => writeJSON(KEY, note)

export const clearTake = () => removeStored(KEY)

interface HighEntropy {
  getHighEntropyValues: (hints: string[]) => Promise<{ model?: string }>
}

// The phone's model and memory, which Chrome gives a page that asks and other
// browsers do not.
async function device(): Promise<Record<string, string | number>> {
  const nav: Navigator & {
    userAgentData?: HighEntropy
    deviceMemory?: number
  } = navigator
  const model = await nav.userAgentData
    ?.getHighEntropyValues(['model'])
    .then(v => v.model ?? '')
    .catch(() => '')
  return {
    ...(model === undefined || model === '' ? {} : { model }),
    ...(nav.deviceMemory === undefined ? {} : { memory: nav.deviceMemory }),
  }
}

function send(event: string, params: Record<string, unknown>) {
  const gtag = window.gtag
  if (gtag === undefined) return
  void device().then(d => gtag('event', event, { ...params, ...d }))
}

// Reports a note an earlier page left, and clears it either way.
export function reportLostTake() {
  if (readStored(KEY) === null) return
  const note = readRecord<Partial<TakeNote>>(KEY, {})
  clearTake()
  send('take_lost', note)
}

export function reportTakeFailed(message: string, note: TakeNote | null) {
  send('take_failed', { ...note, message: message.slice(0, MAX_VALUE) })
}
