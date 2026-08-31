// Screening the family `ring in the highlights` belongs to: a nonlinearity in
// the loop, plus a gate the picture itself decides, so the nonlinearity is only
// allowed to fire where the picture says. Three rounds; this is the third, with
// what the first two taught written into it.
//
//   node scripts/contact.mjs scripts/candidates.keyedring.mjs docs/contact/keyedring <url>
//
// What the rounds taught, in order of how much it changed the search:
//
//  - **The nonlinearity does not have to be the ring.** Round one's clearest
//    new look was `warp in the highlights` — the varactor (`cfbServoUs`) keyed
//    instead of the multiplier, so geometry bends where the picture was lit and
//    the shadows stay registered — and its most distinct was `rungs in the
//    highlights`, alternating-polarity generations confined to the lit areas.
//    The recipe is the gate, not the ring.
//  - **Keying the loop's self-oscillation swamps the picture until it is well
//    under the redline.** At Q .82 / boost 2.4 round one rendered a flickering
//    white mesh with no picture in it (mean 132, motion 31.9). At Q .55 /
//    boost 1.1 the same patch puts a fine dotted mesh on the white chest and
//    the lit window and leaves everything else photographic, which is what the
//    key was for.
//  - **The mixer's multiplier cannot be keyed on anything legible.** `bRing`
//    gated on saturation (`bKey` with the acceptance wide open, so only
//    `bKeyClip` discriminates) shows B's slip seam and not a content-shaped
//    territory: the chroma keyer reads B's chroma alone, and on the dirty path
//    B is walking. The loop is where a keyed product has something to key on.
//  - **Half the crosses are retunes of the anchor, not looks.** `keyed and bent
//    by the same brightness` (differential phase under the key) departed 15.8
//    against the anchor's 16.3 and looks like it; `slice at the midtones` is
//    the same trails over more of the frame. A cross has to change what the
//    boundary *is*, not where it sits.
//  - **`select` in a keyer aperture reads both arms.** Round two lost two tiles
//    to `Target closed` because the loop keyer's aperture selected between
//    `prev` and `comp`, so even the self-key was reading `comp` at the
//    neighbours of a sample every other invocation was about to write. The
//    anchor is in the sheet as the regression check for that: depart 16.3,
//    sd 65.0, mean 99, sat 70, which is where it sat before any of this.
//
// The source is a still photo, so `static-from-start` and a low `motion` are
// properties of the source and mean nothing here — the anchor carries both.

export default {
  src: 'cat',
  srcb: 'none',
  frames: 420,
  settle: 4000,
  late: 1000,
  items: [
    { name: 'ref clean', blurb: 'the source, untouched', set: '' },
    {
      name: 'anchor ring in the highlights',
      blurb: 'regression: the shipped preset, luma self-key',
      set: 'cfbMix:0.82,cfbGain:0.92,cfbDelayUs:1.1,cfbLines:1,cfbRing:1,cfbKey:1,cfbKeyLevel:50,cfbKeySoft:10,chromaGain:1.8,phosphor:0.5',
    },
    {
      name: 'keyed on its own colour',
      blurb: 'the loop keyer slicing hue instead of level',
      set: 'cfbMix:0.8,cfbGain:0.95,cfbDelayUs:1.1,cfbLines:1,cfbRing:0.9,cfbKey:1,cfbKeyAcceptDeg:60,cfbKeyHueDeg:180,cfbKeySoft:10,chromaGain:1.6,phosphor:0.5',
    },
    {
      name: 'hue chase narrow',
      blurb: 'a thin wedge: only what shares that phase regenerates',
      set: 'cfbMix:0.9,cfbGain:1.04,cfbDelayUs:1.4,cfbLines:1,cfbRing:0.9,cfbKey:1,cfbKeyAcceptDeg:26,cfbKeyHueDeg:180,cfbKeySoft:6,chromaGain:1.7,phosphor:0.6',
    },
    {
      name: 'hue chase inverted',
      blurb: 'a wide wedge inverted, so what is left out is narrow',
      set: 'cfbMix:0.62,cfbGain:0.95,cfbDelayUs:1.1,cfbLines:1,cfbRing:0.8,cfbKey:-1,cfbKeyAcceptDeg:140,cfbKeyHueDeg:180,cfbKeySoft:12,chromaGain:1.5,phosphor:0.5',
    },
    {
      name: 'carved by the live picture',
      blurb:
        "the key input on program: the territory drawn by now, not by the loop's own past",
      set: 'cfbMix:0.82,cfbGain:0.92,cfbDelayUs:1.1,cfbLines:1,cfbRing:1,cfbKey:1,cfbKeyExt:1,cfbKeyLevel:50,cfbKeySoft:10,chromaGain:1.8,phosphor:0.5',
    },
    {
      name: 'carved inverted',
      blurb:
        'the live subject holding a clean hole in an accumulation that churns round it',
      set: 'cfbMix:0.85,cfbGain:1,cfbDelayUs:0.8,cfbLines:2,cfbRing:1,cfbKey:-1,cfbKeyExt:1,cfbKeyLevel:42,cfbKeySoft:12,chromaGain:1.6,phosphor:0.45',
    },
    {
      name: 'carved by the live colour',
      blurb:
        "both connectors: the live picture's hue decides, keyed on red at 103 degrees",
      set: 'cfbMix:0.86,cfbGain:1,cfbDelayUs:1.1,cfbLines:1,cfbRing:1,cfbKey:1,cfbKeyExt:1,cfbKeyAcceptDeg:40,cfbKeyHueDeg:103,cfbKeySoft:10,chromaGain:1.7,phosphor:0.5',
    },
    {
      name: 'ringing in the highlights',
      blurb:
        'the loop self-oscillating, under the redline, only where the picture is lit',
      set: 'cfbMix:0.7,cfbGain:0.95,cfbDelayUs:0.3,cfbLines:1,cfbFilterMHz:2.6,cfbFilterQ:0.55,cfbFilterBoost:1.1,cfbKey:1,cfbKeyLevel:58,cfbKeySoft:8,chromaGain:1.4,phosphor:0.45',
    },
    {
      name: 'warp in the highlights',
      blurb:
        'the varactor keyed instead of the multiplier: geometry bent where it was bright',
      set: 'cfbMix:0.8,cfbGain:0.98,cfbDelayUs:1,cfbLines:1,cfbServoUs:44,cfbKey:1,cfbKeyLevel:50,cfbKeySoft:12,chromaGain:1.3,phosphor:0.45',
    },
    {
      name: 'warp in the shadows',
      blurb:
        'the same varactor keyed the other way up, so the pull lands on sync',
      set: 'cfbMix:0.85,cfbGain:1,cfbDelayUs:0.8,cfbLines:2,cfbServoUs:36,cfbKey:-1,cfbKeyLevel:30,cfbKeySoft:14,chromaGain:1.5,phosphor:0.45',
    },
    {
      name: 'rungs in the highlights',
      blurb: 'alternating-polarity generations confined to the lit areas',
      set: 'cfbMix:0.8,cfbGain:-1.08,cfbDelayUs:1.2,cfbLines:60,cfbRing:0.9,cfbKey:1,cfbKeyLevel:48,cfbKeySoft:8,chromaGain:1.6,phosphor:0.3',
    },
  ],
}
