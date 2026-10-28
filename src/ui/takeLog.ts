import { version } from '../version'
import { putTakeReport } from './cloud'
import { readRecord, readStored, removeStored, writeJSON } from './storage'

// A recording in progress keeps a note of how far it has got, and the next
// page load reports a note it finds to the `takeReports` collection, which
// functions/ emails out hourly. A crashed tab runs no code, so a note left
// behind is the only trace of a take that killed it. /privacy/ says what a
// report carries.
const KEY = 'videoskillet_take'

// The longest each string field may be, which firestore.rules enforces.
const STRINGS: Record<string, number> = {
  page: 64,
  codec: 32,
  hardware: 8,
  stage: 16,
  message: 100,
  error: 32,
  coded: 16,
  canvas: 16,
  model: 64,
}
// The flags, which are reported the same way the numbers are.
const BOOLEANS = new Set(['hidden', 'streamed'])

const NUMBERS = new Set([
  'width',
  'height',
  'fps',
  'seconds',
  'frames',
  'held',
  'deepest',
  'encoded',
  'chunks',
  'bytes',
  'configs',
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
    else if (BOOLEANS.has(k) && typeof v === 'boolean') out[k] = v
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
  encoded: number
  chunks: number
  // How large the file had got, in bytes.
  bytes: number
  // Whether the take was being written to a file as it encoded. One that was
  // not is one the browser was holding whole, so this is what says whether
  // `bytes` is also what the take was costing the tab.
  streamed: boolean
  // What the encoder coded and what the canvas measured last, as WxH. Either
  // differing from the take's size is a lead.
  coded: string
  canvas: string
  configs: number
  // The DOMException name of the encoder's error, which Chrome reports when
  // its message says nothing.
  error?: string
  stage: 'recording' | 'finishing'
  // Whether the page was hidden at any point. A phone may kill a hidden tab
  // to reclaim memory, which is not the take's doing.
  hidden: boolean
}

// A tab recording a take holds a lock named after the note's key, shared so
// that two tabs can each record one. The browser drops the lock when the tab
// closes or crashes, so a note found while some tab holds it belongs to a take
// still being recorded.
let release: (() => void) | null = null

const holdLock = () => {
  if (release !== null || typeof navigator.locks?.request !== 'function') return
  const held = new Promise<void>(r => {
    release = r
  })
  void navigator.locks
    .request(KEY, { mode: 'shared' }, () => held)
    .catch(() => {})
}

export const noteTake = (note: TakeNote) => {
  writeJSON(KEY, note)
  holdLock()
}

export const clearTake = () => {
  removeStored(KEY)
  release?.()
  release = null
}

// Whether any open tab is recording a take.
export async function takeLive(): Promise<boolean> {
  if (typeof navigator.locks?.query !== 'function') return false
  const { held } = await navigator.locks.query().catch(() => ({ held: [] }))
  return held?.some(l => l.name === KEY) ?? false
}

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
  void device().then(d => {
    const report = fields({ ...params, ...d })
    void putTakeReport({
      kind,
      version,
      browser: navigator.userAgent.slice(0, 200),
      ...report,
    })
  })
}

let checking = false

// Reports a note a crashed page left, and clears it. A note another tab is
// still writing stays.
export function reportLostTake() {
  if (checking || readStored(KEY) === null) return
  checking = true
  void takeLive().then(live => {
    checking = false
    if (live || readStored(KEY) === null) return
    const note = readRecord<Partial<TakeNote>>(KEY, {})
    removeStored(KEY)
    send('lost', note)
  })
}

export function reportTakeFailed(message: string, note: TakeNote | null) {
  send('failed', { ...note, message })
}
