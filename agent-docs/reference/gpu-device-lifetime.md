# GPU device lifetime

[ADR 0004](../../docs/adr/0004-never-destroy-a-presenting-device.md) holds the
measurements and the decision: the app never calls `device.destroy()` on a
device that has presented, because on Firefox Nightly / Linux that ends the
tab's rendering step, and the next document loaded in that tab stops rendering
too. Creating devices is cheap; tearing down a presenting one is what costs the
tab.

- **A frozen tab is the rendering step, not the signal path**, when the console
  or the recorder shows `frame 0`, `STEP-DEAD` or `clock +0ms`. Such a tab still
  reports `visibilityState: 'visible'`, the browser stays responsive, and
  nothing is logged.
- **Treat `scripts/rafceiling.mjs --page=app` as the regression test.** It
  reloads the app 8 times in one tab and holds 69-81 rAF/1.5s with
  `firstDeadSession: null`. If its app arm starts dying, something has started
  destroying devices.
- **Keep HMR on.** A hot update recreates the engine, which hands its device on
  alive (`destroy({keepDevice: true})`), and the successor adopts it from the
  stash on `globalThis` in `src/core/gpu/context.ts`. An editing session costs
  one device however many saves it takes.
- **`?gpudestroy=1` puts the destroy back**, to re-measure the fault on a new
  browser build. It kills the tab.
- **`?gpubudget=ignore` switches off the one gate left**, which declines a
  device to a tab that has already destroyed one. Harnesses that spend devices
  on purpose (`rafceiling.mjs`, `deviceloss.mjs`) pass it so that they measure
  the browser and never app policy.
- **`scripts/devicetear.mjs` is the upstream test.** Its `destroy` arm starts
  surviving when Firefox fixes the bug.
