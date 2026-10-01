import { analyticsAnswer } from '../analytics'
import { version } from '../version'
import { putTakeReport } from './cloud'
import { readRecord, readStored, removeStored, writeJSON } from './storage'

// A recording in progress keeps a note of how far it has got, and the next
// page load reports a note it finds to Google Analytics and to the
// `takeReports` collection, which functions/ emails out hourly. A crashed tab
// runs no code, so a note left behind is the only trace of a take that killed
// it. Both reports go out only where the visitor said yes to analytics;
// /privacy/ says what they carry.
const KEY = 'videoskillet_take'

// The longest each string field may be, which firestore.rules enforces. GA
// drops a value over 100.
const STRINGS: Record<string, number> = {
  page: 64,
  codec: 32,
  hardware: 8,
  stage: 16,
  message: 100,
  model: 64,
}
const NUMBERS = new Set([
  'width',
  'height',
  'fps',
  'seconds',
  'frames',
  'held',
  'deepest',
  'memory',
])

// Only the fields the rule admits, at the types and lengths it admits. A note
// is read back from storage, where an older build may have left anything.
function fields(params: Record<string, unknown>) {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) {
    if (k in STRINGS && typeof v === 'string') out[k] = v.slice(0, STRINGS[k])
    else if (NUMBERS.has(k) && typeof v === 'number' && Number.isFinite(v))
      out[k] = v
    else if (k === 'hidden' && typeof v === 'boolean') out[k] = v
  }
  return out
}

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

function send(kind: 'lost' | 'failed', params: Record<string, unknown>) {
  if (analyticsAnswer() !== 'yes') return
  void device().then(d => {
    const report = fields({ ...params, ...d })
    window.gtag?.('event', `take_${kind}`, report)
    void putTakeReport({
      kind,
      version,
      browser: navigator.userAgent.slice(0, 200),
      ...report,
    })
  })
}

// Reports a note an earlier page left, and clears it either way.
export function reportLostTake() {
  if (readStored(KEY) === null) return
  const note = readRecord<Partial<TakeNote>>(KEY, {})
  clearTake()
  send('lost', note)
}

export function reportTakeFailed(message: string, note: TakeNote | null) {
  send('failed', { ...note, message })
}
