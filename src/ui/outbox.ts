import { readArray, writeJSON } from './storage'

// Rows written down locally before they are sent: the vote page's votes and the
// app's ratings. Each queue is one store and a sanitizer that reads its rows
// back, and `key` names a row for removal.

// Past this the oldest rows go first. A 5MB localStorage quota is shared with
// everything else the app keeps, and blowing it throws on write.
const PENDING_MAX = 1000

export function readQueue<T>(
  store: string,
  read: (raw: unknown) => T | undefined,
): T[] {
  return readArray<unknown>(store, []).flatMap(raw => {
    const row = read(raw)
    return row === undefined ? [] : [row]
  })
}

export function enqueue<T>(
  store: string,
  read: (raw: unknown) => T | undefined,
  row: T,
): T[] {
  const next = [...readQueue(store, read), row].slice(-PENDING_MAX)
  writeJSON(store, next)
  return next
}

// Drop the rows that made it. A flush can partially succeed and the survivors
// have to stay queued, and a row written during an in-flight flush must not be
// dropped by it.
export function dequeue<T>(
  store: string,
  read: (raw: unknown) => T | undefined,
  sent: readonly T[],
  key: (row: T) => string,
) {
  const gone = new Set(sent.map(key))
  writeJSON(
    store,
    readQueue(store, read).filter(row => !gone.has(key(row))),
  )
}

// One send at a time. A send asked for while one is running runs once more
// when it finishes, for the latest author asked for, so a row queued mid-flight
// goes out without being sent twice.
export function singleFlight(
  send: (who: string) => Promise<void>,
): (who: string) => Promise<void> {
  let running = false
  let next: string | null = null
  const run = async (who: string): Promise<void> => {
    if (running) {
      next = who
      return
    }
    running = true
    await send(who).catch(() => {})
    running = false
    const again = next
    next = null
    if (again !== null) await run(again)
  }
  return run
}
