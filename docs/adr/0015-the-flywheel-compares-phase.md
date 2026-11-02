# 0015 — The AC-coupled separator drives a phase comparator

## Status

Accepted.

## Context

The scrambled channel's tearing did not follow the picture. The carrier
scrambler lifts the sync tip to about 40 IRE at 6 dB, so the fixed slicer at -20
IRE finds no edge on any line, the flywheel free-runs, and every line takes the
same phase-noise walk. The blanking interval landed in about the same place on
every line and drew a straight grey bar, whatever the picture held.

On a real set with a capacitor-coupled separator the coupling capacitor charges
to the deepest thing on the line. Once the tip has been lifted, that is the
picture's dark areas, so the separator passes them as sync and the line
oscillator is pulled toward them. Sync-suppression scrambling depended on this:
the set tears along the shadows in the picture.

Two cheaper attempts failed.

- **A per-line clamp slicer feeding the edge hunt.** The hunt starts at a fixed
  position on the line and takes the first crossing, so every line locked to the
  leftmost dark edge whatever the oscillator was doing. The gate latched wide,
  and the result was a fixed function of the picture that did not move.
- **The peak slicer (`syncSlicer` 1).** Its reference is clamped below blanking,
  so it never reaches dark picture above black.

## Decision

Add a third separator, `syncSlicer` 2, and leave the other two as they were.

**The separator slices 10 IRE above the level its capacitor has charged to, with
no ceiling on that level.** On a clean line this is -30 IRE. On a scrambled line
it is a little above the picture's black. At 20 IRE above, it passed every
shadow on the carnival clip and the picture tore past recognition.

**The separated line goes to a phase comparator, and the edge hunt does not
drive the oscillator.** The comparator multiplies the whole separated line by a
line-rate sinusoid centred where the oscillator expects its pulse. A pulse
anywhere on the line therefore pulls according to where it sits relative to the
oscillator, and a dark area half a line away pushes the oscillator off. The
comparator's output depends only on the separated line's first harmonic, so
`sync_measure` computes that harmonic in parallel and the serial walk in `sync`
spends a few multiplies per line on it. The error is divided by the separated
width, with a floor at one pulse width, because the comparator holds its output
on a capacitor: a broad dark area charges the capacitor to the reference's
average across it and pulls toward its own middle, about as hard as a pulse
does.

**The comparator drives the oscillator's frequency through a proportional path
and an integrating capacitor.** A loop that moved phase alone slewed at the
pull-in limit on nearly every scrambled line and drew straight zigzags. With the
integrator, the oscillator keeps its frequency from line to line and overshoots
each pull, so a tear curves. The integrator's state is `timing[AFC_VEL]`.

**The AGC is keyed off the set's flyback,** the position the oscillator drew the
line at a frame earlier. A keyed AGC gate is a flyback pulse, so on an unlocked
set it samples picture where it expects tip and porch, reads a shallow sync, and
turns the gain up to its limit. In the earlier version the AGC was keyed off the
edge hunt, which on a scrambled line found the leftmost dark edge, a position
unrelated to where the set was drawing.

## Consequences

- `scrambledChannel` uses it at `hHold` 0.08. Mean HSL saturation over six
  seconds rose from 26.8% to 46.5% on carnival and from 28.0% to 51.8% on holi.
  Most of the rise comes from the AGC turning the gain up, and with `agc` at 0
  the carnival figure is 29.9%.
- Every other preset renders the same frames, because `syncSlicer` 0 and 1 take
  the same code paths in the same order. The flywheel's free-run branch adds
  `afcVel`, which is held at zero for them.
- `syncMeasureBuf`'s second `vec4f` has no spare slots left. `timingBuf` grew by
  one float.
- The other carrier-family presets still use the fixed slicer. Each needs its
  own hold setting and a look before it switches.
