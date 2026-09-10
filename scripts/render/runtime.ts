// The browser globals the engine expects, for a runtime that has no display.
//
// Imported for its side effect and **before the engine bundle**, which is why
// `main.ts` reaches the bundle through a dynamic `import()`: a static import is
// hoisted above every statement in the module, so a top-level `import './engine'`
// would run the engine's module body before any of this existed.
//
// Each of the three is the answer that leaves behaviour unchanged where the
// thing does exist, which is the rule `core/gpu/env.ts` already states for the
// same problem from the other side.

const g = globalThis as unknown as Record<string, unknown>

// **A rAF that never fires is the correct stub, not a placeholder.** `Engine`'s
// constructor starts a `RenderLoop`, and a loop starts by asking for an
// animation frame — but an offline render owns the clock and steps every frame
// by hand, so nothing here should be driving frames on its own. `renderTake`
// opens by pausing the live loop for exactly this reason; here there is nothing
// to pause because there was never a display to pace against.
if (typeof g.requestAnimationFrame !== 'function') {
  g.requestAnimationFrame = () => 0
  g.cancelAnimationFrame = () => {}
}

// `window` is gone in Deno 2, and two kinds of code here want it.
// `renderloop.ts` qualifies its timers with it deliberately — bare
// `setInterval` resolves to node's overload, which returns a `Timeout` where
// the field holds a `number` — so that one is a typing fix rather than a claim
// about the runtime. `ui/storage.ts` asks `typeof window !== 'undefined'`
// before registering a `pagehide` handler, which is a genuine question about
// the runtime and one this shim changes the answer to.
//
// So the shim has to be **complete for what it claims**. An earlier version
// supplied the two timer functions alone, on the reasoning that a narrow
// `window` would let every other `typeof window` check fail — and that is not
// what a failing check does. It passes, then calls a method that is not there,
// which is a crash rather than a graceful absence. Everything below is the
// honest headless answer: there is no page, so a page event never fires, and
// registering a listener for one does nothing.
if (typeof g.window !== 'object') {
  g.window = {
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: number) => {
      clearInterval(id)
    },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => {
      clearTimeout(id)
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }
}
