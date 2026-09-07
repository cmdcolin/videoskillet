import { beforeEach } from 'vitest'

// The suite runs on bare node — there is no jsdom in this project and every
// test here is pure logic — so `localStorage` gets a shim rather than the whole
// suite getting a DOM. Only the four methods storage.ts calls. Without it any
// code path that persists writes a ReferenceError through storage.ts's guard,
// which is noise a passing test should not print.
const map = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  },
})

// Cleared between tests so nothing a persisting call site wrote leaks into the
// next one — the shim is one store for the whole file, where the real thing is
// one per page load.
beforeEach(() => {
  map.clear()
})
