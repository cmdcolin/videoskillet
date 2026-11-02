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

## Amendment: the keyed clamp and the carrier AGC

An independent review of the first version found the grey bar moved but not
changed. It was still the same flat mid-grey, now swinging in smooth curves, and
the extra saturation came mostly from the AGC sitting at its limit and blowing
the picture out to cream and white. The AGC keyed `porch - tip` on picture,
which averages to about zero, so the gain could only pin.

Two circuits were added to the AC-coupled set, both keyed by its own flyback:

- **A keyed black clamp** in `decode`. It samples one subcarrier cycle where the
  oscillator expects the back porch, and black is set from the last 24 such
  samples weighted with an eight-line time constant. On a locked line it reads
  the real porch and nothing changes. On an unlocked line it reads picture, so
  the lines after it go dark or light by however bright that picture was, and
  the bar comes up black, white or grey with the content. A clamp that settled
  in one or two lines pulled about half of the picture to black in hard streaks.
- **A carrier AGC.** The gate measures the detected level ahead of the IF gain
  and the AGC wants full carrier there, where a tip belongs. It holds unity on a
  clean line. On the scrambled channel it settles between about 1.9 and 2.2 and
  moves with what passes under the key. The preset's `agc` went to 1.

The picture is darker. Mean HSL lightness on carnival fell from 49% to 28%,
because the key mostly lands on average picture and the clamp pulls that to
black; saturation rose to 62%, though HSL saturation inflates in dark pixels.
The set has no brightness control to raise the clamp's reference, which is how a
viewer would have answered it.

The review's two bugs are fixed as well. A drifted oscillator offset under -999
read as "no edge" at the AGC key, and switching away from the AC-coupled
separator carried its loop filter and a tip reference above blanking into one
frame of the other separators. Every other preset still renders bit-identical
frames. The clamp's taps are staged once per decode workgroup, and decode on the
scrambled channel went from 0.454 to 0.500 ms (gpuprof, best of runs).
