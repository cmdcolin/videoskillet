# Agentic AI usage

An AI agent can play videoskillet. Claude Code, or any agent that can reach a
browser, can open the app, set controls, read the board back and hand you the
link to what it built. You describe a look in words and the agent turns the
knobs.

<video
  controls muted loop playsinline
  poster="img/agent-drive-poster.jpg"
  src="https://myloveydove.com/videoskillet/agent-drive.mp4"></video>

Claude Sonnet on the right, the app in Chrome on the left, and nothing scripted
between them. The model types five controls into the command palette, checks
each row before committing it, and reads the board back at the end.

## Automate a running instance with Claude Code

Open [videoskillet.com/app/](https://videoskillet.com/app/) in Chrome, then
start Claude Code with its Chrome integration:

```
claude --chrome
```

Claude Code now works in your browser, including the tab the app is already
running in. Ask for a look in plain words:

```
In the videoskillet tab, put the color bars through a VHS deck with a bad head
switch, then slowly detune the subcarrier until the hue rolls. Give me the link
when it looks right.
```

The app's **agent** button, in the sidebar's masthead, copies a prompt that
starts the agent from the look on screen.

The agent has two ways to drive the tab:

- **The engine.** `window.vf` is the live engine, and two methods cover most
  work:

  ```js
  window.vf.applyControls({ bGain: 1, bGenlock: 1, bKey: 1, bKeyHueDeg: 241 })
  window.vf.getControls()
  ```

  `applyControls` takes any subset of control keys and leaves the others where
  they are. A value out of range clamps to the slider's range, and a key the app
  does not have is left out. It returns `{applied, clamped, rejected, unknown}`,
  so the agent can tell whether a write landed.

- **The command palette.** `ctrl+k` (`⌘k`) opens a text box that takes a
  control's name and a value in one line, such as `head switch 9` or `noise 12`,
  and a preset or action by name, such as `vhs` or `still`. Each row shows
  `current → target` before Enter commits it.

Either way the app writes the board into the address bar, so the page's URL is
always the link to the current look.

### Scripted runs

A coding agent with a shell can also launch its own browser with Playwright or
Puppeteer and call `window.vf` the same way. Use this for batch work, such as
rendering a still for each of twenty looks:

```
node scripts/shot.mjs 'http://localhost:5199/app/#preset=vhs&set=headSwitchShiftUs:9' out.png 6000
```

The link the page opens on sets the sources: `?src=webcam&vurlb=<url>` puts the
camera on A and a video file on B. On Linux, drive Firefox Nightly from a
harness; `scripts/shot.mjs` launches it with the right prefs.

## Reading the board back

The picture is a `<canvas>`, so a screenshot shows what a fault looks like and
never what a control is set to. Read state as text:

- `window.vf.getControls()` returns every control's value.
- The **board as text** section of the sidebar lists the look, both sources,
  every control off stock with its key, reading and stock value, every
  modulation routing, and the link.
- Every palette row is a button whose text carries the control's name, reading,
  kind and group.

## Driving it by link

Every look is a link, so an agent that can only navigate still drives the whole
instrument. `#set=key:value,…` sets controls by key, `#preset=` applies a
preset, and `#mod=` sets modulation routings.
[`llms.txt`](https://videoskillet.com/llms.txt) is the contract, with an example
for every parameter, and
[`llms-full.txt`](https://videoskillet.com/llms-full.txt) lists every control
key, its range and the fault it models. Both are generated from
`src/ui/controls.ts`.

## Things that trip agents up

- **A backgrounded or minimized tab draws about one frame a second.** It still
  reports `visible`, so a screenshot of it is seconds stale. Keep the tab in
  front, or step frames with `window.vf.step()`.
- **`#set=` drops a key it does not know** without an error. Read the address
  bar or `getControls()` back after writing.
- **A feedback look opens black without `#snow`.** The loop needs something to
  amplify, and `#snow` seeds it with a burst of noise.
- **A hash-only change does not reload the page.** The app notices and reloads
  itself after a moment, so wait before sampling.
- **`window.vf` is the concrete `Engine`**, and its methods can change between
  releases. `src/core/gpu/engineapi.ts` at the deployed commit lists them, and
  the tooltip on the app's name shows that commit.
- **On Linux, Chrome logs texture-allocation errors.** They come from the
  ANGLE/Vulkan driver and do not mean the app is broken.

## Changing the code

Agents wrote most of this codebase. An agent working on it starts at
[`CLAUDE.md`](../CLAUDE.md), which carries the repo's rules and points at
[`ARCHITECTURE.md`](ARCHITECTURE.md), the [ADRs](adr/) and
[`DEVELOPMENT.md`](DEVELOPMENT.md). A control added to `src/ui/controls.ts`
reaches every agent route above with no extra work: the palette indexes it,
`#set=` takes its key, and `pnpm docgen` writes it into `llms-full.txt`.
