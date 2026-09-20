# Using a MIDI controller

A box of knobs gives you both hands and lets you stop looking at the panel.

## Requirements

Any USB controller that sends **CC messages** (Control Change, the standard way
a knob reports its position): a MIDI Fighter Twister, a nanoKONTROL, a Launch
Control, the knob row on a keyboard. Plug it in before or after loading the
page. You also need **Web MIDI**, which means Chrome or Edge.

## Connecting

Press **midi** at the top of the panel, beside **sign in** (or `ctrl+k` →
"midi"), click **connect a controller**, and allow the browser prompt. You
connect once and the app reconnects on later visits.

The card is not modal, so you can bind the controls behind it while it is up.

The **midi** button lights green once connected, and shows **3 waiting** in
amber when knobs have lost their catch (see [Soft takeover](#soft-takeover)).
**n/a** means no Web MIDI in this browser, and **refused** means the browser
denied access.

## Binding one knob

Each slider has a **⚟** button. Click it and wiggle the knob, and the button
reads **CC7**; `Esc` cancels. **×** in the midi card unbinds, and clicking
**CC7** re-learns, so a control can move to another knob without unbinding
first.

One knob drives one thing. Bind a knob that was already driving something and it
moves to the new control, and two controls moving together means both are on the
same CC.

## The motion amount and preset weights

The **amount** fader in the Modulation section scales every modulation routing
at once and carries the same **⚟**.

Every preset is a fader too. Choose one in the midi card's preset picker, click
**⚟ preset mix** and move a knob, and that knob moves everything the preset
touches. Weights layer across knobs.

The motion amount and a preset weight do no soft takeover, and both grab on the
first message. A weight also resets once anything else moves the board, so the
next turn starts a fresh mix from what is on screen.

## Pads and keys

A gesture goes on a pad or a key: pick one in the midi card's gesture picker,
click **⚟ pad**, hit the pad. The picker lists the modulation bay's one-shot
envelopes, all at once or a slot at a time; the source cue and the jump back to
it that `i` and `o` do from the keyboard; and the transitions. Velocity carries,
so a soft hit is a small envelope, and pads do no soft takeover, since there is
no value to catch up to.

**With nothing bound, any note fires the whole bay.** Bind one pad and notes
then fire only what the card lists.

## Mapping the whole device

**auto-map** and **learn in order** each **wipe every knob binding** first, with
no confirmation. Pads are left alone, and **clear all bindings** takes both.

- **auto-map** is for a MIDI Fighter Twister. It assigns the first 64 controls,
  motion amount first and the rest in signal-path order, to CC 0–63 on channel 1
  across all four banks.
- **learn in order** works with anything: sweep your knobs one at a time and
  each takes the next control down the same list. A knob bumped by accident is
  consumed with no going back a step. **stop learning** or `Esc` keeps what you
  have bound.

There are more controls than most controllers have knobs, so some stay
mouse-only.

## Soft takeover

A knob that does nothing when you turn it has not caught its control yet: a knob
at 3 o'clock cannot report that the value is at 10 o'clock, so it stays inert
until you sweep it **through** the current value. An **amber mark** on the track
shows where the knob is waiting, and the card lists its name in amber.

Knobs lose their catch whenever a value is set from elsewhere: loading a preset,
recalling a save, undoing, randomising.

A CC is 7 bits, so a knob has 128 positions. On a coarse-stepped slider several
of them land on the same value, and the reading moves in jumps.

## Locking a rate to the beat

The tempo comes from **MIDI clock** if anything is sending it (the card shows
**♩ 128.0**), otherwise from the top of the **MODULATION** box on the
signal-path map, where you type it or **tap** four times. Clock takes precedence
while it runs, and the hand-set number applies again once it stops. Asking for a
lock with no tempo sets one at 120 BPM. The app counts clock ticks, ignores
start and continue, and sends no clock.

**sweep**, **line offset**, **blanking strobe** and any modulation slot's rate
each carry a **♩** in their **⋮** menu, cycling 1/1 → 1/16 → off. A lock sets
the Hz you dialled in aside and gives it back when you unlock. A division that
works out higher than the control's range is clamped to the top of it: a slot's
rate stops at 10 Hz, which 1/16 reaches at 150 BPM.

## Storage

Knob bindings, pad bindings, the hand-set tempo and the clock locks are saved in
this browser. They are **not** in presets, saved looks or the URL, and there is
no way to export a mapping. A modulation slot's lock is the exception, and
travels with the link.

## Limitations

- **CC and notes only**: pitch bend, program change and aftertouch do nothing,
  and a note is an on/off with a velocity, with no note-off handling.
- **Absolute knobs only**: endless encoders in relative mode will jump around.
- **No LED feedback**: nothing is sent back to the device.
- **No device picker**: everything plugged in drives the app at once.
- **No per-knob range, invert or curve.**
