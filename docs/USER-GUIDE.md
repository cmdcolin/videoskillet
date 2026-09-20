# User guide

Everything past [Getting started](GETTING-STARTED.md).

## Presets and looks

Click a preset to jump to it. Drag it sideways to blend it part-way in.

![The head of the panel: a row of whole-board buttons (compare, random look and its ▾, drift, morph) over tags, reset and undo, then the Presets shortlist of chips and the dashed handle to the rest](img/presets.png)

- **this look** opens a menu of every control you're off stock on, as sliders.
  Drag to edit, **↺** to revert one, `ctrl+z` puts back what ↺ took.
- **reset** puts everything back to stock — controls, modulation bay and stab
  gate — and `ctrl+z` undoes it. Hold `c` to preview clean without changing
  anything.
- **random nudge** keeps your look and moves it a little: everything already
  doing something, plus a few controls that weren't. `shift` for wilder, `alt`
  for gentler, `ctrl`/`cmd` for a wreck. **random look** stacks a few presets
  instead, and the **▾** beside the button holds the rest of the rolls, ordered
  by how much of your look survives.
- **random motion** leaves every slider where it is and re-patches the
  modulation bay, putting LFOs, drift and sample-and-hold onto controls this
  look uses. Same modifiers, with `ctrl`/`cmd` giving a bay that never settles.
- **drift** runs the random nudge unattended: a gentle nudge every 15 seconds,
  travelling most of the way each time. Press once (or `d`) to start it, again
  to stop where it got to. The **▾** beside it holds **cycle** and **tour**,
  which travel out to another look and come back over and over, and every stage
  heading carries the same switch for that stage alone.
- **morph** sets how long a new look takes to arrive: cut, 1s, 4s, 8s or 30s.
  Rolls chain, so rolling every few seconds wanders continuously.
- **undo** (`ctrl+z`) steps back through all of it.

## Sources

Pick each source at the head of its stage: **A** on SOURCE A, **B** on SOURCE B,
sound on SOUND. Each picker is a menu, so choosing the entry you are already on
opens it again, and picking **File…** twice swaps one video for another.

**A** takes bars, sweep, snow, the bundled photo, a file, a shared screen or a
webcam, which is how an RCA capture dongle gets real gear in. B takes the same
list plus **Off**, and is deliberately not genlocked, so it beats and tears
against A. Its controls are in **Mix**.

A few entries behave in ways the picker does not say. **Public archives** and
**Browse…** put the deck on a **feed** from Wikimedia Commons or archive.org,
which has a topic menu, a **slideshow** that brings up a new file every N
seconds, and a **☆** that keeps the file that is up on your clip shelf. **Video
file URL…** plays an `.mp4` or `.webm` from its address, and needs a server that
allows cross-origin reads; without one the clip plays and the picture stays
black. **Teletype…** prints what you type onto a dot-matrix card, and because a
still card gives still artifacts, **crawl**, **boil** and **garble** keep it
moving.

Under the caption box in **RECEIVER › Captions**, **From Wikipedia** fills the
caption from the English Wikipedia article on what the picture shows, and
**follow the picture** does it again each time a new file lands.

**♪** is audio in, and does nothing until you turn up a knob in **Sound**. It
takes the mic, a file you pick, the clip already on screen, or **system audio**,
a share of the tab or app this machine is playing out of.

Anything with a timeline gets a **cue** button: press to mark, again to loop, a
third time to drop it. **⇤** stabs back to the cue without waiting for the lap.
`i` and `o` do the same from the keyboard, and `shift` puts them on B.

**❚❚** stops a deck's tape where it stands. The **A pause** slider in Source A
is a different thing, freezing the picture while the tape runs on underneath,
with servo damage and a mistrack stripe.

A reload puts each deck back on what it was last holding, which **☰ › advanced
settings › on reload** switches off for a shared machine.

## Working down the chain

![The app window, the chain map at the head of the sidebar boxed in red](img/chain.jpg)

The map at the top of the sidebar is the signal path, and every box is a button.
Amber marks a stage you've moved something in. The wires arcing over the trunk
are the feedback loops (camera, mixer), and the chip on each one is that loop's
button.

![The same map at readable size, its header reading Signal path · click a stage: SOURCE A and SOURCE B into MIX, then CHANNEL, RECEIVER and SCREEN in amber, the camera and mixer returns arching back over the trunk, SOUND dashed and inert under RECEIVER, VIEW under SCREEN, and MODULATION and DECK on a row of their own with no wire reaching them](img/signal-path.png)

**DECK** and **MODULATION** sit below the chain because they patch into the
controls rather than the signal. MODULATION holds the automation you set running
and leave, and DECK holds what you play live: the transition lever and its
wipes, the DVE inset, both tape transports, the tracking knob and the frame
hold.

Inside a stage, **• 10** counts what you've moved, **↺** reverts, **+ mod** sets
the control moving, **⋮** holds the rest of the wiring, and **"inert: needs …"**
means another control gates this one.

