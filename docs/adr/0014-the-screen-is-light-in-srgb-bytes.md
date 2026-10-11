# 0014 — The screen is linear light, held as sRGB bytes

**Status:** accepted, 2026-10-11.

## Context

`crt_face` and `present` worked on display bytes. Bloom, halation and the glow
floor were sums on the decoded drive, the scanline profile and the grille
multiplied it, and the feedback camera photographed it. A few percent added to a
byte is the same lift on black and on mid grey, so the scatter read as a flat
haze over the whole frame. On the stock look that haze was the greyish cast on
the still photo; on the loop presets it fed back and grew into a wash.

A halo on a tube is light. A few percent of a white's light added beside it is a
visible glow where the glass was black and nothing on a mid grey, because the
eye's response is close to the sRGB curve. The fix is to do the screen stage in
light and encode once, at the window.

Two ways to hold light between passes were weighed:

- **`rgba16float` textures.** Tried for `outTex` during the gamma work
  (`docs/OPTIMIZATIONS.md`), and it halved the sampler's rate across the fifty
  or so taps `crt_face` takes a pixel, giving back most of a millisecond.
- **`rgba8unorm` holding sRGB bytes, read through an `rgba8unorm-srgb` view.**
  The sampler decodes the byte to light for free, the byte keeps fine steps in
  the dark where light lives, and bandwidth stays where it was. `outTex` already
  did this while the gun transfer was on.

The first build moved light. Each pixel gave a share of its own light to its
surround and took the share its neighbours gave up, so a flat field kept its
level, and that build took the glow out of every loop preset. The loop grows
halos out of light the glass gives back, and a faceplate does give light back.
The phosphor emits into the glass, only the escape cone leaves straight away,
and a clear faceplate returns much of the rest. So halation and bloom add light
on top of the direct emission, and a tinted faceplate is a lower control.

## Decision

- `decode` writes `outTex` as light, sRGB-encoded, always. The gun's cutoff and
  gamma shape the drive first, so a preset's gamma means what it did.
- `crt_face` samples `outTex` through the sRGB view, works in light, and writes
  `faceTex` the same way. Bloom and halation add light, keyed to the emitter's
  own brightness; the glow floor adds light; grain and the highlight
  desaturation take their shape from the encoded level, because mid grey is a
  perceptual quantity.
- `present` and `compose` sample `faceTex` through the sRGB view. The beam
  profile and the grille multiply light, and `present` encodes once, on its last
  line. The camera encodes once after its lens, so the sensor chain sees the
  signal it was tuned on.
- `toLight` and `toDrive` in the prelude are the sRGB pair, the same curve the
  view decodes, so a byte written through one and read through the view comes
  back as itself.
- `readFrame` still returns bytes, and they are the display picture.

## Consequences

- A look that leaned on the haze changed. `nightMonitor` and `cometTails` were
  retuned to glow again under the new scale; the two "past the redline" screen
  looks are different pictures and were left as they came out.
- Scanlines at the same `scanBeam` are lighter, because the gap is now a dip in
  light, and `scanBloom` fattens a line by its light, so a mid grey fattens
  less. Both controls' numbers were left alone.
- The phosphor layer, the retrace lines and the loop's lens now run on the sRGB
  curve. Its toe is linear, so the faint end of a long phosphor tail leaves the
  byte sooner than it did on the 2.2 curve, and the camera blurs light before it
  encodes, so every loop preset's edge gain moved a little. The loop and
  phosphor looks shot for this change (fbBloom, strobeTrails, nightTube,
  cometTails, greenTerminal, lightThatStays) hold up; the rest were not surveyed
  one by one.
- The frame costs 0.04 to 0.08 ms more (2 to 3% at stock), measured best-of over
  three interleaved rounds against the previous tree. The sRGB view costs the
  sampler nothing; the whole of it is the encodes, and present's one encode per
  canvas pixel is the largest single item.
- Forbidden: a 16-bit screen texture without a fresh measurement of the
  sampler's rate on `crt_face`; adding bloom, halation or glow in display terms;
  and sampling `outTex` or `faceTex` through a plain view, which hands a pass
  sRGB bytes as if they were light.
