# AI usage

Agents wrote most of this codebase, and agents are one of the two hands it is
built to be played by. Three jobs bring one here, and they want different halves
of what follows: **operating the panel** from inside a browser, **driving the
board by link**, and **changing the code**.

Here is one doing it. Claude Sonnet on the right, the app in a Chrome on the
left, and nothing between them scripted — the recording is `pnpm agentreel`,
which sets the two windows down side by side, hands a real Claude Code session
the task, and stops when it lands:

<video
  controls muted loop playsinline
  poster="img/agent-drive-poster.jpg"
  src="https://cmdcolinphotos.s3.amazonaws.com/phosphene/agent-drive.mp4"></video>

Every press in it comes from the model: it opens the palette, applies `vhs`,
reads the row `head switch 9` lands on before committing it, sets the noise, and
finishes by reading the whole board back. `DEVELOPMENT.md` §
[Recording an agent driving the app](DEVELOPMENT.md#recording-an-agent-driving-the-app)
is how to run it.

## Operating the panel from inside a browser

An agent that can see a page and type into it — Claude in Chrome, or anything
else browsing on a person's behalf — reaches this app the way a person does, at
[videoskillet.com/app/](https://videoskillet.com/app/). The app needs WebGPU,
which Chrome ships on desktop; an older Linux build may still want it switched
on at `chrome://flags`.

**The command palette is the surface built for exactly this.** `ctrl+k` (`⌘k`)
puts a region labelled `command palette` in the sidebar, holding one text input,
and the input takes a control's name and the value to set it to in one string:

```
head switch 9      the head-switch tear, pulled to 9 µs
noise 12           luma noise to 12 IRE
synth mix ring     a mode switch, by a prefix of the option's name
vhs                a preset by name, applied whole
still              a verb — the palette indexes actions too
```

Enter commits. The reason the box takes a value at all is written in
`src/ui/paletteQuery.ts`: **an agent cannot aim at a slider track**, and nudging
0 to 9 IRE with an arrow key is thirty presses. Naming the control and the
number is the one gesture that is faster from outside the app than from inside
it.

**Read the board back off the list, not off the picture.** Every palette row is
a button carrying, as text, the name, the control's current reading, the kind
and the group — and the row under the cursor shows `current → target` before
Enter is pressed, so an agent can check what a press is about to do. Typing
`head switch 9` puts this on the first row:

```
head switch | 0.80us → 9.00us | CONTROL | Timebase
```

The picture is a `<canvas>`: a screenshot says what the fault looks like and
never what a control is set to.

**`board as text` answers the same question in one read.** The palette's list
takes one query at a time and the address bar names its values in wire keys with
no units, so the whole board is a verb of its own — the look, both decks, every
control off stock with its reading and its stock value, every routing the
modulation bay is driving, and the link. It puts the block in the sidebar, in a
region labelled `board as text`:

```
look      modified from “vhs”
source A  Color bars
source B  nothing patched in

11 controls off stock
  Timebase
    head switch   headSwitchShiftUs  9.00us  stock 0.00us
    wow           tbWowNs            300ns   stock 0ns
  …
```

Each row carries the control's wire key beside its label, so a board read this
way is a `#set=` link you can write without looking anything up. The text is on
the page rather than only on the clipboard, because the page is where a browsing
agent reads; the copy button beside the heading is for the other reader.

**Every button says what it does in words.** `src/ui/buttonNames.test.ts` fails
the build on a button whose whole content is a glyph, because a screen reader
and a browsing agent reach for the same thing — the accessible name. So clicking
by name works across the panel, not only in the palette.

Single keys are verbs while the palette is closed: `f` fullscreen, `c`
hold-to-compare, `r` record, `s` still, `t` fire, `d` drift, `i` cue, `/`
search, `ctrl+z` undo.

Three things to know before trusting what comes back:

- **A backgrounded or covered tab throttles rAF to about 1 Hz.** The app goes on
  reporting `visible`, so a screenshot of a tab that was clicked away shows a
  picture that is seconds stale rather than an error. Keep the tab in front.
- **A value out of range clamps rather than failing**, the same as dragging past
  the end of the track. `head switch 9000` lands on the ceiling and reports it.
- **On Linux, Chrome logs texture-allocation errors that are ANGLE/Vulkan driver
  artifacts.** They are noise, not a broken app.

A worked sequence, all of it inside the browser: open the app, `ctrl+k`, type
`vhs`, Enter. `ctrl+k` again, `head switch 9`, Enter. Take a screenshot, and the
tear is there in the bars. The panel's preset chip now reads
`modified from "vhs"`, and the address bar carries every control the preset
moved with the edit folded in —
`#set=demodMHz:0.5,lumaMHz:2.8,…,headSwitchShiftUs:9,…`. Handing that link back
is how an agent reports what it built, and pasting it into another tab rebuilds
it exactly.

## Driving the board by link

The address bar carries the board both ways: navigating to a link puts that look
on screen, and turning a knob writes the change back into the bar. An agent that
can navigate but cannot see the page still drives the whole instrument this way.

[`public/llms.txt`](../public/llms.txt) is the contract — every parameter, with
an example — and [`public/llms-full.txt`](../public/llms-full.txt) names every
control key, its range and the fault it models. Both are published
(`videoskillet.com/llms.txt`), and both are **generated** by
`scripts/docgen.mjs` from `src/ui/controls.ts`; a hand edit to either dies at
the next `pnpm docgen`.

One command takes a picture of a link, for an agent working from a shell rather
than a browser:

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
- **An occluded window throttles rAF**, so a shot of a backgrounded tab is a
  shot of a picture that never rendered. Step frames with `window.vf.step()`
  from Node rather than waiting on wall clock.

On Linux, drive Firefox Nightly from a harness. Chrome's driver artifacts are
harmless in the browser and unreadable in a log; `scripts/shot.mjs` already
launches Firefox with the right prefs, so model a new harness on it.

## Changing the code

Read these, in this order:

| file                                 | what it answers                                          |
| ------------------------------------ | -------------------------------------------------------- |
| [`CLAUDE.md`](../CLAUDE.md)          | the rules of this repo, short enough to read in full     |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | the premise, the pass graph, adding a control end to end |
| [`adr/`](adr/)                       | the decisions where the obvious change is wrong          |
| [`DEVELOPMENT.md`](DEVELOPMENT.md)   | every harness, and what each one cost to get right       |

Two sections earn a read before you touch anything they cover:
[what every browser harness here has learned the hard way](DEVELOPMENT.md#what-every-browser-harness-here-has-learned-the-hard-way),
before driving a browser at the app, and
[Measuring performance](DEVELOPMENT.md#measuring-performance), before believing
a number that came off this box.

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

**A control added to `src/ui/controls.ts` reaches every agent for free** — the
palette indexes it by name and by its help prose, `#set=` takes its key, and
`pnpm docgen` writes it into `llms-full.txt`. Nothing else needs teaching about
it, which is the payoff for the schema being one table.

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