**at stock**, on the tinted strip carrying a stage's name, holds that one stage
at stock while the rest of the look stays where it is, so on a picture damaged
in five places you can find which fault makes the artifact.

![The app window with a slider's help card open, boxed in red](img/slider-help.jpg)

**?** on any slider explains the fault that control models. Some rows also carry
a **minor** button. It opens a card whose whole track covers a small window
around the row's current value — ±0.28 µs on **loop delay** and **ghost delay**,
±100 Hz on **osc A** and **osc B**, ±2 Hz on **vertical osc** — so a drag there
reaches settings the row's own track steps straight over.

The loops are the exception to working left to right. They take the picture off
the end and put it back at the front, compounding everything else. Here is a
camera aimed slightly off-axis from its monitor, over a tape dropping out
underneath:

<video
  controls muted loop playsinline
  poster="img/clip-feedback-poster.jpg"
  src="https://cmdcolinphotos.s3.amazonaws.com/phosphene/clip-feedback.mp4"></video>

## Finding a control

The filter box narrows the panel. `/` opens it with the caret in it, and
`ctrl+k` opens a palette over presets, controls and actions at once. Both search
the help text, so you can hunt an artifact without knowing which knob makes it.
The count on the modulation strip (**2 mod**) narrows the panel to what the bay
is driving, which nothing else marks, since a routing leaves the resting value
alone.

## Making it move

**+ mod** on a control row patches a slow sine drift onto it and unfolds an
editor where you pick the source (an LFO, a random walk, noise, sample-and-hold,
a Lorenz attractor, audio level or its hits, or a one-shot envelope you trigger
by hand or from a MIDI note) and dial the rate and depth. Depth is a fraction of
the control's range, and the slider stays put as the centre the motion happens
around, which is why a preset or a link still holds the look.

Two kinds of row have no button: the View controls, where a wobbling magnifier
or a stuttering clock reads as the app breaking, and a strobe or a paperclip
resting at zero, where a wobble could only start the full-field flash. Dial one
of those up and the button is back.

**edit in the bay** opens the **MODULATION** box on the map, which has the full
editor under each routing and the tempo at its top. Type or tap a BPM there,
then tie any rate to it with **♩ lock to beat**. MIDI clock takes over whenever
something sends it. See [MIDI.md](MIDI.md).

**stabs** flip the board back to clean in bursts, 60ms by default and anywhere
from 8 to 400, so the look cuts into a clean picture. Phosphor and both feedback
loops keep running through the flip, so a stab leaves a trail. The **▾** beside
drift switches the gate on at 2 stabs a second, and ⌘K finds it under **stab
gate**. Clean is only its default far end: **⧉ hold this look** parks the
current board there, and the gate then cuts between it and whatever you dial
next, hard on the beat with no fade.

**Sound** hangs off Receiver, where audio patches in. Bass lurches the frame and
level tears line hold, so pick something under **♪** first. **System audio**
asks for a share, which is the only way a browser gives a page the machine's
sound: pick a tab and tick _Also share tab audio_, or the share arrives silent
and the picker says so. Chrome sends audio through a share; not every browser
does.

The one thing in the app that comes out of your speakers sits under that picker:
the set's own intercarrier buzz, the picture arriving on the audio line. It
starts **silent**, because a preset, a link or a random roll can raise either of
its two level controls — _sound buzz_ under **Channel · Ghosting & leakage** and
_fine tuning_ under **Channel · RF / Tuner**. Switch it to **buzz out loud** and
the app remembers that between visits.

## Playing a piece

The **strip** tray along the bottom of the window is a rundown: a list of looks
the app plays in order. Set the board up, press **+ row**, and do it again. **▶
play** walks the rows from the top, and clicking a card fires only that row.

![Two cards from a rundown: row 1 marked with the clip glyph, named Tama station master, its chips reading whole clip, 1s and the tracking transition; row 2 marked with the shake glyph, named shake · normal, its chips reading ≈4 bars, 1s and no transition, both cards ending in a rename, duplicate and remove button](img/strip.png)

A row is the session the address bar carries — the look, the modulation bay, the
source and its cue — plus how long it holds and how it arrives. The chips along
its foot set that, and each steps when you click it. **≈4 bars** lands anywhere
within a quarter of the count either way, and **4 bars** with the drift off is
the exact lock. A row can draw its source from a pool instead of naming a file,
and a **⚄ shake** row keeps whatever is up and jitters the look.

A transition chip puts a fault under the arrival: **track** sweeps head noise up
the frame and swaps the clip under it, **dub** piles up generations so the new
clip arrives worn. Every transition on that list is the board dialled into a
fault and back out, so it compounds with the look.

Bars come from the tempo, tapped or off MIDI clock, so a rundown cut to music
follows the music. Every roll and shake draws from the **seed**, which the tray
prints, so you can play a take worth repeating again.

## Keeping what you find

**saved** is your library, kept on your account, so it needs a sign-in.
`ctrl/⌘+S` saves, and the first nine sit on the number keys: `1–9` recalls,
`shift+1–9` overwrites. A recall brings back the controls and the motion and
leaves your input alone. The [privacy page](https://videoskillet.com/privacy/)
lists what the account holds.

### The link carries the look

The address bar carries the whole look at all times — every control off stock,
what is moving in the bay, the source and its cue — so copying it is the share
button and reloading keeps what you had.

How much of the source fits in the link depends on the source. A pattern, a text
card and a pasted video address go in whole, and an archive clip goes in as its
identifier, so a link sent while a Commons or archive.org file is on screen
opens on _that_ file. A clip from your disk or your clip shelf cannot go in at
all, since the reader has neither, so a link made on one opens on whatever else
it names.

Here is **worn tape**, whole:

```
https://videoskillet.com/app/#p=mD.FbQBJbABEXAAmAIN8AEAPAKQAwDoAgCQAwBkAEgBwAIAgAEGwAIA6AIBCA&mod=
```

The app writes the look there as bytes, behind a two-character checksum, and
refuses a link that arrives truncated or with a character changed. `#set=`
spells the same look out by name, and the app reads and writes it too:

```
https://videoskillet.com/app/#set=noiseIre:9,hHold:0.2,chromaGain:1.79
```

The long form lets you program a look by hand: a control name from
[EFFECTS.md](EFFECTS.md), a colon, a number, commas between. The app leaves
anything you left out at stock, pulls anything out of range back onto the panel,
and drops a name it no longer has. Type a bare `#set=` into the bar to switch a
tab over. The app reads either sigil, so every one of these also opens spelled
`?`.

### Starting a loop from a link

A link carries the controls. What the loops have built is in video memory, which
the reader's page comes up with empty, so a board that builds its picture out of
its own feedback opens black and stays there. **start it with a burst of snow**
in the share box opens the link on a second and a half of snow, which the loops
amplify before the burst fades out. Snow works better than a flat flash because
a loop amplifies detail and a flat field has none.

## Looking closer

Shift-drag a box on the picture to zoom, double-click to reset. **drag to box
zoom** in the ☰ menu makes a plain drag do the same, and shift-drag pan. The
magnifier is part of the display, so it magnifies the lit tube face too — scan
lines, mask and all.

To watch the signal itself, **signal tap** in the View group steps through the
composite waveform, luma, chroma energy, burst state, the scope, and back. The
live tap is named on the ☰ button.

**scope** is the one to try first. It lays a single line out left to right, sync
tip and burst included, against an IRE graticule, where sync depth, setup, AGC
pumping and a burst off 40 IRE are all readable.

## Getting it out

`s` saves a still and `r` records the picture as it plays; both land as files
when they finish. The recording is an H.264 MP4 written at a constant 60, from
whatever frames the tab managed, so a run that dropped frames comes back playing
fast.

**⎙ render** in the strip tray is the other way to a file, and the one an editor
imports cleanly. It takes the frames off the screen and steps the engine on its
own clock, so it runs as fast as the GPU allows and the timing in the file is
the simulation's. **● rec** records the hands rather than the picture — every
slider, preset, controller knob and morph, against the frame it happened on —
and **⎙** replays that, so a run performed at whatever rate the tab managed
comes back at 60.

`pnpm render`, with the project running locally, is the one to use when the
colour matters. It takes a link and a file and writes ProRes 4444, where a
browser's 4:2:0 encode loses most of the dot crawl and rainbow fringing.
[CLI](CLI.md) covers it.

**pop out controls** in the ☰ menu moves the panel to a second window and gives
the picture the whole screen, so pointing OBS at the picture window captures it.
Dragging the edge between the picture and the panel sets the sidebar's width,
and past 540px it is wide enough for **☰ › wide bench**, which lays every stage
out at once over two columns.

## Keyboard

| Key                     | Action                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| `ctrl/⌘+k`              | command palette                                                     |
| `/`                     | filter the controls                                                 |
| `c` (hold)              | preview the clean signal                                            |
| `r` / `s`               | record a clip / save a still                                        |
| `f`                     | fullscreen                                                          |
| `i`                     | cue a clip · press again to loop from there · `+shift` for source B |
| `o`                     | stab back to the cue · `+shift` for source B                        |
| `t`                     | strike every one-shot envelope in the bay                           |
| `d`                     | set the whole board drifting · press again to stop where it got to  |
| `ctrl/⌘+s`              | save this look to your library                                      |
| `1`–`9` / `shift+1`–`9` | recall / overwrite one of your first nine saves                     |
| `ctrl/⌘+z`              | step back a look · `+shift` or `ctrl/⌘+y` steps forward again       |
| `esc`                   | close a dialog, cancel a MIDI arm, clear the filter                 |

---

[Features](FEATURES.md): everything it can break · [Effects](EFFECTS.md): every
control · [MIDI](MIDI.md): setting up a controller ·
[How it works](FAQ.md#how-does-it-actually-work): the code
