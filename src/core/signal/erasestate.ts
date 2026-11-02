// A VHS deck whose full-erase head has died, recording over a used tape. The
// video heads lay the new luma FM down hard enough to overwrite the old, but
// colour-under is recorded underneath it at 629 kHz, a wavelength long enough
// to sit deep in the oxide, and only the erase head ahead of the drum was
// there to clear it. So the old recording's colour survives under the new
// one, and the deck plays both back through the same up-converter.
//
// The old tracks were laid by another machine at another time, so they do
// not sit where this deck's tracks do. Their offset along the track wanders
// with that machine's transport, and every sample of it turns the old colour
// by a 23rd of a cycle at the under carrier, so the old picture's hue crawls.
// That machine's line rate also differed slightly, so the offset grows down
// the field and draws the hue error as bands. Where the old burst lands on
// the new one, the decoder takes its reference off the sum, and the new
// picture's hue wobbles with the slip as well.
//
// What the tape held before is this program from earlier: the engine keeps a
// copy of the colour-under track and renews it at random cuts.

import { hash01, valueNoise } from './noise'

export interface OldRecordingUniforms {
  eraseOld: number
  eraseSlip: number
  eraseSlope: number
}

// Mean seconds between cuts in the old programme.
const CUT_S = 6
// How far the old tracks wander along this deck's, in samples, slow then fast.
const SLIP_SLOW = 30
const SLIP_FAST = 6
// The old machine's line-rate error, as samples gained per line.
const SLOPE = 0.06

export class OldRecording {
  private engaged = false

  // `capture` says the engine should copy the colour-under track now.
  update(
    frame: number,
    survival: number,
    colourUnder: boolean,
  ): { uniforms: OldRecordingUniforms; capture: boolean } {
    const t = frame / 60
    const on = survival > 0 && colourUnder
    const capture =
      on && (!this.engaged || hash01(frame, 0xe7a5) < 1 / (CUT_S * 60))
    this.engaged = on
    return {
      uniforms: {
        eraseOld: on ? survival : 0,
        eraseSlip:
          SLIP_SLOW * valueNoise(t * 0.15, 61) +
          SLIP_FAST * valueNoise(t * 0.9, 62),
        eraseSlope: SLOPE * valueNoise(t * 0.1, 63),
      },
      capture,
    }
  }
}
