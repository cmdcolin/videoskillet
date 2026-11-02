# Agentic AI usage

An AI agent can play videoskillet. Claude Code, or any agent that can reach a
browser, can open the app, set controls, read the board back and hand you the
link to what it built. You describe a look in words and the agent turns the
knobs.

<video
  controls muted loop playsinline
  poster="img/agent-build-poster.jpg"
  src="https://myloveydove.com/videoskillet/agent-build.mp4"></video>

The video shows Claude Sonnet on the right and the app in Chrome on the left.
The prompt is the one the **agent** button copies, followed by a request to
rebuild the Purplady gallery look from its plain photo one stage at a time. The
model sets the decoder, which turns the picture purple, then three generations
of tape, then the chroma feedback loop that turns the face into violet streaks,
and says what each stage did. The waits between stages are cut out.

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

The agent has three ways to drive the tab:

- **The engine.** `window.vf` is the live engine, and two methods cover most
  work:

  ```js
  window.vf.applyControls({ bGain: 1, bGenlock: 1, bKey: 1, bKeyHueDeg: 241 })
  window.vf.getControls()
  ```

  `applyControls` takes any subset of control keys and leaves the others where
  they are. A value out of range clamps to the slider's range, and a key the app
  does not have is left out. It returns `{applied, clamped, rejected, unknown}`,
  so the agent can tell which values were applied.

- **A whole board.** `window.vfBoard` applies and reads the board in one call:

  ```js
  window.vfBoard.apply('#preset=vhs&set=noiseIre:9&mod=')
  window.vfBoard.read()
  ```

  `apply` takes a link, a bare query such as `preset=vhs&set=noiseIre:9`, or a
  whole board text, and lands the sources, the controls and the modulation bay
  in one step that `ctrl+z` undoes. Every control the link does not name goes
  back to stock, and a link with no `mod=` stops all motion. It returns
  `{unknown, damaged}`: the `set=` keys that are not controls, and whether a
  packed `p=` look failed its check. `read` returns the board as text.

- **The command palette.** `ctrl+k` (`⌘k`) opens a text box that takes a
  control's name and a value in one line, such as `head switch 9` or `noise 12`,
  and a preset or action by name, such as `vhs` or `still`. Each row shows
  `current → target` before Enter commits it.

### Scripted runs

A coding agent with a shell can also launch its own browser with Playwright or
Puppeteer and call `window.vf` the same way. Use this for batch work, such as
rendering a still for each of twenty looks:

```
node scripts/shot.mjs 'http://localhost:5199/app/#preset=vhs&set=headSwitchShiftUs:9' out.png 6000
```

The link the page opens on sets the sources: `#src=webcam&vurlb=<url>` puts the
camera on A and a video file on B. On Linux, drive Firefox Nightly from a
harness; `scripts/shot.mjs` launches it with the right prefs.

## Reading the board back

The picture is a `<canvas>`, so a screenshot shows what a fault looks like and
never what a control is set to. Read state as text:

- `window.vf.getControls()` returns every control's value.
- `window.vfBoard.read()` returns the board as text, the same block the sidebar
  shows.
- The **board as text** section of the sidebar lists the look, both sources,
  every control off stock with its key, reading and stock value, every
  modulation routing, and the link. A link or a board pasted into the box under
  it is applied when **apply** is pressed.
- Every palette row is a button whose text contains the control's name, reading,
  kind and group.
- The address bar holds the link to the current look.

## Driving it by link

An agent that can only navigate can still set every control through
[the link](GETTING-STARTED.md#sharing-a-look). `#set=key:value,…` sets controls
by key, `#preset=` applies a preset, and `#mod=` sets modulation routings.
[`llms.txt`](https://videoskillet.com/llms.txt) is the reference, with an
example for every parameter, and
[`llms-full.txt`](https://videoskillet.com/llms-full.txt) lists every control
key, its range and the fault it models. Both are generated from
`src/ui/controls.ts`.

## Things that trip agents up

- **A backgrounded or minimized tab draws about one frame a second.** It still
  reports `visible`, so a screenshot of it is seconds stale. Keep the tab in
  front, or step frames with `window.vf.step()`.
- **`#set=` ignores an unrecognized key** and reports no error. Read the address
  bar or `getControls()` back after writing, or apply the link with
  `window.vfBoard.apply`, which returns the keys it left out as `unknown`.
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
[`CLAUDE.md`](../CLAUDE.md), which points at
[`ARCHITECTURE.md`](ARCHITECTURE.md), the [ADRs](adr/) and
[`DEVELOPMENT.md`](DEVELOPMENT.md). A control added to `src/ui/controls.ts`
works with every method above with no extra code: the palette indexes it,
`#set=` takes its key, and `pnpm docgen` writes it into `llms-full.txt`.
