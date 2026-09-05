# AI usage

Most of this codebase was written by AI agents, and most of what an agent needs
in order to work here safely sits in four files it will not find on its own.
This page is the route in: what to read and in what order, how to drive the app
as a check on your own change, and the mistakes that repeat.

Two jobs bring an agent here, and they want different halves of the docs.
Driving the app — building a look, screenshotting one, scripting a sequence —
needs the address-bar contract and nothing else. Changing the code needs the
premise, the invariants and the harnesses.

## Read these, in this order

| file                                    | what it answers                                          |
| --------------------------------------- | -------------------------------------------------------- |
| [`CLAUDE.md`](../CLAUDE.md)             | the rules of this repo, short enough to read in full     |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)    | the premise, the pass graph, adding a control end to end |
| [`adr/`](adr/)                          | the decisions where the obvious change is wrong          |
| [`DEVELOPMENT.md`](DEVELOPMENT.md)      | every harness, and what each one cost to get right       |
| [`public/llms.txt`](../public/llms.txt) | the address bar, which is the whole remote control       |

Two sections earn a read before you touch anything they cover:
[what every browser harness here has learned the hard way](DEVELOPMENT.md#what-every-browser-harness-here-has-learned-the-hard-way),
before driving a browser at the app, and
[Measuring performance](DEVELOPMENT.md#measuring-performance), before believing
a number that came off this box.

## Driving the app

The address bar carries the whole board, both ways: navigating to a link puts
that look on screen, and turning a knob writes the change back into the bar. So
an agent sets controls by navigation and reads the result by reading the URL,
which beats operating a few hundred knobs through a pointer.

[`public/llms.txt`](../public/llms.txt) is the contract — every parameter, with
an example — and [`public/llms-full.txt`](../public/llms-full.txt) names every
control key, its range and the fault it models. Both are published
(`videoskillet.com/llms.txt`) and both are **generated** by `scripts/docgen.mjs`
from `src/ui/controls.ts`; a hand edit to either one dies at the next
`pnpm docgen`.

One command takes a picture of a link:

```
node scripts/shot.mjs 'http://localhost:5199/app/#preset=vhs&set=headSwitchShiftUs:9' out.png 6000
```

Four ways a link looks like it worked and did not:

- **`#set=` drops a key the schema does not know**, silently. A typo renders a
  full frame that comes back merely uninteresting rather than wrong. Read the
  bar back and compare.
- **A hash-only change does not reload a page.** The app watches for that and
  reloads itself, so a link pasted into an open tab does land — after a moment.
  Give it one before sampling.
- **A feedback look opens black without `#snow`.** The reader's frame store
  starts empty and a loop needs something to amplify; the burst heals off and
  leaves the board the rest of the link describes.
- **An occluded window throttles rAF to about 1 Hz**, so a shot of a
  backgrounded tab is a shot of a picture that never rendered. Step frames with
  `window.vf.step()` from Node rather than waiting on wall clock.

On Linux, drive Firefox Nightly. Chrome's ANGLE/Vulkan backend reports
texture-allocation errors that are driver artifacts and read as app bugs;
`scripts/shot.mjs` already launches Firefox with the right prefs, so model a new
harness on it.

## Changing the code

**Model the mechanism, not the artifact.** There is no "VHS filter" here: dot
crawl, tearing and hue drift emerge from a simulated signal path, which is why
mechanisms interact for free. A shader that draws the look of a fault scores the
screenshot and loses the interaction.

**Pick the domain before writing the effect.** A horizontal displacement means
one thing in the signal domain, another in sync, another in deflection, and
routing a geometry fault through sync spins hue that should have stayed put.
`ARCHITECTURE.md` maps the three.

**`decode` stages a shared tile per row**, so a horizontal offset has to be
row-uniform. Per-pixel horizontal scaling needs that staging restructured first.

**Never call `device.destroy()` on a device that has been presenting.** Doing so
ends the tab's rendering step, the tab still reports `visible`, nothing is
logged, and the next document loaded there inherits the damage. The app lets go
of devices instead and hands the live one on.
[ADR 0004](adr/0004-never-destroy-a-presenting-device.md) has the runs. A freeze
showing `frame 0` / `STEP-DEAD` / `clock +0ms` is that fault, not a bug in the
signal path.

Several files in the tree are generated, and an edit to one survives until the
next build:

| generated                                                                  | source                | command       |
| -------------------------------------------------------------------------- | --------------------- | ------------- |
| `EFFECTS.md`, `llms.txt`, `llms-full.txt`, the loop block in `FEATURES.md` | `src/ui/controls.ts`  | `pnpm docgen` |
| `img/*-dark.svg`, `img/*-light.svg`                                        | `docs/graphviz/*.dot` | `pnpm docs`   |
| the demo bullets in `README.md`                                            | `demos.json`          | `pnpm demos`  |

The gates, cheapest first: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then
`pnpm harnesses 5199` for the browser sweep (six to nine minutes). CI deploys on
lint and test.

## Long runs belong in your own worktree

This repo is worked in by several agents at once, and a dev server here serves
whatever the tree currently says. Two consequences:

- **Your own `src/` write is an HMR reload.** A save mid-run resets the engine
  under whatever you were measuring, and so does somebody else's. Serve a long
  or repeated browser run from a `git worktree add --detach` copy with its own
  vite server on its own port — `DEVELOPMENT.md` carries the two workarounds
  that takes.
- **Do not edit a tracked file to configure a run.** `scripts/colourcheck.mjs`
  takes `--arms-file=` for exactly this reason: an uncommitted edit does not
  reliably survive another session's commit.

`pnpm test` excludes `.claude/`, where those worktrees live. Removing the
exclude collects every worktree's suite into your run, so a half-finished branch
somebody else is working on fails your tests, in files you have never opened, at
paths that look like yours.

## Leave the record where the next agent reads it

An agent's context ends with its session; the docs are what survives. A
measurement that lives only in a transcript gets paid for again.

- **Commits** follow Conventional Commits, scope from the domains in
  `ARCHITECTURE.md` (`signal`, `sync`, `deflection`, `gpu`, `ui`, `midi`,
  `audio`, `docs`). `cliff.toml` builds the changelog from them.
- **An [ADR](adr/)** records a decision where the obvious thing is wrong for a
  non-obvious reason — usually a measured constraint the code cannot state for
  itself. Most changes need none.
- **A [handoff](handoffs/)** holds the working-out behind a day: what was
  measured, what was tried and dropped, what was still open. Dated, and left as
  it was written.

## What the AI actually did here

Agents wrote most of the code, most of these docs, and the harnesses under
`scripts/`. [Fable](https://claude.com/) one-shotted the initial signal-path
design, including the signal-level premise the whole simulator rests on.

A person still picks the work, judges the picture — no harness can say whether a
look is worth keeping — and owns the box the measurements come off. Every
constraint on this page came out of something breaking on that box, which is why
the docs read as a list of warnings: they are the part an agent cannot rederive
from the source.
