// The hero title's look, as the app's own query string writes it.
// scripts/heroplate.mjs and scripts/buttonplate.mjs both scan their plates
// through it, so the buttons arrive fringed the way the headline is. `vhs`
// underneath for the tape the words arrive on; the rest is layered on top by
// hand.
//
// Nothing here displaces geometry. The stock feedback presets all carry a
// shiftX or a rotate, and on text those spiral the words into an unreadable
// smear within a few laps, so what is below is signal-domain only.
export const PRESET = 'vhs'
export const SET = [
  // The words have to stay words. `vhs` alone takes the luma to 2.8 MHz and
  // 150 ns of jitter, which on a photograph is tape and on a stem is mush, so
  // the bandwidth is opened back up and the timebase steadied under it.
  'lumaMHz:3.4',
  'tbJitterNs:70',
  'tbWowNs:150',
  // And colour has to stay colour. `vhs` runs the whole chroma path under the
  // luma at a 0.5 MHz demod, which is the right bandwidth for a face and far
  // too little for a mark whose only colour is a few thin strokes.
  'demodMHz:0.9',
  'colorUnderMix:0.6',
  'underJitterDeg:2',
  // Colour off the edges: a coarse reconstruction lattice and a dead comb, so
  // the stems fringe rather than the field tinting.
  'chromaCoarse:3',
  'chromaGain:1.5',
  'svideoBleed:0.3',
  'combMode:0',
  'scDetuneKHz:0.5',
  // Sync furniture, at the two edges it belongs on.
  'syncBendUs:1.4',
  'headSwitchShiftUs:2.4',
  'headSwitchNoise:0.45',
  'bendUs:0.25',
  'bendShape:1',
  // The camera loop, at a mix low enough to be a halo rather than a second
  // copy of the words half a letter to the right.
  'fbMix:0.3',
  'fbZoom:1.012',
  'fbGain:1.02',
  'fbFocus:1',
  // And the mixer loop's ring modulator against the box's own subcarrier
  // oscillator, which is where the violet comes from: it translates the
  // letters' brightness up into the chroma band and brings it back as hue.
  // Every lap also arrives one delay late, so this is the knob that smears —
  // 0.4 mix and a quarter-microsecond is as much of it as the type survives.
  'cfbMix:0.4',
  'cfbGain:1',
  'cfbDelayUs:0.25',
  'cfbLines:1',
  'cfbRing:0.9',
  'cfbRingSrc:1',
  'cfbGenlock:1',
].join(',')
