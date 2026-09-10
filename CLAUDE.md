# videoskillet.js

Real-time NTSC signal-path simulator rendered entirely in WebGPU compute
shaders.

## Read first

**`docs/ARCHITECTURE.md`** — read it before changing anything non-trivial. It
covers the pass graph, buffer layouts, how to add a control end to end, and the
two invariants that are easiest to violate:

- **Which domain an effect belongs to.** A horizontal displacement means
  something different in the signal, sync, and deflection domains — they are not
  interchangeable, and routing a geometry fault through the sync path will spin
  hue that should have stayed put.
- **`decode` stages a shared tile per row**, so horizontal offsets must be
  row-uniform. Per-pixel horizontal scaling needs the staging restructured
  first.

Prefer modelling the mechanism that causes an artifact over drawing the artifact
— that is the whole premise, and it is why mechanisms here interact for free.

**`docs/adr/`** holds the decisions where the obvious thing is wrong for a
non-obvious reason. Read
[0004](docs/adr/0004-never-destroy-a-presenting-device.md) before touching
anything that creates, releases or tears down a `GPUDevice` — see below for why.

## Never destroy a GPUDevice that has been presenting

Measured on Firefox Nightly / Linux (`scripts/devicetear.mjs`): handing a
presenting `GPUDevice` back with `device.destroy()` **ends the tab's rendering
step**. The tab still reports `visible`, the browser stays responsive, nothing
is logged, and the next document loaded in that tab inherits the damage — which
is what "reloading lands in the same hole" always was. Creating devices is cheap
by comparison: four created and four held open, all presenting, cost a tab
nothing.

This is why the app now **never calls `device.destroy()`**. It lets go of
devices instead, and hands the live one to the next engine. `docs/adr/0004` has
the runs; [0002](docs/adr/0002-webgpu-sessions-are-scarce.md) is the superseded
budget model that fitted the same data for the wrong reason.

What follows for anyone working here:

- **Do not "release" a device on the way out.** Not on `pagehide`, not on
  unload, not in a cleanup that looks untidy without it. That one line is what
  made refreshing unsafe: the same page reloaded four times survives every load
  when the device is merely abandoned and dies from load 2 onward when a
  `pagehide` handler destroys it. The comment in `useEngine`'s handler carries
  the measurement.
- **Reloading the app in one tab is fine again.** `rafceiling.mjs --page=app`
  now runs 8 loads in one tab at 69-81 rAF/1.5s (`firstDeadSession: null`),
  where it used to die at session 2. Treat that harness as a regression test for
  this: if its app arm starts dying again, something has started destroying
  devices.
- **HMR is the cheap path.** A hot update recreates the engine, but the engine
  hands its device on alive (`destroy({keepDevice: true})`) and the successor
  adopts it from the stash in `core/gpu/context.ts`, so an editing session costs
  one device however many saves it takes — the stash lives on `globalThis`
  precisely so that editing `core/gpu/context.ts` itself does not throw it away
  with the module. Disabling HMR is the wrong instinct.
- **`?gpudestroy=1` puts the destroy back**, for re-measuring the fault against
  a new browser build. It will kill the tab. `?gpubudget=ignore` switches off
  the gate that declines a device to a tab that has already destroyed one — the
  only thing left that can refuse a session, and reachable only after
  `?gpudestroy=1`. Creating devices is not counted against anything; the
  harnesses that spend them on purpose (`rafceiling.mjs`, `deviceloss.mjs`) pass
  the flag anyway, so what they measure is the browser and never app policy.
- **Do not add `<StrictMode>`.** It doubles device creation per mount and wraps
  a WebGPU canvas in a mount/unmount/mount cycle. `src/main.tsx` carries the
  reason.
- A freeze with `frame 0` / `STEP-DEAD` / `clock +0ms` in the console or the
  recorder is a tab that has lost its rendering step, not a bug in the signal
  path.

## Testing changes for real

Long or repeated browser runs belong on a `git worktree add --detach` copy with
its own vite server. This worktree is shared with other agents, and **your own
edits are HMR** — an `src/` write mid-run reloads the page and resets the engine
under whatever you were measuring. See the traps list in `docs/DEVELOPMENT.md`;
every one of them cost real time.

## Clips live on the bucket, not in the history

Every mp4 this project records — the carousel's slides (`scripts/appreel.mjs`)
and the gallery's demo loops (`scripts/demoreel.mjs`) — goes to
`s3://myloveydove.com/videoskillet/` under a prefix of its own, with
`aws s3 cp --profile colin`. Both recorders upload at the end of a take, and
both `public/reel/*.mp4` and `public/demos/*.mp4` are gitignored. The **stills
stay** in the repo: a card has to show something before its clip is fetched, and
a webp is kilobytes.

A recording is rewritten whenever its look is re-recorded, so a tracked one puts
every version of a megabyte-scale binary in the history forever. `demos.mjs` and
`reel.mjs` each export the pair of constants that says where the clips are —
`S3_PREFIX` to write, `CLIPS` to read — and the page takes the URL straight off
`data-src`, so an absolute one is fine there.

## Writing

Write plain technical English in the docs and in the app. State what a thing is
and what it does, in ordinary declarative sentences.

Two habits to avoid:

- **Mannered phrasing**: inversions, dropped verbs, sentence fragments, and
  aphorisms. "Light rather than wire" and "the only effect you listen to" are
  the house style this replaces; "an optical loop" and "sound buzz is an audio
  output" are what to write instead.
- **Contrastive phrasing**: "X rather than Y", "not A but B", "instead of".
  State the positive half and stop.

Keep a contrast only where the reader needs the distinction to choose correctly:
an ADR naming the option it turned down, or a fault that resembles another one.
A physical mechanism often needs one — "it multiplies rather than adds" is the
fact, not a flourish.

[`docs/WRITING.md`](docs/WRITING.md) is the checklist under this: the specific
habits that produced the prose this repo has rewritten, each with a before and
after, and what a prose pass must leave alone.

## Commits

Use Conventional Commits (`type(scope): description`) — `cliff.toml` groups the
changelog by type and renders the scope inline. Scope is optional; when used,
pick from the domains in `docs/ARCHITECTURE.md`: `signal`, `sync`, `deflection`,
`gpu`, `ui`, `midi`, `audio`, `docs`.

## Testing WebGPU (Linux)

On Linux, test WebGPU with **Firefox Nightly** (`/usr/bin/firefox-nightly`), not
Chrome. Chrome's ANGLE/Vulkan backend on Linux reports spurious
texture-allocation errors (e.g. "Requested allocation size … is smaller than the
image requires") that are driver artifacts, not app bugs. The `scripts/shot.mjs`
harness already launches Firefox Nightly with the right prefs — model new
harnesses on it.
