// Shared WGSL prelude prepended to every shader, and the matching uniform
// packer. PARAM_DEFS is the single source of truth for the Params struct:
// field order here IS the GPU memory layout.

import { CC_CR } from '../signal/captionstate'
import {
  ACTIVE_HEIGHT,
  ACTIVE_START,
  ACTIVE_TOP,
  ACTIVE_WIDTH,
  BURST_AMP_IRE,
  BURST_LEN,
  BURST_START,
  HEAD_SWITCH_LINE,
  IRE_BLACK,
  IRE_BLANK,
  IRE_SYNC,
  IRE_VIDEO_RANGE,
  LINES,
  SAMPLES_PER_LINE,
  SYNC_LEN,
  VSYNC_FIRST,
  VSYNC_LAST,
  usToSamples,
} from '../signal/constants'
import {
  CIPHER_AXIS_IRE,
  CIPHER_DATA_IRE,
  CIPHER_GAIN,
  CIPHER_PORCH_BIAS_IRE,
  HBI_DATA_CELL,
  SIGMA_CLOCK_CELLS,
  SIGMA_DATA_CELLS,
  SIGMA_DATA_IRE,
  SIGMA_DATA_SWING_IRE,
  SIGMA_PORCH_BIAS_IRE,
} from '../signal/datasync'
import {
  FILTER_STRIDE,
  SEC_CHROMA_BP,
  SEC_DEMOD,
  SEC_ENC_CHROMA,
  SEC_LUMA,
  SEC_TAKEOFF,
  SEC_UNDER,
  TAPS,
} from '../signal/filters'
import { DOWN_PER_SAMPLE } from '../signal/linestate'
import { MIX_POT_OHMS, POT_OHMS } from '../signal/pot'
import { SERIES_CAP_LOAD, SERIES_CAP_REACH } from '../signal/seriescap'
import {
  CC_BLOCK,
  CC_CELLS,
  CC_COLS,
  CC_CURSOR,
  CC_PAGE,
  CC_ROWS,
  CC_SET,
  GLYPH_COUNT,
  GLYPH_H,
  GLYPH_W,
} from './captionrom'

export const PARAM_DEFS = [
  ['frame', 'u32'],
  ['gen', 'u32'], // dub generation index: decorrelates noise/dropout seeds per pass
  ['lastGen', 'u32'], // the generation the set plays back, the one the cable faults act on
  ['canvasW', 'f32'],
  ['canvasH', 'f32'],
  ['srcAspect', 'f32'],
  // 1 reads source A right to left. A camera facing the person it films shows
  // them a mirror, and the mirror belongs to the camera: the set still scans
  // left to right, so ghosts and smears keep trailing the way a set draws them.
  ['srcMirror', 'f32'],
  // 1 stands the set on its side, the way an arcade cabinet mounts a tube for
  // a tall picture, with source A's camera turned to match. The raster keeps
  // its own axes, so the scan runs down the glass and a roll goes sideways.
  ['tubeTurn', 'f32'],
  // Source A's lens zoom, 1 = the whole frame. A camera zoomed past what its
  // own lens reaches crops here, before the encoder, as a longer lens would.
  ['srcZoom', 'f32'],
  // The share of the glass's width on show, 1 = the whole set. Below 1 the
  // canvas shows an upright slice down the middle of the glass, and source A is
  // fitted into that slice, so a phone held upright keeps its scan horizontal.
  ['sliceW', 'f32'],
  ['srcNoise', 'f32'], // GPU-generated source A: 0 texture, 1 TV static, 2 VHS blank-tape static
  // The statistics of that generated noise, shared by both slots. Noise cannot
  // change faster than the path it arrived through lets it, so the grain is a
  // bandwidth: srcNoiseGrain is the correlation length that bandwidth implies,
  // in active pixels, converted at the packing boundary.
  ['srcNoiseGrain', 'f32'],
  ['srcNoiseLine', 'f32'], // share of the deviate that is one gain error per sweep
  ['srcNoiseLevel', 'f32'], // noise power reaching the detector, 1 = nominal
  ['srcNoiseHold', 'f32'], // display frames per noise field: the source's own refresh
  // Tape time: the frame counter the damage recorded on a deck's own medium
  // crawls on, held while that deck is paused (a held frame re-reads one track,
  // so its snow and its dropouts have to come back identical). The program
  // buffer carries A's; each feed's buffer carries that feed's deck's.
  ['srcFrame', 'u32'],
  ['invert', 'f32'], // source A polarity flip: negate composite (0.5 = solarized)
  ['deint', 'f32'], // bob-deinterlace source A: rebuild from one field, killing capture combing
  // What source A's file already carried in from the deck it was captured off:
  // the bands as Gaussian sigmas in active samples (0 = not through a capture),
  // chroma's lag in samples, and the two paths' noise as fractions of white.
  ['capLumaSigma', 'f32'],
  ['capChromaSigma', 'f32'],
  ['capYcDelay', 'f32'],
  ['capNoise', 'f32'],
  ['capChromaNoise', 'f32'],
  // Video synth: a bench oscillator patched into a slot instead of a picture
  // (mode 3 of the same srcNoise selector). Each oscillator's phase is carried
  // as cycles at frame start plus its walk per line and per sample, rather than
  // as one frequency, for two reasons. Precision: phase at the far corner of a
  // frame is 477750 samples of accumulation, and an f32 stops resolving a
  // subcarrier-rate phase long before it gets there. And honesty: the per-line
  // walk IS the lean of the pattern — an oscillator sitting an exact multiple of
  // line rate walks zero per line and draws standing bars, and everything
  // diagonal on screen is that number being something else.
  ['synthPhaseA', 'f32'], // osc A phase at frame start, cycles (accumulated)
  ['synthPerLineA', 'f32'], // osc A phase walk per line, cycles
  ['synthPerSampleA', 'f32'], // osc A phase walk per sample, cycles
  ['synthPhaseB', 'f32'],
  ['synthPerLineB', 'f32'],
  ['synthPerSampleB', 'f32'],
  ['synthShape', 'f32'], // waveform selector: 0 ramp, 1 triangle, 2 sine, 3 pulse
  ['synthMix', 'f32'], // combiner: 0 osc A alone, 1 sum, 2 ring mod, 3 comparator
  ['synthLevel', 'f32'], // output contrast about mid-video
  ['synthColor', 'f32'], // colorizer depth: 0 monochrome .. 1 full three-phase
  ['synthHue', 'f32'], // colorizer rotation, radians
  // The synth as a module over a picture rather than instead of one. Slot A
  // only: compose has the slot's picture in hand, and compose_b writes its
  // texture rather than reading it, so B keeps the source mode alone.
  ['synthOver', 'f32'], // synth crossfaded over the slot's picture
  ['synthFm', 'f32'], // that picture's luma into osc A's frequency, cycles/sample
  ['synthFmSrc', 'f32'], // which picture the FM input is on: 0 the slot, 1 the camera's return
  ['synthColorSrc', 'f32'], // what the colorizer slices: 0 its oscillator, 1 the picture
  ['synthColorMode', 'f32'], // how: 0 three phase shifts, 1 three comparators
  ['synthColorSoft', 'f32'], // the box's own lowpass ahead of the slicer, output pixels
  ['synthJitA', 'f32'], // osc A timing jitter as cycles of its own phase per unit of noise
  ['synthJitB', 'f32'],
  ['synthBSrc', 'f32'], // the combiner's second input: 0 osc B, 1 diamond, 2 circle, 3 rectangle
  ['synthShapeX', 'f32'], // the shape's centre, -1..1 across the picture
  ['synthShapeY', 'f32'],
  ['synthShapeSize', 'f32'], // the ramps' gain: level 1 lands this far in from the edge
  ['synthShapeFold', 'f32'], // wavefolder after the shape generator: 1 passes it straight
  ['synthDirt', 'f32'], // how far the synth's circuits are from ideal, 0..1
  ['synthDelay', 'f32'], // the synth's output into a delay line on A's cable: samples of delay at full level
  ['synthVca', 'f32'], // the synth's output into a VCA on A's cable: gain lost at full level
  ['synthSync', 'f32'], // the synth's output subtracted from A's cable: IRE pulled down at full level
  ['synthCvSrc', 'f32'], // the control input of those three boxes: 0 the synth, 1 A's picture, 2 B's
  // dirty mixer: source B is a second, non-genlocked composite signal
  ['srcNoiseB', 'f32'], // GPU-generated source B: 0 texture, 1 TV static, 2 VHS blank-tape static
  ['aGain', 'f32'], // A level on the summing bus, signed (negative inverts A)
  ['bGain', 'f32'], // additive mix gain
  ['bRing', 'f32'], // ring modulation amount
  ['busClip', 'f32'], // how little headroom the summing amplifier has, 0 = plenty
  ['busCut', 'f32'], // the bus is switched to B for this fraction of the frame, from the bottom
  ['busBounce', 'f32'], // how worn the relay's contacts are: 0 a clean make, 1 forty lines of chatter
  ['bLeak', 'f32'], // stray-capacitance leak of B onto the bus, whatever the fader says
  ['bWanderTop', 'f32'], // B's own clock error at the top of the frame, samples
  ['bWanderBottom', 'f32'], // and at the bottom, samples
  ['bCapture', 'f32'], // the genlock's capture range, samples
  ['bRowOff', 'f32'], // vertical slip, lines (accumulated)
  ['bShift0', 'f32'], // horizontal slip, samples (accumulated)
  ['bShiftLine', 'f32'], // horizontal skew per line (line-frequency offset)
  ['bPhase0', 'f32'], // subcarrier detune phase base (accumulated)
  ['bPhaseLine', 'f32'], // subcarrier detune phase per line
  ['bHue', 'f32'], // B proc-amp hue trim, radians
  ['bVidGain', 'f32'], // B proc-amp video gain
  ['bInv', 'f32'], // B video inversion amount (0.5 = solarized midpoint)
  ['deintB', 'f32'], // bob-deinterlace source B: the same field rebuild `deint` does for A
  ['bPause', 'f32'], // B deck's pause button: 0 play, >0 held frame with servo damage
  ['bPauseBar', 'f32'], // head-mistrack stripe centre, source rows (walks on its own)
  ['bGenlock', 'f32'], // 0 dirty sum, 1 clean genlocked crossfade (dissolve/wipe)
  ['wipeMode', 'f32'], // 0 off, 1 h, 2 v, 3 box, 4 diamond
  ['wipePos', 'f32'], // wipe position incl. auto-sweep (accumulated)
  ['wipeSoft', 'f32'], // wipe edge softness
  // picture-in-picture: source B squeezed into a positionable window, re-encoded
  // genlocked to the house raster (a DVE/switcher inset — dot-crawls, no beat)
  ['pipMix', 'f32'], // inset key over program, 0 off
  ['pipX', 'f32'], // window center X, active-picture UV
  ['pipY', 'f32'], // window center Y, active-picture UV
  ['pipW', 'f32'], // window width, active-picture UV
  ['pipH', 'f32'], // window height, active-picture UV
  ['pipBorder', 'f32'], // matte border thickness, active-picture UV
  ['pipSoft', 'f32'], // window edge softness, active-picture UV
  ['pipKey', 'f32'], // inset luma key amount, negative inverts polarity
  ['pipKeyLevel', 'f32'], // inset luma key slice, 0..1
  ['pipKeySoft', 'f32'], // inset luma key edge softness, luma units
  // Chroma keyer across the mixer: B's backing colour cut away so A shows
  // through it. Slices B's *encoded* chroma, not the RGB behind it — see
  // mix_b.wgsl for what that costs the edge, which is the whole look.
  ['bKey', 'f32'], // key amount, negative inverts which side is cut
  ['bKeyHue', 'f32'], // backing colour's chroma phase, radians (atan2(V, U))
  ['bKeyAccept', 'f32'], // acceptance half-angle about that phase, radians
  ['bKeyClip', 'f32'], // saturation floor the keyer will act on, chroma units
  ['bKeySoft', 'f32'], // comparator swing: edge softness in both angle and saturation
  ['bKeySpill', 'f32'], // chroma canceller: backing subcarrier reinjected antiphase
  ['bKeyDelay', 'f32'], // key-vs-fill horizontal registration, samples
  ['bKeySource', 'f32'], // 0 the chroma slice of B, 1 B's alpha on the external key input
  ['bKeyAdditive', 'f32'], // 0 comparator, 1 additive: backing subtracted, fill added under a proportional matte; 0 while the key is external
  ['bKeyLevel', 'f32'], // additive: the backing's chroma at full light, chroma units
  ['bKeyBackY', 'f32'], // additive: the backing's luma at that level, 0..1
  ['bKeyFeed', 'f32'], // 1 while B's feed is damaging its waveform, so the keyer demodulates the damage
  ['bKeyEdge', 'f32'], // key edge generator: 0 off, 1 border, 2 drop shadow, 3 extrude
  ['bKeyEdgeH', 'f32'], // its horizontal delay, samples
  ['bKeyEdgeV', 'f32'], // its vertical delay, lines
  ['bKeyEdgeY', 'f32'], // its matte luma, 0..1
  ['bKeyEdgeHue', 'f32'], // its matte chroma phase, radians
  ['bKeyEdgeSat', 'f32'], // its matte chroma amplitude, chroma units
  // The keyer's fill input — what shows through the hole. Genlocked path only,
  // because only a crossfade has a "behind" for a fill to be: the dirty sum has
  // no layers, so there the key gates B's contribution and A is simply always
  // present. 0 program A, 1 matte generator, 2 the mixer loop bus.
  ['bKeyFill', 'f32'],
  ['bKeyMatteY', 'f32'], // matte luma, 0..1
  ['bKeyMatteHue', 'f32'], // matte chroma phase, radians
  ['bKeyMatteSat', 'f32'], // matte chroma amplitude, chroma units
  ['bKeyFillHue', 'f32'], // frame store output's hue trim, radians
  ['bKeyFillMixA', 'f32'], // program A crossfaded into a store fill, 0..1
  ['bKeyFillFlip', 'f32'], // 1 when colour framing inverts the store's chroma this frame
  // VHS tracking error: a mistracked head produces a noise band that tears and
  // bends the picture at an adjustable height (the "tracking" knob).
  ['trackAmt', 'f32'], // severity, 0 locked
  ['trackPos', 'f32'], // band vertical position, 0..1
  // VHS picture search: off play speed each head sweep crosses several
  // recorded tracks; the RF envelope nulls at every crossing.
  ['shuttleBars', 'f32'], // track crossings per field, signed (shuttle speed - 1)
  ['shuttlePhase', 'f32'], // crossing pattern phase, in crossings
  // decoder
  ['combMode', 'f32'], // 0 chroma trap, 1 two-line comb, 2 three-line comb
  ['hHold', 'f32'], // sync PLL gain (horizontal hold)
  ['syncSlicer', 'f32'], // 0 fixed slice, 1 peak-following slice, 2 AC-coupled phase comparator
  ['vHold', 'f32'], // vertical oscillator pull-in gain (vertical hold lock strength)
  ['vRollRate', 'f32'], // free-run roll velocity, lines/frame, from the v-osc detune
  ['syncBend', 'f32'], // PLL kick at the vertical seam, samples (flagging)
  // deflection geometry: tube-side scan distortion, downstream of the decoder,
  // so it bends the picture without moving the burst gate or spinning hue
  ['bendAmt', 'f32'], // horizontal displacement amplitude, samples
  ['bendShape', 'f32'], // 0 flag, 1 skew, 2 bow, 3 sine
  ['bendPeriod', 'f32'], // flag decay constant / sine period, screen lines
  ['vSize', 'f32'], // vertical deflection amplitude: <1 underscans, raster and retrace come into view
  ['vLin', 'f32'], // vertical linearity: curvature of the yoke's sawtooth, top compressed and bottom stretched when positive
  ['vFold', 'f32'], // vertical output saturation: 0 none, 1 the sweep stops a quarter of the way down and folds back over the top
  ['retrace', 'f32'], // blanking pulse lost: the vertical flyback draws, at this fraction of the coupling's resting level
  ['flyback', 'f32'], // line times the vertical flyback takes
  ['hvSag', 'f32'], // beam-current deflection sag amplitude, samples
  ['hvRing', 'f32'], // supply damping: 0 smooth droop .. 1 ringing / chaotic
  ['hRate', 'f32'], // horizontal oscillator free-run drift, samples/line
  // audio patched into the receiver, one sample per line
  ['audioBend', 'f32'], // direct horizontal displacement, samples
  ['audioLoad', 'f32'], // audio driven into the HV tank alongside beam current
  ['audioIre', 'f32'], // audio patched straight into the composite line, IRE per unit
  ['audioHue', 'f32'], // audio driven into the demod reference phase, radians per unit
  ['chromaGain', 'f32'],
  ['burstLock', 'f32'], // 0..1: how much the decoder trusts the (degraded) burst
  ['tint', 'f32'], // the set's tint control: demod reference rotated, radians (PI = complementary)
  ['demodAxis', 'f32'], // angle between the two synchronous demod axes, radians (PI/2 = quadrature)
  ['matrixClip', 'f32'], // RGB output stage: 0 hue-preserving fit .. 1 hard per-gun rails
  ['scDetunePhase', 'f32'], // bent-crystal demod LO phase error at frame start, radians (accumulated)
  ['scDetunePerSample', 'f32'], // LO phase error growth per sample, radians
  ['killThresh', 'f32'], // IRE of burst amplitude below which color killer engages
  // The VIR corrector: a set trimming its own hue and saturation off the
  // reference on line 19, and getting it wrong when the reference is damaged.
  ['vir', 'f32'], // how far the set trusts the reference, 0 = not a VIR set
  ['virLag', 'f32'], // the corrector's time constant, frames
  ['accLines', 'f32'], // chroma AGC time constant, lines of burst memory (0 = instantaneous)
  ['afpcLines', 'f32'], // burst phase lock time constant, lines (0 = per line)
  ['svideoBleed', 'f32'], // luma takeoff fault: 0.5 subtracts no chroma, 1 adds it back
  ['chromaCoarse', 'f32'], // chroma demod decimation factor; >1 lerps between lattice points (CUE rainbows)
  ['demodReach', 'u32'], // taps either side of the demod kernel's centre that can be nonzero (filters.ts demodReach)
  // channel / tape
  ['soundIre', 'f32'], // 4.5 MHz sound carrier leaking past the trap, IRE
  // RF front end: what the tuner hands the detector besides our own channel
  ['rfSoften', 'f32'], // mistuned low: the Nyquist-slope high cut on the luma path, 0..1
  ['rfIntermod', 'f32'], // detector intermod depth: the loose sound carrier multiplied against the video
  ['rfAdjIre', 'f32'], // adjacent-channel leak: beat amplitude at the neighbour's peak carrier, IRE
  ['rfAdjEps', 'f32'], // the neighbour's line rate vs ours, fractional offset (CPU-wandered)
  ['rfAdjTau', 'f32'], // the neighbour raster's time offset at frame start, samples (accumulated)
  ['rfAdjPhase', 'f32'], // their vision-carrier beat phase at frame start, radians (accumulated)
  ['rfAdjPhaseS', 'f32'], // their sound-carrier beat phase, radians (their audio FM rides here)
  ['rfSnow', 'f32'], // weak signal: IF noise into the envelope detector (Rician, whites first)
  ['ingressIre', 'f32'], // shield ingress: the radio's carrier amplitude, IRE
  ['ingressKey', 'f32'], // whether the mic is keyed right now, 0..1 (CPU-walked stretches)
  ['ingressCps', 'f32'], // its visible beat frequency, cycles/sample (wanders)
  ['ingressRowCyc', 'f32'], // fract(cps * SPL): the beat's per-line phase step
  ['ingressPhase', 'f32'], // beat phase at frame start, radians (accumulated)
  ['agc', 'f32'], // receiver AGC action, 0 fixed gain .. 1 full
  ['abl', 'f32'], // beam limiter: 0 generous flyback .. 1 undersized and underdamped (hunts)
  ['noiseSigma', 'f32'], // additive noise, IRE rms
  // The floor's spectrum, as the two output weights of a lowpass and a highpass
  // arm sharing the same deviates: an IF-limited RF floor is flat to the top of
  // the video band, an FM discriminator's is triangular. Normalized CPU-side so
  // the tilt changes the noise's colour without changing its level.
  ['noiseLoW', 'f32'],
  ['noiseHiW', 'f32'],
  ['impulseRate', 'f32'], // impulse (ignition/arc) noise events per frame, storm-clustered CPU-side
  ['impulseIre', 'f32'], // impulse peak amplitude, IRE
  ['impulseTrainPos', 'f32'], // ignition train: sample offset of the frame's first event
  ['impulseTrainStep', 'f32'], // ignition train: samples between events (0 = no train)
  ['impulseMains', 'f32'], // random hits bunched at the dimmer's mains firing phase
  ['strikeRate', 'f32'], // millisecond multi-line strikes per second
  ['ghostDelay', 'f32'], // samples
  ['ghostGain', 'f32'],
  ['humAmp', 'f32'], // IRE
  ['humMod', 'f32'], // supply-ripple gain modulation depth (multiplies, sync included)
  ['colorUnderMix', 'f32'], // 0 direct chroma .. 1 full VHS color-under path
  ['chromaNoise', 'f32'], // noise injected into the color-under signal, IRE rms
  ['dropoutRate', 'f32'], // expected dropout events per frame
  ['dropoutLen', 'f32'], // mean dropout length, samples
  ['dropoutComp', 'f32'], // dropout compensator delay: 0 none, 1 one line, 2 two
  ['headSwitchNoise', 'f32'], // 0..1
  ['headClog', 'f32'], // one of the two video heads clogged: its alternate-sweep RF collapses to snow
  ['ycDelay', 'f32'], // chroma-path group delay vs luma, whole samples (colour displaced, hue held)
  ['diffGain', 'f32'], // differential gain: fraction of chroma gain lost at peak luma
  ['diffPhase', 'f32'], // differential phase: chroma phase swing at peak luma, radians
  ['fmOverdev', 'f32'], // FM over-deviation: 0 off .. 1 white clip set far too hot
  ['fmStreak', 'f32'], // inversion-streak recovery (deemphasis) time constant, samples
  ['polarityFlip', 'f32'], // hard signal/ground swap: negate whole composite incl. sync
  ['termination', 'f32'], // cable termination fault: <0 double-terminated (dim), >0 open (hot + ringing)
  ['chromaPinOnly', 'f32'], // which pin of the S-video lead lost its contact: above 0 luma and sync, below 0 colour and burst
  ['bChromaPin', 'f32'], // B's S-video pin, for mix_b's models of B's wire (a feed reads its own in chromaPinOnly)
  ['connectorGlitch', 'f32'], // loose connector: intermittent contact drops bands to snow
  ['connectorMode', 'f32'], // which contact: 0 centre pin (signal + sync go), 1 shell (ground lifts, hum injects), 2 both, and on a feed 3 an S-video lead's luma pin, 4 its chroma pin
  ['potOhms', 'f32'], // a feed's series pot: the wiper's resistance this frame, ohms (feeds only)
  ['potSpeed', 'f32'], // how fast the wiper is moving, travel per second (feeds only)
  ['seriesCap', 'f32'], // a capacitor in series with a feed's lead: what its charge holds per sample, 0 a wire (feeds only)
  ['mixPot', 'f32'], // dirty sum through a passive pot crossfader: 0 the bus faders, 1 the pot
  ['mixPotTravel', 'f32'], // the crossfader wiper this frame, 0 all A .. 1 all B
  ['mixPotSpeed', 'f32'], // how fast that wiper is moving, travel per second
  ['scramble', 'f32'], // head-end sync suppression depth: sync tip lifted toward blanking
  ['decoderDb', 'f32'], // descrambler box gain inside the carrier gate, dB
  ['scrambleMode', 'f32'], // 0 gated, 1 line-alternate, 2 SSAVI (suppression + video inversion), 3 carrier (RF attenuation over H blanking + VBI), 4 tri-mode, 5 sine, 6 keyed SSAVI, 7 line delay (feeds), 8 Oak Sigma, 9 VideoCipher II
  // copy protection authored onto the source tape's vertical interval
  ['mvAgcIre', 'f32'], // Macrovision AGC-pulse level at full cycle, IRE (0 = unprotected)
  ['mvStripe', 'f32'], // colorstripe burst rotation on walking line bands, radians
  ['vbi', 'f32'], // VBI test signals: VITS on 17-18, VIR on 19, line-21 captions (1 = broadcast furniture on)
  // The two characters line 21 carries this frame, straight off the encoder's
  // shift register (signal/captionstate.ts). 0 is the null a real encoder sends
  // between characters, which is most frames.
  ['ccChar0', 'u32'],
  ['ccChar1', 'u32'],
  ['cc', 'f32'], // the set's caption decoder: 0 off, 1 decoding line 21
  ['ccBox', 'f32'], // opacity of the black box behind the caption
  // A pin held on the font ROM. Which pin is the whole effect: the address bus
  // carries the character code in its high lines and the row within the cell in
  // its low ones, and the data bus is the eight dots across one row.
  ['ccRomAddr', 'f32'], // address line held high, 1-based (0 = none)
  ['ccRomData', 'f32'], // data line held, 1-based; negative holds it low (0 = none)
  ['ccRomCross', 'f32'], // address lines n and n+1 transposed, 1-based (0 = none)
  ['ccRomSlip', 'f32'], // character-address counter gaining/losing counts, per frame
  ['ccRomLineSlip', 'f32'], // and per scan line, so the error grows down the page
  ['ccRomStride', 'f32'], // cell-height strap error, rows (0 = strapped for this font)
  ['ccRomRot', 'f32'], // fraction of the array that has lost its charge; sign is the erased state
  ['ccPageAddr', 'f32'], // page-address line held high, 1-based (0 = none)
  ['ccPageSlip', 'f32'], // page-address counter gaining/losing counts, per frame
  // The character generator at the switcher: the same words keyed into the
  // picture rather than sent as data, which is what an open caption was. Two
  // wires, fill and key, and every artifact is those two coming apart.
  ['cgMix', 'f32'], // the box's output over program, 0 bypassed
  ['cgX', 'f32'], // block's left edge, active-picture UV
  ['cgY', 'f32'], // block's top edge, active-picture UV
  ['cgScale', 'f32'], // picture samples per font dot
  ['cgKeyDelay', 'f32'], // key-vs-fill registration, samples
  ['cgClip', 'f32'], // where the slicer cuts the processed key, 0..1
  ['cgSoft', 'f32'], // key-path bandwidth as a half-cycle in samples
  ['cgEdgeX', 'f32'], // edge generator's horizontal delay, samples
  ['cgEdgeY', 'f32'], // edge generator's vertical delay, lines
  ['cgFill', 'f32'], // fill level, IRE (past 100 it overmodulates)
  ['cgHue', 'f32'], // the characters' colour, radians on the subcarrier
  ['cgSat', 'f32'], // and its saturation, 0 white
  ['cgBus', 'f32'], // fill from the frame store: 0 off, 1 the store tracks program, 2 the store holds
  ['cgFlip', 'f32'], // 1 when the store was written on the other subcarrier phase
  ['cgInvert', 'f32'], // cut the other way: letter-shaped holes in a full fill
  ['cgRomAddr', 'f32'], // this box's own font ROM, address line held high
  ['cgRomData', 'f32'], // and its data line; negative holds it low
  ['cgRomCross', 'f32'], // its address lines n and n+1 transposed
  ['cgRomSlip', 'f32'], // its character-address counter slipping, counts per frame
  ['cgRomLineSlip', 'f32'], // and per scan line, down the block
  ['cgRomStride', 'f32'], // its cell-height strap error, rows
  ['cgRomRot', 'f32'], // its decayed fraction; sign is the erased state
  ['cgPageAddr', 'f32'], // a line held on its page-address counter
  ['cgPageSlip', 'f32'], // and that counter slipping, counts per frame
  // the deck's on-screen display, drawn into the output after the tape
  ['osdMix', 'f32'], // display opacity while it is up, 0 when it is down
  ['osdLabel', 'f32'], // which word: play, pause, slow, ff, rew
  ['osdBlue', 'f32'], // 1 while the deck outputs its blue background
  ['osdColour', 'f32'], // letter colour: 0 white, 1 green
  ['osdEdge', 'f32'], // 1 draws a black outline round the letters
  ['osdX', 'f32'], // left edge, active-picture UV
  ['osdY', 'f32'], // top edge, active-picture UV
  ['osdScale', 'f32'], // multiple of the stock dot size
  // bent video enhancer, inline between the deck and the set
  ['enhClampOff', 'f32'], // clamp gate displaced off the back porch, samples
  ['enhDroop', 'f32'], // coupling-capacitor leak per sample (0 = DC coupled)
  ['enhPeakFc', 'f32'], // detail resonator center, cycles/sample (0 = off)
  ['enhPeakR', 'f32'], // resonator pole radius: ring length, and past 1 it howls
  ['enhPeakBoost', 'f32'], // resonator output mixed back into the video, IRE per IRE
  ['enhSync', 'f32'], // sync regenerator mix, 0 bypassed
  ['enhSlice', 'f32'], // regenerator slice level, IRE
  ['enhLoopGain', 'f32'], // output fed back to the first stage's input, 0 open
  ['enhLoopHold', 'f32'], // feedback coupling capacitor's hold per sample
  // feedback (camera-at-monitor)
  ['fbMix', 'f32'],
  ['fbZoom', 'f32'],
  ['fbRotate', 'f32'], // radians
  ['fbShiftX', 'f32'],
  ['fbShiftY', 'f32'],
  ['fbGain', 'f32'],
  ['fbFocus', 'f32'], // camera lens defocus radius, output pixels
  ['fbVign', 'f32'], // lens vignette strength
  ['fbBlack', 'f32'], // sensor black cut level (trails die into black)
  ['fbKnee', 'f32'], // sensor s-curve amount (bloom + highlight compression)
  ['fbIris', 'f32'], // camera auto-iris: 0 manual exposure .. 1 underdamped servo (hunts)
  ['fbLag', 'f32'], // pickup-tube lag: the reading beam leaves charge behind on a dim target
  ['fbComet', 'f32'], // pickup-tube comet tails: beam current cap, highlights drain over several fields
  ['fbRegShift', 'f32'], // camera tube centring error, picture widths: red +, blue -
  ['fbRegSize', 'f32'], // camera tube size error, fraction: red's scan larger, blue's smaller
  // CRT faceplate: the emissive screen the camera photographs (and the display
  // shows). Sits between the decoded signal and the camera/lens model above.
  ['crtCutoff', 'f32'], // beam cutoff: drive below the knee emits no light (true black background)
  ['crtGamma', 'f32'], // gun luminance response, luminance ~ drive^gamma (expands highlights, deepens shadows)
  ['crtSat', 'f32'], // saturation around luma, applied after the beam transfer
  ['crtSpot', 'f32'], // beam-spot radius on the glass, active pixels: spreads all light, not just highlights
  ['crtGrain', 'f32'], // granular phosphor deposit: static mottling of emitted light
  ['crtBloom', 'f32'], // highlight bloom spread from bright phosphor cores
  ['crtHalation', 'f32'], // wide warm glass-scatter halo around highlights
  ['crtGlow', 'f32'], // phosphor black-level glow / faceplate haze
  ['crtHaloKey', 'f32'], // halation radius keyed off beam current: peak whites scatter wider
  ['crtSvm', 'f32'], // scan velocity modulation: dwell-time redistribution across horizontal edges (signed = coil polarity)
  ['crtSvmWidth', 'f32'], // SVM differentiator aperture, active pixels
  ['crtConverge', 'f32'], // gun misconvergence, active px at the edge, growing with radius (signed = which gun lands outward)
  ['crtPurity', 'f32'], // magnetised mask patch: landing error over a soft blotch, tinting by triad direction
  ['crtPurityX', 'f32'], // blotch centre on the glass, 0..1
  ['crtPurityY', 'f32'],
  ['crtPuritySize', 'f32'], // blotch radius as a fraction of picture height
  // mixer loop: previous frame's composite fed back electrically
  ['cfbMix', 'f32'], // crossfader position toward the loop bus
  ['cfbGain', 'f32'], // loop proc-amp trim, negative inverts
  ['cfbDelay', 'f32'], // loop delay, samples (1 sample = 90 deg hue spin)
  ['cfbLines', 'f32'], // vertical offset per generation, lines
  ['cfbKey', 'f32'], // luma key amount, negative inverts polarity
  ['cfbKeyLevel', 'f32'], // key slice level, IRE
  ['cfbKeySoft', 'f32'], // key edge softness, IRE
  ['cfbTrail', 'f32'], // frame-store peak-hold decay (trails), 0 = plain capture
  ['cfbFilterFc', 'f32'], // loop resonance center, cycles/sample (0 = flat loop)
  ['cfbFilterQ', 'f32'], // loop resonance selectivity, 0 broad .. 1 narrow/ringing
  ['cfbFilterBoost', 'f32'], // added in-band loop gain (self-oscillates past unity round trip)
  ['cfbServo', 'f32'], // varactor on the loop delay: samples of pull per 100 IRE of its own video
  ['cfbRing', 'f32'], // loop bus ring-modulated against the live program
  ['cfbKeyExt', 'f32'], // keyer's key input: 0 the loop return (self), 1 program
  ['cfbKeyHue', 'f32'], // chroma-key backing phase, radians
  ['cfbKeyAccept', 'f32'], // chroma-key acceptance wedge, radians (0 = the box slices luma)
  // The ring modulator's other input. On the program the two sides share one
  // crystal, so their products land at DC and 7.16 MHz and the chroma filter
  // keeps neither; on the oscillator the bridge is an encoder's chroma
  // modulator, which is what puts the products back inside the chroma band.
  ['cfbRingSrc', 'f32'], // 0 the live program, 1 the box's own subcarrier oscillator
  ['cfbCarrierPhase', 'f32'], // that oscillator's phase off the house carrier at frame start, radians
  ['cfbCarrierPerSample', 'f32'], // its phase growth per sample, radians (the detune)
  ['cfbReturn', 'f32'], // Y/C split on the return: 0 composite, 1 loop's chroma, 2 loop's luma
  ['cfbClock', 'f32'], // frame store read-clock error, as a fraction of the write clock
  ['cfbNoise', 'f32'], // loop amplifier noise added to the return each lap, IRE rms
  // A frame synchronizer on the loop return instead of a bare cable. A store
  // genlocked to house reference writes its own sync and burst on the way out,
  // so what circulates is picture and the raster it lands on is this frame's.
  ['cfbGenlock', 'f32'], // 0 the loop's own blanking goes round, 1 the store rewrites it
  // display
  // Beam blanking, held on: the guns cut for most of a cycle and let through in
  // flashes. Applied in decode, upstream of the persistence layer, which is the
  // whole point — the light already on the glass keeps decaying through the dark
  // instead of the picture cutting to black.
  ['beamBlank', 'f32'], // 1 = guns cut this frame, 0 = beam scanning normally
  ['scanBeam', 'f32'], // finite beam-spot strength between scanlines
  ['scanBloom', 'f32'], // beam-spot growth with beam current: bright lines fatten, gaps close in whites
  ['phosphor', 'f32'], // P22 persistence: green-channel frame-to-frame retention (R/B decay faster)
  ['phosphorMode', 'f32'], // tube colour identity: 0 sRGB, 1 P22/SMPTE-C, 2 NTSC-1953, 3 long-persistence green
  ['phosphorSkew', 'f32'], // R/B persistence decay exponent skew relative to G (trails die toward green)
  ['phosphorBleed', 'f32'], // fraction of held light that scatters to the four neighbours per frame
  ['burnRate', 'f32'], // phosphor burn-in: dose added per field of full white
  ['burnDepth', 'f32'], // phosphor burn-in: efficiency lost per unit dose
  ['crtSharp', 'f32'], // horizontal Catmull-Rom reconstruction blend (0 bilinear)
  ['maskAmt', 'f32'], // aperture grille strength
  ['maskPitch', 'f32'], // grille triad pitch, canvas pixels
  ['crtZoom', 'f32'], // magnification of the glass (1 = whole screen)
  ['crtZoomX', 'f32'], // point on the glass held under the magnifier, 0..1
  ['crtZoomY', 'f32'],
  ['dbgView', 'f32'], // 0 normal, 1 gradient (present test), 2 raw composite (encode test)
] as const

// Workgroup width of the tiled-FIR passes; pipeline.ts sizes their dispatches
// from the same number so the WGSL and the dispatch cannot drift apart.
export const TILE_WG = 64

export const PARAM_BYTES = Math.ceil((PARAM_DEFS.length * 4) / 16) * 16
export const GEN_OFFSET = PARAM_DEFS.findIndex(([n]) => n === 'gen') * 4

// Union of every uniform name. Requiring a full record below makes a param
// added to PARAM_DEFS but never supplied a compile error instead of a runtime
// `missing param` throw.
export type ParamName = (typeof PARAM_DEFS)[number][0]

// Names already reported as non-finite, so a bad field says so once rather
// than sixty times a second.
const badParams = new Set<string>()

function reportNonFinite(name: string, v: number): void {
  if (!Number.isFinite(v) && !badParams.has(name)) {
    badParams.add(name)
    console.error(`packParams: ${name} is ${String(v)} — uniform will be NaN`)
  }
}

export function packParams(
  values: Record<ParamName, number>,
  out: ArrayBuffer,
): void {
  const dv = new DataView(out)
  PARAM_DEFS.forEach(([name, type], i) => {
    const v = values[name]
    // A field its supplier forgot arrives here as `undefined` and lands in the
    // uniform as NaN, and a NaN in the composite spreads over the whole raster
    // within a pass or two — so the symptom is a black frame with no error
    // anywhere, and nothing upstream catches it: the field is required by
    // `UniformEnv`'s type, but a second consumer of that type (the headless
    // graph in `scripts/gpuprof`) is not typechecked against it in practice.
    // That cost four presets a silent black frame in a survey. Reported rather
    // than thrown, because the render loop is the wrong place to die and the
    // picture says the rest.
    reportNonFinite(name, v)
    if (type === 'u32') dv.setUint32(i * 4, v >>> 0, true)
    else dv.setFloat32(i * 4, v, true)
  })
}

// Where each field sits and how it is written. `GEN_OFFSET` is this for one
// name, and `patchParams` is the general case.
const PARAM_SLOT: ReadonlyMap<string, { offset: number; u32: boolean }> =
  new Map(
    PARAM_DEFS.map(([name, type], i) => [
      name,
      { offset: i * 4, u32: type === 'u32' },
    ]),
  )

// Overwrite named fields of a block that is already packed.
//
// For a caller that wants the program bus's values with a handful replaced —
// which is what a per-source feed is. Building that as `{...vals, ...overrides}`
// and packing the result copies 222 fields into a fresh object, lands it in
// dictionary mode, and then reads 234 names back out of it: 100 us a feed,
// 200 us a frame with both engaged. Packing the bus's own object and writing
// the overridden fields on top is the same bytes for seventeen stores.
export function patchParams(
  out: ArrayBuffer,
  over: Partial<Record<ParamName, number>>,
): void {
  const dv = new DataView(out)
  for (const [name, v] of Object.entries<number | undefined>(over)) {
    const slot = PARAM_SLOT.get(name)
    if (slot !== undefined && v !== undefined) {
      reportNonFinite(name, v)
      if (slot.u32) dv.setUint32(slot.offset, v >>> 0, true)
      else dv.setFloat32(slot.offset, v, true)
    }
  }
}

const paramStruct = `struct Params {\n${PARAM_DEFS.map(([n, t]) => `  ${n}: ${t},`).join('\n')}\n}\n`

export const PRELUDE = /* wgsl */ `
const SPL = ${SAMPLES_PER_LINE}u;
const NLINES = ${LINES}u;
const BUF_LEN = ${SAMPLES_PER_LINE * LINES}u;
const SYNC_LEN = ${SYNC_LEN}u;
const BURST_START = ${BURST_START}u;
const BURST_LEN = ${BURST_LEN}u;
const ACTIVE_START = ${ACTIVE_START}u;
const ACTIVE_W = ${ACTIVE_WIDTH}u;
const ACTIVE_TOP = ${ACTIVE_TOP}u;
const ACTIVE_H = ${ACTIVE_HEIGHT}u;
// The three sync scalars the flywheel carries across frames, sitting directly
// above the per-line offsets. Named rather than written as 525/526/527 at the
// eight sites that touch them: the raster is a constant here, so a literal
// index is the one thing in this buffer that would not move if LINES did.
const V_PHASE = ${LINES}u; // vertical oscillator phase, signed fractional lines
const PLL_STATE = ${LINES + 1}u;
const AGC_GAIN = ${LINES + 2}u;
// Persistent servo state in the timing buffer, past the three sync scalars.
// The two gain servos each carry (gain, velocity): they are second-order loops
// on purpose, so an under-damped setting genuinely overshoots and hunts.
const ABL_GAIN = ${LINES + 3}u;
const ABL_VEL = ${LINES + 4}u;
const IRIS_GAIN = ${LINES + 5}u;
const IRIS_VEL = ${LINES + 6}u;
// Lines since the sync separator last found a real edge. The free-running
// H-osc's phase noise grows with it, so lock decays instead of coasting.
const LOCK_AGE = ${LINES + 7}u;
const SAG_BASE = ${LINES + 8}u; // deflection sag region of the timing buffer
// The VIR corrector's two integrators, past the sag region. Persistent across
// frames like the sync scalars: they are a servo's state, and a servo that
// restarted every frame would have no time constant to speak of.
const VIR_HUE = ${LINES * 2 + 8}u;
const VIR_GAIN = ${LINES * 2 + 9}u;
// The sync separator's peak detector and the DC restorer hanging off it: the
// tip level the slicer is referenced to, how far black sits off nominal, and
// whether the flywheel's gate is open wide because it has lost the pulses.
// Persistent like the servos above; zero means never run.
const TIP_LEVEL = ${LINES * 2 + 10}u;
const BLACK_SHIFT = ${LINES * 2 + 11}u;
const GATE_WIDE = ${LINES * 2 + 12}u;
// The deflection sag tank's state between frames: the sag and its velocity
// as the last line left them, so the ringing carries through the flyback
// instead of restarting from rest at the top of every frame.
const SAG_HOLD = ${LINES * 2 + 13}u;
const SAG_VEL = ${LINES * 2 + 14}u;
// The sag averaged over the frame just walked, which sets the EHT the vertical
// scan sees: the reservoir is far too slow to follow one line.
const SAG_MEAN = ${LINES * 2 + 15}u;
// The line oscillator's frequency offset, samples per line, as the AC-coupled
// separator's phase comparator has charged its loop filter. Zero for the other
// separators, whose flywheel moves phase alone.
const AFC_VEL = ${LINES * 2 + 16}u;
// Frames the separator must go without pulses before its gate opens to the
// whole line. A flywheel coasts through a hum trough or an AGC dip; it only
// starts hunting once the pulses have genuinely gone.
const GATE_OPEN_FRAMES = 12.0;
// Samples past the expected line start the locked separator's gate looks for
// an edge, and how near an edge has to land for sync.wgsl to count it as home.
const GATE_NARROW = 55;
const VSYNC_FIRST = ${VSYNC_FIRST}u;
const VSYNC_LAST = ${VSYNC_LAST}u;
// The first line past the post-equalizing pulses: full-width sync and burst.
const FIRST_BURST_LINE = VSYNC_LAST + 4u;
const HEAD_SWITCH_LINE = ${HEAD_SWITCH_LINE}u;
// The VIR reference the encoder stamps and vir.wgsl measures.
const VIR_LINE = 19u;
// The caption channel. Layout comes from captionrom.ts, which is also what
// bakes the font, so the ROM the CPU writes and the page the shaders index
// cannot drift apart.
const CC_LINE = 21u;
const CC_CELLS = ${CC_CELLS}u;
const CC_COLS = ${CC_COLS}u;
const CC_ROWS = ${CC_ROWS}u;
const CC_PAGE = ${CC_PAGE}u;
const CC_CURSOR = ${CC_CURSOR}u;
const CC_BLOCK = ${CC_BLOCK}u;
const CC_SET = ${CC_SET}u;
const CC_CR = ${CC_CR}u;
const GLYPH_W = ${GLYPH_W}u;
const GLYPH_H = ${GLYPH_H}u;
const GLYPH_COUNT = ${GLYPH_COUNT}u;
// The character-generator part both boxes are built around: a 2 KiB EPROM on
// eleven address lines, holding a 1152-byte font with 896 bytes above it that
// were never programmed. An erased cell on this part reads all ones, so an
// address that lands up there returns a solid row of dots.
const ROM_SPAN = 2048u;
const ROM_ERASED = 0xffu;
const ROM_FONT = GLYPH_COUNT * GLYPH_H;
// Two parts, two dies. The seeds are what keep one box's decay from being the
// other's, and nothing else about the chips differs.
const ROM_DIE_CC = 0x9e3779b9u;
const ROM_DIE_CG = 0x85ebca6bu;
const IRE_SYNC = ${IRE_SYNC}.0;
const IRE_BLANK = ${IRE_BLANK}.0;
const IRE_BLACK = ${IRE_BLACK};
const VIDEO_RANGE = ${IRE_VIDEO_RANGE};
const BURST_AMP = ${BURST_AMP_IRE}.0;
const FILTER_STRIDE = ${FILTER_STRIDE}u;
const SEC_ENC_CHROMA = ${SEC_ENC_CHROMA}u;
const SEC_DEMOD = ${SEC_DEMOD}u;
const SEC_LUMA = ${SEC_LUMA}u;
const SEC_CHROMA_BP = ${SEC_CHROMA_BP}u;
const SEC_UNDER = ${SEC_UNDER}u;
const SEC_TAKEOFF = ${SEC_TAKEOFF}u;
const ENC_CHROMA_TAPS = ${TAPS.encChroma}u;
const DEMOD_TAPS = ${TAPS.demod}u;
const DEMOD_SHORT_TAPS = ${TAPS.demodShort}u;
const LUMA_TAPS = ${TAPS.luma}u;
const CHROMA_BP_TAPS = ${TAPS.chromaBp}u;
const UNDER_TAPS = ${TAPS.under}u;
const TAKEOFF_TAPS = ${TAPS.takeoff}u;
const DOWN_PER_SAMPLE = ${DOWN_PER_SAMPLE}; // (fsc - f_under) / sample_rate
const CAP_REACH = ${SERIES_CAP_REACH}u; // samples a feed sums a series capacitor's charge over
const CAP_LOAD = ${SERIES_CAP_LOAD}; // what an S-video adapter's joint leaves of each wire
const PI = 3.14159265359;
// FIR tiling: each TILE_WG-thread workgroup stages its input span plus a
// 32-sample halo per side in shared memory, so symmetric kernels up to
// 65 taps read storage once per sample instead of once per tap. The width
// trades halo overhead against scheduling granularity: staging costs
// (TILE_WG + 64) / TILE_WG loads per output, so wider workgroups re-stage
// less — but measured on the dev GPU it doesn't pay: 64 and 128 are within
// noise and 256 is ~8% slower, so the halo traffic is not the bottleneck.
const TILE_WG = ${TILE_WG}u;
const TILE = ${TILE_WG + 64}u;
const HALO = 32u;

${paramStruct}

// Odd parity, the way line 21 protects each character: the seven data bits and
// the parity bit together carry an odd number of ones, so any single bit
// flipped in transit is caught. A decoder that caught one drew a solid block
// rather than a plausible wrong letter, which is why the failure has to travel
// as a flag on the cell and not as a substituted character.
fn ccParity(code: u32) -> u32 {
  return 1u - (countOneBits(code & 0x7fu) & 1u);
}

// Cell b of a character's eight on the wire: seven data bits, least
// significant first, then the parity bit.
fn ccBit(b: u32, code: u32) -> u32 {
  if (b < 7u) {
    return (code >> b) & 1u;
  }
  return ccParity(code);
}

// Subcarrier (sin, cos) at global sample index n. Sampling at exactly 4x fsc
// puts every sample on a 4-phase lattice, so the carrier is exact — no trig,
// no phase accumulation error. 910 samples/line = 227.5 cycles gives the
// 180-degree line alternation, 525 lines gives the frame alternation, both
// automatically via n mod 4.
fn carrier(n: u32, frame: u32) -> vec2f {
  let j = (n + 2u * (frame & 1u)) & 3u;
  let odd = j & 1u;
  // the lattice is (0,1) (1,0) (0,-1) (-1,0): bit 0 picks the axis, bit 1 the
  // sign. Same four values the table held, without a dynamically indexed
  // local array. (Quadrants 2 and 3 produce a -0.0 where the table had +0.0;
  // these are only ever multiplied and summed, where the two are identical.)
  let sign = 1.0 - f32(j & 2u);
  return vec2f(f32(odd) * sign, f32(1u - odd) * sign);
}

// The exact-lattice carrier rotated by a slow phase error (a detuned source's
// subcarrier slip, or a proc-amp hue trim). delta = 0 is the house carrier.
fn carrierRot(n: u32, frame: u32, delta: f32) -> vec2f {
  let sc = carrier(n, frame);
  let cd = cos(delta);
  let sd = sin(delta);
  return vec2f(sc.x * cd + sc.y * sd, sc.y * cd - sc.x * sd);
}

// A chroma phase measured against a reference, brought back into (-PI, PI].
// Three boxes ask that question — the mixer's chroma keyer, the loop's, and the
// VIR corrector's residual — and each of them then cares about how *far* the
// answer is from zero. Left unwrapped, a hue a degree either side of the atan2
// branch differs by a whole turn, which is a keyer dropping its own territory
// at one hue and a corrector integrating a step nothing on the wire took.
fn wrapPi(a: f32) -> f32 {
  return a - 2.0 * PI * round(a / (2.0 * PI));
}

// A line's burst phase measured about the expected 180 degrees, from the
// lineAnalyze record. Negating the components keeps the angle near zero, so a
// partial burstLock scales a continuous error. Zero where the killer has the
// line, or where there is no burst vector to take an angle of.
fn burstPhase(li: vec4f, killThresh: f32) -> f32 {
  let measured = li.w > killThresh && dot(li.xy, li.xy) > 1e-12;
  return select(0.0, atan2(-li.y, -li.x), measured);
}

// A hue keyer's wedge on the U/V plane: 1 within accept of hue, eased to 0
// over edge either side. Both chroma keyers slice with it, and hueKey.ts
// hueGate draws it.
// No chroma has no hue, and atan2(0, 0) is undefined, so it sits opposite.
fn hueGate(uv: vec2f, hue: f32, accept: f32, edge: f32) -> f32 {
  let w = select(PI, wrapPi(atan2(uv.y, uv.x) - hue), dot(uv, uv) > 1e-12);
  return 1.0 - smoothstep(accept - edge, accept + edge, abs(w));
}

// One NTSC line's blanking-interval structure — equalizing pulses, serrated
// vsync, sync tip, breezeway/back porch, and 9-cycle colorburst — shared by
// every composite generator so the raster timing lives in exactly one place.
// (Editing the raster, e.g. the progressive->interlaced fix, then touches only
// this.) delta rotates the burst carrier for a detuned source; picture true
// means the sample is active video, which the caller fills in with luma + chroma.
struct LineSlot {
  value: f32,
  picture: bool,
}

fn ntscLineSlot(row: u32, s: u32, n: u32, frame: u32, delta: f32) -> LineSlot {
  var slot = LineSlot(IRE_BLANK, false);
  if (row < VSYNC_FIRST || (row > VSYNC_LAST && row < FIRST_BURST_LINE)) {
    // equalizing pulses: narrow half-line-rate pulses flanking vsync
    slot.value = select(IRE_BLANK, IRE_SYNC, (s % 455u) < 33u);
  } else if (row >= VSYNC_FIRST && row <= VSYNC_LAST) {
    // serrated broad pulses: mostly sync level, rising near each half-line end
    // 4.7 us of blanking ending at each half line, so the separator's
    // falling edges land at 0 and 455 where it expects a line to start
    let serration = (s >= 388u && s < 455u) || s >= 843u;
    slot.value = select(IRE_SYNC, IRE_BLANK, serration);
  } else if (s < SYNC_LEN) {
    slot.value = IRE_SYNC;
  } else if (s >= BURST_START && s < BURST_START + BURST_LEN) {
    // burst at 180 degrees on the U axis: -A*sin. No row guard: everything
    // below line 12 was already claimed by the two branches above, so the
    // first line that can carry burst is the first one with a real sync tip.
    slot.value = -BURST_AMP * carrierRot(n, frame, delta).x;
  } else if (s >= ACTIVE_START && s < ACTIVE_START + ACTIVE_W && row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_H) {
    slot.picture = true;
  }
  return slot;
}

// Active-picture composite sample: black pedestal plus quadrature chroma on the
// subcarrier, with proc-amp video gain and continuous inversion (0.5 = solarized
// midpoint, 1 = full invert; reflects active video around the black+white mid so
// sync and burst are untouched). The chroma is pre-filtered by the caller,
// whose FIR read differs (workgroup tile vs storage).
fn activeComposite(y: f32, uf: f32, vf: f32, sc: vec2f, vidGain: f32, inv: f32) -> f32 {
  let v = IRE_BLACK + VIDEO_RANGE * (y + uf * sc.x + vf * sc.y) * vidGain;
  return mix(v, 2.0 * IRE_BLACK + VIDEO_RANGE - v, inv);
}

// The chroma term of the same sample: what the source's own C wire carries.
fn activeChroma(uf: f32, vf: f32, sc: vec2f, vidGain: f32, inv: f32) -> f32 {
  return (1.0 - 2.0 * inv) * VIDEO_RANGE * (uf * sc.x + vf * sc.y) * vidGain;
}

// An S-video lead into a composite jack with one pin making poor contact.
// Above zero the Y wire, which holds luma, sync and blanking, arrives scaled
// by what is left of its contact, and the C wire arrives whole. Below zero the
// C wire, which holds the colour and the burst, is the one scaled, and the Y
// wire arrives whole. The chroma argument is what the lead's C wire carries:
// a deck's bandpass of its own composite.
fn chromaPin(v: f32, chroma: f32, pin: f32) -> f32 {
  return v - max(pin, 0.0) * (v - chroma) + min(pin, 0.0) * chroma;
}

// Analog premium-channel scrambling, applied at a head-end. The scrambler lifts
// the carrier during the horizontal sync interval; after envelope detection that
// is the sync tip pulled up toward blanking, and a set with no decoder box has
// nothing left to slice a line start out of. Past half depth the tip clears the
// separator's -20 IRE level entirely and horizontal lock is gone.
//
// Every mode gates the line-rate sync alone, which is why the frame stays
// framed: the broad vertical pulses are far wider than the gate, so their
// bodies still read as sync level mid-line and the vertical oscillator keeps
// triggering. Radio-Electronics (Feb 1987) says of Jerrold's tri-mode that the
// vertical pulses "are not altered during scrambling", and Grossblatt's
// Unscrambling Descrambling that the undecoded screen "always shows a full
// frame". The tearing is horizontal: a line oscillator free-running near the
// line rate puts the blanking interval at about the same place on every line,
// a curved bar down the screen with the picture's halves either side of it.
//
// mode 1 scrambles alternate lines; mode 2 is SSAVI, which suppressed sync *and*
// inverted the video, so the picture that leaks through is a negative as well as
// an unstable one. A line is inverted or it is not, so depth sets only the sync
// suppression: a blend toward the negative cancels the picture to flat grey at
// half depth. Burst sits in the back porch and is left alone, so hue survives
// the inversion.
//
// mode 3 is the scrambler as the RF stage builds it (GI/Jerrold): the carrier
// is attenuated by up to 10 dB through a 13 us gate around each line start, from
// 2.44 us before the sync edge to 10.56 us after it. Sync, both porches and the
// burst go with it, and
// the gate overruns the picture by about a microsecond either side. Negative
// modulation puts sync at full carrier, so the attenuated interval detects as
// grey (6 dB: tip +40 IRE, porch +60) or near white (10 dB: +69 and +82). The
// tip then sits above picture black, so the darkest thing on a line is picture
// content, and the burst is weaker by the same factor, so the ACC turns the
// chroma up to match. The carrier map is channel.wgsl's: sync -40 to white 100
// onto 1 to 0.125.
//
// mode 4 is tri-mode, the same gate keyed between clear, 6 dB and 10 dB. The
// head-end changes level at a field boundary on a pseudo-random schedule and
// sends the level to its own decoders in the vertical interval, so a set with
// no decoder holds lock for a stretch and loses it on the next step. Depth
// scales both attenuated levels.
//
// mode 5 is sine-wave suppression (early Oak and Pioneer): the carrier is
// multiplied by a line-rate sine phase-locked to sync, lowest at the sync tip
// and highest mid-line, 6.5 dB peak to trough at full depth. It never stops, so
// it runs through the vertical interval too and the broad pulses keep their
// bodies at sync level: the frame stays put while the line start is lost. The
// tip detects as grey and the picture edges either side of it lift toward
// white, while the middle of the line keeps its full carrier.
//
// mode 6 is SSAVI as Zenith ran it, keyed between its four modes: sync
// suppressed or not, video inverted or not. The mode changes at a field
// boundary on a schedule sent in the vertical interval, and the line sync
// inside the vertical interval is never suppressed, because the decoder's PLL
// rebuilds the missing pulses from it.
//
// mode 8 is Oak Sigma (US 4,336,553 and 4,340,906): every sync pulse is gone,
// line and field. Three bytes on a 250 ns grid sit where the line sync was, a
// clock byte and two of encrypted sound, and their level swings on a
// free-running sine near 15 Hz. The burst is kept on a DC bias, a binary
// reference pattern stands in for the field pulses, and whole fields are
// inverted on a key that holds for at least three seconds. The patents give no
// data levels or bias, so those are this file's choice.
//
// mode 9 is VideoCipher II (Communications Technology, June 1986): the front
// porch and sync of every line carry encrypted sound and addressing, the back
// porch and burst are lifted to the middle of the video range, the picture is
// inverted at 1.4 times the gain, and the vertical interval carries a
// full-amplitude pattern in place of its pulses. The article names no axis for
// the inversion, so the lifted porch is this file's choice.
//
// One definition for the program bus (channel) and the per-source feeds, which
// scramble one input alone — a premium channel is scrambled per channel, not
// per set, so the two differ only in what they are handed. frame is the field
// the head-end sent, which a feed reads off its deck's tape position.
const SCRAMBLE_GATE_LEAD = 35u;
const SCRAMBLE_GATE_END = 151u;
const SCRAMBLE_KEY_FIELDS = 16u;
const SCRAMBLE_KEY_REACH = 8u;
const SINE_SUPPRESSION_DB = 6.5;
const HBI_DATA_CELL = ${HBI_DATA_CELL};
const SIGMA_DATA_CELLS = ${SIGMA_DATA_CELLS}u;
const SIGMA_CLOCK_CELLS = ${SIGMA_CLOCK_CELLS}u;
const SIGMA_DATA_IRE = ${SIGMA_DATA_IRE}.0;
const SIGMA_DATA_SWING_IRE = ${SIGMA_DATA_SWING_IRE}.0;
const SIGMA_SWING_PER_FIELD = 0.2503;
const SIGMA_PORCH_BIAS_IRE = ${SIGMA_PORCH_BIAS_IRE}.0;
const SIGMA_KEY_STRETCH = 12u;
const CIPHER_DATA_IRE = ${CIPHER_DATA_IRE}.0;
const CIPHER_PORCH_BIAS_IRE = ${CIPHER_PORCH_BIAS_IRE}.0;
const CIPHER_AXIS_IRE = ${CIPHER_AXIS_IRE}.0;
const CIPHER_GAIN = ${CIPHER_GAIN};
const VBI_REFERENCE_CELL = ${Math.round(usToSamples(1))}u;

fn cipherBit(row: u32, cell: u32, frame: u32) -> f32 {
  return f32(pcg(row * 2246822519u + frame * 3266489917u + cell * 668265263u) & 1u);
}

// The head-end's mode key. A mode can change only on a 16-field boundary, and
// it changes on about a third of them, with a change forced every eighth so the
// search back stays bounded. A mode therefore holds for a random 16 to 128
// fields, and the value returned is fixed for the hold.
fn scrambleKey(frame: u32, seed: u32) -> f32 {
  let cell = frame / SCRAMBLE_KEY_FIELDS;
  var held = cell;
  var found = false;
  for (var back = 0u; back < SCRAMBLE_KEY_REACH && back <= cell; back = back + 1u) {
    let c = cell - back;
    let changes = c % SCRAMBLE_KEY_REACH == 0u
      || rand01(pcg(c * 2246822519u + (seed ^ 0x9e37u))) < 0.35;
    if (!found && changes) {
      held = c;
      found = true;
    }
  }
  return rand01(pcg(held * 2654435761u + seed));
}

// The carrier scramblers' gate: 2.44 us before the sync edge to 10.56 us after
// it, on every line.
fn inCarrierGate(s: u32) -> bool {
  return s < SCRAMBLE_GATE_END || s >= SPL - SCRAMBLE_GATE_LEAD;
}

fn triModeLevel(frame: u32) -> f32 {
  let r = scrambleKey(frame, 0x7e1du);
  return select(select(1.0, 0.6, r < 0.6), 0.0, r < 0.2);
}

// Negative modulation's carrier map, as a fraction of peak amplitude: the sync tip
// at -40 IRE is full carrier and peak white at 100 IRE is an eighth of it.
fn carrierOf(ire: f32) -> f32 {
  return 1.0 - 0.00625 * (ire + 40.0);
}

// What an envelope detector hands back for a carrier level.
fn ireOf(carrier: f32) -> f32 {
  return 160.0 * (1.0 - carrier) - 40.0;
}

// Attenuate the RF carrier by db decibels and detect again.
fn carrierScaled(v: f32, db: f32) -> f32 {
  return ireOf(pow(10.0, -db / 20.0) * max(carrierOf(v), 0.0));
}

fn scrambleAt(v: f32, row: u32, s: u32, depth: f32, mode: f32, frame: u32) -> f32 {
  let system = u32(mode + 0.5);
  let skipped = depth <= 0.0 || (system == 1u && (row & 1u) == 1u) || system == 7u;
  let blanking = s < ACTIVE_START || s >= ACTIVE_START + ACTIVE_W;
  let picture = !blanking && row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_H;
  var out = v;
  if (!skipped) {
    if (system == 3u || system == 4u) {
      if (inCarrierGate(s)) {
        var level = depth;
        if (system == 4u) {
          level = depth * triModeLevel(frame);
        }
        out = carrierScaled(v, 10.0 * level);
      }
    } else if (system == 5u) {
      let tipCentre = f32(SYNC_LEN) * 0.5;
      let toTip = 0.5 + 0.5 * cos(2.0 * PI * (f32(s) - tipCentre) / f32(SPL));
      out = carrierScaled(v, SINE_SUPPRESSION_DB * depth * toTip);
    } else if (system == 8u || system == 9u) {
      let cipher = system == 9u;
      let dataStart = select(0u, ACTIVE_START + ACTIVE_W, cipher);
      let dataLen = select(u32(f32(SIGMA_DATA_CELLS) * HBI_DATA_CELL), SPL - dataStart + SYNC_LEN, cipher);
      let into = (s + SPL - dataStart) % SPL;
      let swing = 2.0 * PI * SIGMA_SWING_PER_FIELD * (f32(frame % 4000u) + f32(row) / f32(NLINES));
      let dataHigh = select(SIGMA_DATA_IRE + SIGMA_DATA_SWING_IRE * sin(swing), CIPHER_DATA_IRE, cipher);
      if (into < dataLen) {
        let cell = u32(f32(into) / HBI_DATA_CELL);
        let clock = !cipher && cell < SIGMA_CLOCK_CELLS;
        let bit = select(cipherBit(row, cell, frame), f32(cell & 1u), clock);
        out = mix(out, dataHigh * bit, depth);
      } else if (s < ACTIVE_START) {
        out = max(out, mix(out, IRE_BLANK, depth)) + depth * select(SIGMA_PORCH_BIAS_IRE, CIPHER_PORCH_BIAS_IRE, cipher);
      } else if (picture) {
        if (cipher) {
          out = mix(out, CIPHER_AXIS_IRE - CIPHER_GAIN * (out - CIPHER_AXIS_IRE), depth);
        } else if (fract(scrambleKey(frame / SIGMA_KEY_STRETCH, 0x51a3u) * 2.0) < 0.5) {
          out = 2.0 * IRE_BLACK + VIDEO_RANGE - out;
        }
      } else if (row >= VSYNC_FIRST && row <= VSYNC_LAST) {
        out = mix(out, dataHigh * f32((s / VBI_REFERENCE_CELL) & 1u), depth);
      } else {
        out = max(out, mix(out, IRE_BLANK, depth));
      }
    } else {
      var suppress = true;
      var invert = system == 2u;
      if (system == 6u) {
        let key = scrambleKey(frame, 0x55a1u);
        suppress = key < 0.5 && row >= ACTIVE_TOP;
        invert = fract(key * 2.0) < 0.5;
      }
      if (s < SYNC_LEN && suppress) {
        out = mix(out, IRE_BLANK, depth);
      }
      if (invert && picture) {
        out = 2.0 * IRE_BLACK + VIDEO_RANGE - out;
      }
    }
  }
  return out;
}

// A descrambler box at the end of the drop cable, ahead of the set's tuner. It
// reads the head-end's key, so its gate is the carrier scramblers' gate and it
// knows how many dB each field was sent with, and it raises the carrier there
// by that much, up to what it was built for. The cheap boxes handled 6 dB and
// clear: on a tri-mode channel a 6 dB box restores the clear and 6 dB fields
// and leaves 4 dB on the 10 dB fields. The other systems need other boxes, so
// this one passes them through.
fn descrambleAt(v: f32, row: u32, s: u32, depth: f32, mode: f32, frame: u32, boxDb: f32) -> f32 {
  let system = u32(mode + 0.5);
  var out = v;
  if (boxDb > 0.0 && depth > 0.0 && (system == 3u || system == 4u) && inCarrierGate(s)) {
    var level = depth;
    if (system == 4u) {
      level = depth * triModeLevel(frame);
    }
    out = carrierScaled(v, -min(10.0 * level, boxDb));
  }
  return out;
}

// mode 7 is line-delay scrambling, as Canal+ ran it with Discret 11: the
// picture part of each line is delayed by 0, 902 or 1804 ns, picked per line
// and per field by the key, and sync, blanking and burst stay where they were.
// The set locks, and the picture comes out in three-step jaggies. In NTSC the
// colour goes too: 902 ns is 3.23 cycles of subcarrier, so a delayed line
// reaches the decoder 82 degrees off the burst it is measured against, and the
// 1804 ns lines 165 degrees off. It needs the source at an earlier sample, so
// it runs where a whole line can be read: the per-source feeds. The return is
// the delay in samples, scaled by depth.
const DISCRET_STEP = ${usToSamples(0.902)};

fn discretDelay(row: u32, frame: u32, depth: f32) -> f32 {
  let step = f32(pcg(row * 2246822519u + frame * 3266489917u + 0xd11u) % 3u);
  return step * DISCRET_STEP * depth;
}

// Mains phase at this line. One cycle per field, creeping against field rate
// because the mains and the field rate are not the same number — which is why a
// hum bar rolls instead of standing still. One definition, because the program
// bus's ground loop and a feed's have to roll together: they are the same
// building's mains, and two bars drifting at different rates would say they were
// not. A triac dimmer's firing angle is on the same mains, so it asks in
// fractional lines (where its event landed), which is why the row is f32.
// The frame count wraps every 10000 frames, which is a whole 37 cycles of the
// creep, so the phase stays small enough for sin to be accurate on a long run.
fn humPhase(row: f32, frame: u32) -> f32 {
  return 2.0 * PI * (row / f32(NLINES) + f32(frame % 10000u) * 0.0037);
}

// A loose plug at the input jack. This takes a mode rather than a depth alone
// because an RCA connector has two contacts and they fail into two different
// pictures:
//
//  - the CENTRE PIN going intermittent breaks the signal path, so the jack sees
//    an open through its own terminator and the input stage's noise floor comes
//    up where the picture was. Sync goes with it, which is what makes this worth
//    having per source: the receiver still has the *other* input's tips to lock
//    to, so a band of bad contact hands the line start over and takes it back a
//    band later, with nothing drawing the hand-off.
//  - the SHELL going intermittent leaves the signal path intact and breaks the
//    ground reference instead. The return current has to find the mains earth
//    through both boxes' supplies, so a ground loop's IR drop lands in series
//    with the video: the line rides a 60 Hz pedestal and the level walks, while
//    the picture and its sync survive. This is the buzz you get by wiggling a
//    plug that is still passing a picture — the fault that sounds broken and
//    looks nearly fine.
//
// Contact is decided per band of lines and re-rolled every frame, the way a plug
// hanging on its own cable weight makes and breaks. The two contacts carry
// independent band maps, so mode 2 interleaves two faults rather than doubling
// one, and the gen seed decorrelates one input's bad plug from the other's.
//
// Modes 3 and 4 are an S-video plug with one signal pin intermittent, which a
// feed's lead applies with signalPinOpen.
fn signalPinOpen(row: u32, frame: u32, gen: u32, amt: f32) -> bool {
  return rand01(pcg(frame * 2246822519u + (row / 12u) * 40503u + gen * 7u)) < amt * 0.5;
}

fn connectorAt(v: f32, row: u32, n: u32, frame: u32, gen: u32, amt: f32, mode: f32) -> f32 {
  if (amt <= 0.0 || mode > 2.5) {
    return v;
  }
  var out = v;
  let band = row / 12u;
  if (mode < 0.5 || mode > 1.5) {
    if (signalPinOpen(row, frame, gen, amt)) {
      let snow = 20.0 * gauss(n ^ pcg(frame * 131u + n));
      out = mix(out, snow, 0.9) - 35.0 * amt;
    }
  }
  if (mode > 0.5) {
    let r = rand01(pcg(frame * 1103515245u + band * 26947u + gen * 13u));
    if (r < amt * 0.5) {
      out = out + 40.0 * amt * sin(humPhase(f32(row), frame));
    }
  }
  return out;
}

// Cable termination fault. Correct is one 75-ohm terminator (0). An open,
// unterminated line (>0) reflects the wave back: the signal runs hot and each
// edge rings with a short round-trip echo. Daisy-chaining a second monitor
// double-terminates (<0), halving the signal so contrast and sync depth collapse
// toward a dim, barely-locking roll. The echo argument is the sample one round
// trip back down the cable, the cable's own signal reflected, so each caller
// takes it from its own output: the program bus in the timebase pass, a feed
// from the five samples each workgroup computes before its tile. Only an open
// line uses the echo, so callers tap it only when term is positive.
fn terminate(v: f32, term: f32, echo: f32) -> f32 {
  return v * pow(2.0, term) + max(term, 0.0) * 0.6 * echo;
}

// A dirty pot in series with a source's cable, into the mixer input's 75-ohm
// terminator. With the source's own 75 ohms the divider is 150 / (150 + R), so
// sync, burst and picture all shrink together, and the receiver's separator,
// AGC and colour killer react to the level that arrives.
//
// The dirt on the carbon track makes the wiper lose contact. Each break lasts
// from a few microseconds to a few lines, which is far shorter than a field, so
// one field catches the pot at many settings. Breaks arrive in clusters,
// because the dirt sits in patches along the track, and their rate follows the
// wiper's speed, with a few left over at rest. A break is one of three things:
// an open, where the input sees only its own terminator; extra contact
// resistance in series with the wiper; or a finger of the wiper lifting off,
// which moves the point where it touches the track.
//
// Breaks are placed on a line clock that runs across frames, so a cluster that
// starts at the bottom of one field carries on into the top of the next.
const POT_LOAD = 150.0;
const POT_REACH = 4u;
const POT_CLUSTER_LINES = 24u;
const POT_BREAKS_PER_LINE = 0.15;
const POT_REST = 0.03;
const POT_FINGER = 0.12;
const POT_OHMS = ${POT_OHMS}.0;
const MIX_POT_OHMS = ${MIX_POT_OHMS}.0;

fn potCluster(line: u32, gen: u32) -> f32 {
  let cell = line / POT_CLUSTER_LINES;
  let f = f32(line % POT_CLUSTER_LINES) / f32(POT_CLUSTER_LINES);
  let a = rand01(pcg(cell * 3266489917u + gen * 668265263u));
  let b = rand01(pcg((cell + 1u) * 3266489917u + gen * 668265263u));
  let c = mix(a, b, smoothstep(0.0, 1.0, f));
  return 3.0 * c * c * c;
}

// What the wiper's contact is doing at this sample: series ohms (negative for
// an open) and how far a lifted finger has moved the contact point, as a
// fraction of the travel.
struct PotContact {
  ohms: f32,
  shift: f32,
}

fn potContact(row: u32, s: u32, frame: u32, gen: u32, speed: f32) -> PotContact {
  let motion = POT_REST + min(speed * 2.0, 1.0);
  var c = PotContact(0.0, 0.0);
  for (var k = 0u; k <= POT_REACH; k = k + 1u) {
    let line = frame * NLINES + row - k;
    let h = pcg((line * 2654435761u) ^ (gen * 40503u + 0x9e37u));
    let p = min(POT_BREAKS_PER_LINE * motion * potCluster(line, gen), 0.9);
    if (rand01(h) < p) {
      let start = rand01(pcg(h ^ 0x51ed270bu)) * f32(SPL);
      let len = 0.5 * f32(SPL) * -log(1.0 - 0.998 * rand01(pcg(h ^ 0x2c1b3c6du)));
      let d = f32(k * SPL + s) - start;
      if (d >= 0.0 && d < len) {
        let r = rand01(pcg(h ^ 0x7f4a7c15u));
        if (r < 0.35 || c.ohms < 0.0) {
          c.ohms = -1.0;
        } else if (r < 0.65) {
          c.shift = POT_FINGER * (2.0 * rand01(pcg(h ^ 0x3c6ef372u)) - 1.0);
        } else {
          c.ohms = max(c.ohms, 100.0 * exp(6.7 * (r - 0.65) / 0.35 * 0.6));
        }
      }
    }
  }
  return c;
}

// An input's own noise floor, which is all an open contact leaves it.
fn openInput(n: u32, frame: u32, gen: u32) -> f32 {
  return 2.0 * gauss(n ^ pcg(frame * 7717u + gen * 31u));
}

fn potAt(v: f32, row: u32, s: u32, n: u32, frame: u32, gen: u32, ohms: f32, speed: f32) -> f32 {
  let c = potContact(row, s, frame, gen, speed);
  let r = max(ohms + c.shift * POT_OHMS, 0.0) + c.ohms;
  return select(v * POT_LOAD / (POT_LOAD + r), openInput(n, frame, gen), c.ohms < 0.0);
}

// The pot as a passive crossfader: A's 75-ohm output on one end of the track,
// B's on the other, and the wiper through its contact into the bus's 75-ohm
// terminator. Nothing buffers either source, so both syncs and both bursts are
// on the wire in whatever ratio the wiper splits them, and a finger lifting
// mid-line changes that ratio partway along it. The line's burst then belongs
// to one mixture and its picture to another, and the receiver decodes the
// picture against the wrong burst. Scaled so a wiper at either end passes that
// source at unity.
fn potCrossfade(a: f32, b: f32, row: u32, s: u32, n: u32, frame: u32, gen: u32, travel: f32, speed: f32) -> f32 {
  let c = potContact(row, s, frame, gen, speed);
  let x = clamp(travel + c.shift, 0.0, 1.0);
  let ga = 1.0 / (75.0 + x * MIX_POT_OHMS);
  let gb = 1.0 / (75.0 + (1.0 - x) * MIX_POT_OHMS);
  let rl = 75.0 + max(c.ohms, 0.0);
  let wiper = (a * ga + b * gb) / (ga + gb + 1.0 / rl);
  return select(2.0 * wiper * 75.0 / rl, openInput(n, frame, gen), c.ohms < 0.0);
}

fn clampIdx(i: i32) -> u32 {
  return u32(clamp(i, 0, i32(BUF_LEN) - 1));
}

// A frame store read N lines back lands in the previous frame's last lines.
fn wrapIdx(i: i32) -> u32 {
  return u32(((i % i32(BUF_LEN)) + i32(BUF_LEN)) % i32(BUF_LEN));
}

// A gain servo's state in the timing buffer. Zeroed state means the servo has
// not run yet, which is no correction, so it reads as unity. The servos never
// write a gain under 0.05.
fn servoGain(state: f32) -> f32 {
  return select(state, 1.0, state < 0.05);
}

// The receiver's IF gain from the AGC servo's state.
fn ifGain(state: f32, agc: f32) -> f32 {
  return mix(1.0, servoGain(state), agc);
}

// Raster row wrap that survives negative offsets: vertical roll runs both ways
// (the v-osc detunes either side of 60 Hz) and u32() of a negative float is
// undefined in WGSL.
fn wrapRow(r: i32) -> u32 {
  return u32(((r % i32(NLINES)) + i32(NLINES)) % i32(NLINES));
}

fn pcg(v: u32) -> u32 {
  var s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

fn rand01(v: u32) -> f32 {
  return f32(pcg(v)) / 4294967295.0;
}

fn gauss(seed: u32) -> f32 {
  let a = max(rand01(seed), 1e-7);
  let b = rand01(seed ^ 0x9E3779B9u);
  return sqrt(-2.0 * log(a)) * cos(2.0 * PI * b);
}

// A counter that is not holding its count. Both of a character generator's
// address counters are clocked by the dot chain and reset off blanking, and
// either one drops or gains a count when a reset arrives late or an edge is
// missed. Nothing puts the count back, so the error accumulates.
//
// The caller passes the tick that the failed reset should have cleared, which
// is what decides the artifact. Count frames and the vertical reset is the one
// arriving late, so the whole block sits an address further out every frame and
// the text crawls. Count lines and the horizontal reset is the late one while
// the vertical still clears it, so the error grows down the page from nothing
// at the top and every row of text is damaged differently.
//
// A held pin is the machine being wrong in a fixed way. A slipping counter is
// the machine being wrong at a rate, and a frame-rate one is the only bend on
// either chip that changes while you watch it.
//
// The rate is counts per tick, so 0.05 a frame is one count every twenty
// frames. Signed, because a counter can slip either way.
fn counterSlip(rate: f32, ticks: u32, span: u32) -> u32 {
  if (rate == 0.0) {
    return 0u;
  }
  let m = i32(span);
  return u32(((i32(floor(rate * f32(ticks))) % m) + m) % m);
}

// A character generator's font memory as it is wired. Both boxes hold their own
// pins on their own chip and pass them in here. The part is the same part in
// both racks, so the wiring is written once and the knobs stay separate.
//
// The address the generator presents is the character code in the high lines
// and the row inside the cell in the low ones, formed by the multiply the row
// counter drives. Three faults land on that bus and they are separate faults.
//
// stride is the cell-height strap, which tells the counter how far apart two
// glyphs sit in the array. Strap it for a taller or shorter cell than the ROM
// was masked for and the address walks out of the cell the raster is drawing:
// every scan line of a character comes off a different character, and a line of
// text shears into a diagonal slice of the whole font.
//
// cross is two adjacent lines transposed — a socket seated a pin over, two
// traces swapped on the board. Low in the bus it shuffles the scan lines inside
// every cell, high in the bus it permutes the font in blocks, and on the
// boundary between the two fields it folds the row count into the character
// code.
//
// hold is one line jumpered high.
//
// The part is a 2 KiB EPROM on eleven address lines, A0 to A10, and the font
// occupies the low 1152 bytes of it. A bent address reaches the 896 above that
// too, which were never programmed, so the caller answers those from ROM_ERASED
// and whole characters come back solid.
fn romAddr(glyph: u32, row: u32, stride: f32, cross: f32, hold: f32, slip: u32) -> u32 {
  var addr = glyph * u32(max(f32(GLYPH_H) + stride, 1.0)) + row + slip;
  if (cross > 0.5) {
    let b = u32(cross - 1.0);
    let two = (addr >> b) & 3u;
    addr = (addr & ~(3u << b)) | ((((two & 1u) << 1u) | (two >> 1u)) << b);
  }
  if (hold > 0.5) {
    addr = addr | (1u << u32(hold - 1.0));
  }
  return addr & (ROM_SPAN - 1u);
}

// The eight dots of one row, out of the array and through the data pins.
//
// rot is stored charge that has leaked away. A cell that has lost it reads
// back as the erased state, so the damage is a fixed pattern in the die and the
// same character comes out wrong the same way every frame. Which state that is
// depends on how the font was masked into the part: positive erases to a lit
// dot, negative to a dark one.
//
// seed is which die. Two parts off the same tape decay in different places, so
// the boxes pass different constants and one rot setting damages a letter
// differently in each, which is the reason they have separate knobs at all.
//
// hold is one data line jumpered, which stripes a column down every character.
fn romData(stored: u32, addr: u32, seed: u32, rot: f32, hold: f32) -> u32 {
  var bits = stored;
  let r = min(abs(rot), 1.0);
  if (r > 0.0) {
    let t = u32(r * 256.0);
    let h = vec2u(pcg(addr * 2u + seed), pcg(addr * 2u + 1u + seed));
    var gone = 0u;
    for (var i = 0u; i < 4u; i = i + 1u) {
      if (((h.x >> (i * 8u)) & 0xffu) < t) { gone = gone | (1u << i); }
      if (((h.y >> (i * 8u)) & 0xffu) < t) { gone = gone | (1u << (i + 4u)); }
    }
    if (rot > 0.0) {
      bits = bits | gone;
    } else {
      bits = bits & ~gone;
    }
  }
  let d = i32(hold);
  if (d > 0) {
    bits = bits | (1u << u32(d - 1));
  } else if (d < 0) {
    bits = bits & ~(1u << u32(-d - 1));
  }
  return bits;
}

// The page-address counter, which walks the page memory as the raster crosses
// the block: the column in its low lines, the row in its high ones. Hold a low
// line and columns repeat across the box; hold a high one and a row of text
// stands in for the row above it. Every character is still spelled correctly by
// an undamaged font, sitting in a cell it was never written to. Slip the counter
// instead of holding a line on it and the whole page walks through itself, a few
// cells a field.
fn pageAddr(row: u32, col: u32, hold: f32, slip: u32) -> u32 {
  var idx = row * CC_COLS + col + slip;
  if (hold > 0.5) {
    idx = idx | (1u << u32(hold - 1.0));
  }
  return idx % (CC_ROWS * CC_COLS);
}

// What a detector hands back when the signal it was demodulating is not there.
// The two shapes are not interchangeable and both are used several times over,
// which is the reason they live here rather than being retyped at each site.
//
// rfNull is an RF envelope collapsing: the limiter is still running, so what
// comes out is the front end's own noise about blanking — zero-mean, and it
// takes sync and burst with it wherever it lands. This is a mistracked head, a
// clogged one, a track crossing, a splice crossing the gap.
//
// dropoutNull is oxide that is simply not there: no RF at all, so the detector
// sits at the top of its range and the gap reads as a bright streak rather than
// as hash. The lift is the whole visual difference between the two.
fn rfNull(v: f32, amt: f32, seed: u32) -> f32 {
  return mix(v, 45.0 * gauss(seed), clamp(amt, 0.0, 0.95));
}

fn dropoutNull(v: f32, amt: f32, seed: u32) -> f32 {
  return mix(v, 55.0 + 45.0 * gauss(seed), amt);
}

// Off play speed the spinning head no longer follows a single recorded track:
// each sweep crosses |speed - 1| of them and the RF envelope nulls at every
// crossing, so that many noise bars sweep the frame. One definition, in the
// prelude rather than in the channel block, because it is the drum losing the
// signal — anything else reading it back would have to agree with this or say
// it was a different machine.
fn shuttleNull(v: f32, row: u32, bars: f32, phase: f32, seed: u32) -> f32 {
  if (bars == 0.0) {
    return v;
  }
  let ab = abs(bars);
  let fx = fract(f32(row) / f32(NLINES) * ab + phase);
  let dLines = min(fx, 1.0 - fx) / ab * f32(NLINES);
  let half = 8.0;
  if (dLines >= half) {
    return v;
  }
  return rfNull(v, (1.0 - dLines / half) * 1.7, seed);
}

// One step of the color-under heterodyne phasor, shared by the record side
// (under_down) and the playback up-conversion (channel). Both walk the same
// (fsc - f_under) per sample, so the step is one constant and one rotation.
const HET_STEP = 2.0 * PI * DOWN_PER_SAMPLE;

fn stepPhasor(p: vec2f) -> vec2f {
  let c = cos(HET_STEP);
  let s = sin(HET_STEP);
  return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
}

fn luma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.299, 0.587, 0.114));
}

// The screen is light from decode's store onward (docs/adr/0014). Drive, the
// decoded signal, is gamma-encoded; the phosphor layer, crt_face and present
// all work in linear light, held in rgba8unorm textures as sRGB bytes so the
// sampler decodes them for free through an rgba8unorm-srgb view. toLight
// and toDrive are that same transfer, so a byte written through them and read
// back through the view is the byte it was.
fn toLight(c: vec3f) -> vec3f {
  let lo = c / 12.92;
  let hi = pow((max(c, vec3f(0.0)) + 0.055) / 1.055, vec3f(2.4));
  return select(hi, lo, c <= vec3f(0.04045));
}

fn toDrive(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return clamp(select(hi, lo, c <= vec3f(0.0031308)), vec3f(0.0), vec3f(1.0));
}

// The gun's transfer: cutoff makes the background true black (drive below
// the knee emits nothing) and gamma is the gun's luminance response
// (highlights bloom, shadows recede). Applied once, where decode writes the
// screen, so crt_face's gathers read emitted light and pay no pow per tap —
// three a tap across some fifty taps was a millisecond a frame on a look with
// gamma, spot, bloom and halation all up. Identity at cutoff 0, gamma 1. The
// saturation stage stays in crt_face: it can leave 0..1, which an 8-bit store
// would clip, and it is a dot and a mix, not a transcendental.
fn gunTransfer(c: vec3f, cutoff: f32, gamma: f32) -> vec3f {
  if (cutoff <= 0.0 && gamma == 1.0) {
    return c;
  }
  let d = max(c - vec3f(cutoff), vec3f(0.0)) / max(1.0 - cutoff, 1e-3);
  if (gamma != 1.0) {
    return pow(d, vec3f(gamma));
  }
  return d;
}

// RGB -> YUV baseband, the encoder's matrix. Read straight off a source texel
// by each encoder pass; there is no yuv buffer between a picture and its
// composite any more (docs/OPTIMIZATIONS.md).
fn yuvOf(rgb: vec3f) -> vec3f {
  let y = luma(rgb);
  return vec3f(y, 0.492 * (rgb.b - y), 0.877 * (rgb.r - y));
}

// YUV -> RGB, the receiver's matrix.
fn rgbOf(yuv: vec3f) -> vec3f {
  return vec3f(
    yuv.x + 1.140 * yuv.z,
    yuv.x - 0.395 * yuv.y - 0.581 * yuv.z,
    yuv.x + 2.032 * yuv.y,
  );
}

// Source B's texel, bob-deinterlaced when B's toggle is on: the same field
// rebuild compose's pick() does for A, so an interlaced grabber combs on neither
// deck. Off texel loads rather than a sampler tap, because B's texture *is* the
// raster — there is no compose stage on this side to resample through.
//
// A prelude function taking the texture rather than three copies of the
// arithmetic, and that is the point of it: three passes read srcTexB (the two
// encoders and the mixer's genlocked path), and a copy that drifted would take
// luma off one field and chroma off the other — a picture whose colour sits one
// line above its edges, on motion only, which is not a thing anyone would think
// to look for.
fn srcTexelB(tex: texture_2d<f32>, x: i32, y: i32, deint: f32) -> vec3f {
  return srcTexelAlphaB(tex, x, y, deint).rgb;
}

// B's texel with its alpha, which leaves the source on a wire of its own, the
// key output beside the fill, and goes through the same deinterlacer.
fn srcTexelAlphaB(tex: texture_2d<f32>, x: i32, y: i32, deint: f32) -> vec4f {
  var texel = textureLoad(tex, vec2i(x, y), 0);
  if (deint > 0.5) {
    let e = y - (y & 1);
    let n = min(e + 2, i32(ACTIVE_H) - 1);
    texel = mix(textureLoad(tex, vec2i(x, e), 0), textureLoad(tex, vec2i(x, n), 0), f32(y - e) * 0.5);
  }
  return texel;
}

// Gamut limit by desaturation. A hard per-channel clamp on an out-of-gamut
// colour only clips the overflowing channel, which rotates hue toward the
// remaining primaries — saturated content goes duller and wrong at the clipping
// point. This instead pulls the colour toward its own (clamped) luma along the
// chroma axis just far enough to re-enter the cube, so hue is preserved and a
// real tube's saturated highlights stay electric. In-gamut colours are returned
// unchanged.
//
// slack is how much of that pullback the limiter declines to apply — a ratio on
// one operation, not a crossfade between two different mappings. At 0 the
// colour is brought fully inside; at 1 nothing is pulled back and the three
// guns simply run into their rails one at a time, which is what a set with no
// limiter ahead of them does, and is why an overdriven picture on one migrates
// toward the primaries instead of holding its hue.
fn gamutLimit(c: vec3f, slack: f32) -> vec3f {
  let y = luma(c);
  let l = clamp(y, 0.0, 1.0);
  let d = c - vec3f(y);
  let moves = abs(d) > vec3f(1e-5);
  // how much of d each channel has left before it hits 0 or 1; a channel that
  // barely moves along the chroma axis constrains nothing
  let room = select(vec3f(l), vec3f(1.0 - l), d > vec3f(0.0));
  let reach = select(vec3f(1.0), room / max(abs(d), vec3f(1e-5)), moves);
  let s = clamp(min(reach.x, min(reach.y, reach.z)), 0.0, 1.0);
  return clamp(vec3f(l) + mix(s, 1.0, slack) * d, vec3f(0.0), vec3f(1.0));
}

// An amplifier running out of supply. A hard clamp is a knife edge that mints a
// step wherever the signal touches it; a real stage's gain falls away as it
// approaches the rail, so what comes back is compressed instead of flattened
// and keeps its structure. That falling gain is also a nonlinearity, which is
// the whole reason a stage past its headroom manufactures sum and difference
// products out of whatever carriers are sharing the bus with it.
//
// Shared by the loop's output stage and the mixer's summing bus, which is two
// amplifiers of the same kind at two points on the board.
fn softRail(v: f32, hi: f32, hiSoft: f32, lo: f32, loSoft: f32) -> f32 {
  var out = v;
  if (v > hi) {
    let t = (v - hi) / hiSoft;
    out = hi + hiSoft * t / (1.0 + t);
  } else if (v < lo) {
    let t = (lo - v) / loSoft;
    out = lo - loSoft * t / (1.0 + t);
  }
  return out;
}

fn gamutFit(c: vec3f) -> vec3f {
  return gamutLimit(c, 0.0);
}

// Catmull-Rom fractional-delay read. Linear interpolation is -6 dB at fsc for
// half-sample offsets, so chroma pumps as a delay wanders; the cubic stays
// flat past fsc. t = 0 returns p1 exactly.
fn catmull(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
  return p1 + 0.5 * t * (p2 - p0 + t * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t * (3.0 * (p1 - p2) + p3 - p0)));
}

// Same curve on a colour, for the display-side horizontal reconstruction.
fn catmull3(p0: vec3f, p1: vec3f, p2: vec3f, p3: vec3f, t: f32) -> vec3f {
  return p1 + 0.5 * t * (p2 - p0 + t * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t * (3.0 * (p1 - p2) + p3 - p0)));
}

// One band-limited deviate field, correlated along the scan and nowhere else.
// Noise cannot change faster than the path it came through allows, so the field
// is a lattice of independent deviates at grain active pixels, interpolated
// along x — and independent line to line, because successive lines are
// successive moments in time and the noise is not on the picture, it is in the
// wire. The interpolation costs variance as the grain widens, which is not an
// artifact to correct: a narrower path passes less noise power.
fn noiseFieldX(x: f32, y: u32, grain: f32, seed: u32) -> f32 {
  let ry = (y * 2246822519u) ^ seed;
  // The lattice gets its own phase per row and per frame (ry carries both).
  // Interpolating two deviates costs variance where it lands mid-cell and none
  // at a lattice point, so a lattice fixed in x would ripple the noise power
  // with it — a standing ladder of quieter columns, one per cell, in a
  // mechanism that has no fixed structure anywhere.
  let p = x / max(grain, 1.0) + rand01(ry);
  let i = u32(p);
  let t = fract(p);
  let a = gauss(i ^ ry);
  let b = gauss((i + 1u) ^ ry);
  // Smoothstep rather than linear: a triangular blend leaves a visible kink at
  // every lattice point, which reads as a texture the mechanism never had.
  return mix(a, b, t * t * (3.0 - 2.0 * t));
}

// The playback head's own aperture, active px. A second bandwidth in series
// with whatever the noise arrived with, and the reason blank tape is coarse
// where an untuned tuner is fine.
const TAPE_APERTURE_PX = 3.4;

// Which noise field is on screen. A source whose own refresh is slower than the
// display holds each field for several frames, and a non-integer ratio holds
// them unevenly — the same cadence 3:2 pulldown has, from the same arithmetic.
fn noiseFrame(frame: u32, hold: f32) -> u32 {
  return u32(f32(frame) / max(hold, 1.0));
}

// The GPU-generated no-signal sources, shared by A (compose) and B (compose_b)
// so the two cannot drift apart. What separates the two is where the noise is
// detected, which decides its distribution — the knobs (grain, per-sweep level
// error, noise power, refresh rate) are statistics of the path and apply to
// both. Deliberately monochrome: neither source carries a subcarrier, so any
// colour on screen is the receiver's decoder failing on noise, which is the
// killer's and the comb's business rather than something to paint in here.
// slot keeps A's and B's snow apart: their frame counters run within one of
// each other, so a seed off the frame alone hands both sources the same field.
fn snowSource(slot: u32, mode: f32, xy: vec2u, frame: u32, grain: f32, lineShare: f32, level: f32) -> vec3f {
  let sd = pcg(frame * 2654435761u + slot * 0x68e31da4u);
  let x = f32(xy.x);
  var v: f32;
  if (mode < 1.5) {
    // An untuned tuner: the IF carries noise and no carrier at all, so what the
    // envelope detector recovers is |n| with n complex — Rayleigh, not Gaussian.
    // That asymmetry is where snow's sparse hard specks over a dense dark floor
    // come from; a symmetric field reads as evenly lit fuzz instead.
    let i = noiseFieldX(x, xy.y, grain, sd ^ 0x9e3779b9u);
    let q = noiseFieldX(x, xy.y, grain, sd ^ 0x85ebca6bu);
    v = level * 0.4 * sqrt(i * i + q * q);
  } else {
    // Blank tape: no RF to lock to, so the FM demodulator's limiter free-runs on
    // its own noise and the discriminator hands back a level wandering across
    // the deviation band. Bounded rather than spiky — a limiter cannot hand back
    // a spike — and centred, because the deemphasis network still sets the DC.
    let g = noiseFieldX(x, xy.y, sqrt(grain * grain + TAPE_APERTURE_PX * TAPE_APERTURE_PX), sd ^ 0x9e3779b9u);
    v = 0.5 + level * 0.34 * tanh(g);
  }
  // A level error is a gain error — the tuner's AGC hunting on the noise it is
  // measuring, the head's contact varying sweep to sweep — so it multiplies the
  // noise it is amplifying, and it is one number for the whole line because
  // that is how long a sweep lasts.
  let ln = gauss((xy.y * 2654435761u) ^ sd ^ 0x5bf03635u);
  v = v * max(1.0 + lineShare * 0.7 * ln, 0.0);
  return vec3f(clamp(v, 0.0, 1.0));
}

// The synth's patch, gathered so the generator can live here beside snowSource
// instead of in one of its two callers. Params travel as arguments for the same
// reason snowSource's statistics do: the prelude is prepended to every shader,
// including the ones that bind no uniform block at all, so nothing in it may
// name P.
struct SynthPatch {
  phaseA: f32,
  perLineA: f32,
  perSampleA: f32,
  phaseB: f32,
  perLineB: f32,
  perSampleB: f32,
  shape: f32,
  combine: f32,
  level: f32,
  color: f32,
  hue: f32,
  // Picture luma into oscillator A's frequency input, cycles per sample per
  // unit luma. The classic video-synth patch, and the one thing in here that
  // needs a picture to exist: with the oscillator's frequency a function of
  // brightness, equal-brightness regions run at equal frequency and the wave
  // arrives at each of them in a different place, so the image draws itself as
  // contour lines nobody traced.
  fm: f32,
  // The colorizer's two connectors: what it slices (0 the oscillator, 1 the
  // picture) and how (0 the phase rotator, 1 three comparators).
  colorSrc: f32,
  colorMode: f32,
  jitA: f32,
  jitB: f32,
  frame: u32,
  bSrc: f32,
  shapeX: f32,
  shapeY: f32,
  shapeSize: f32,
  shapeFold: f32,
  dirt: f32,
}

// Gathering the patch off the uniform block, once. The prelude may not name a
// binding, but it declares Params itself, so taking one by value is legal here
// and keeps the field list in a single place — a second copy in each of the two
// callers is exactly how a generator ends up doing different things in the two
// slots it is supposed to be identical in.
fn synthPatch(p: Params) -> SynthPatch {
  return SynthPatch(
    p.synthPhaseA, p.synthPerLineA, p.synthPerSampleA,
    p.synthPhaseB, p.synthPerLineB, p.synthPerSampleB,
    p.synthShape, p.synthMix, p.synthLevel, p.synthColor, p.synthHue,
    p.synthFm, p.synthColorSrc, p.synthColorMode,
    p.synthJitA, p.synthJitB, p.frame,
    p.synthBSrc, p.synthShapeX, p.synthShapeY, p.synthShapeSize,
    p.synthShapeFold, p.synthDirt,
  );
}

// One oscillator through the waveform selector, at phase cyc in cycles. All
// four shapes come back 0..1 so the combiner and the colorizer below never
// have to know which one is patched.
fn synthWave(cyc: f32, shape: f32) -> f32 {
  let p = fract(cyc);
  if (shape < 0.5) {
    return p;
  }
  if (shape < 1.5) {
    return 1.0 - abs(2.0 * p - 1.0);
  }
  if (shape < 2.5) {
    return 0.5 + 0.5 * sin(2.0 * PI * p);
  }
  return select(0.0, 1.0, p < 0.5);
}

// The same four shapes from a worn discrete oscillator, dirt of the way from
// the ideal circuit. The ramp is a capacitor charged through a resistor, so it
// bows over near the top, and its reset transistor takes a while to dump the
// charge. The triangle's two currents are mismatched, so its peak leans. The
// sine comes off a diode shaper and keeps some of the triangle's lean. The
// square's buffer is slew-limited and its tops droop through the output
// capacitor. Every fast edge then rings in the cable, which leaves a few faint
// echoes of the edge beside it.
fn dirtyWave(cyc: f32, shape: f32, samplesPerCycle: f32, dirt: f32) -> f32 {
  let p = fract(cyc);
  let len = max(samplesPerCycle, 4.0);
  var w = 0.0;
  var sinceEdge = 1e4;
  var edgeStep = 0.0;
  if (shape < 0.5) {
    let resetFrac = min((2.0 + 30.0 * dirt) / len, 0.5);
    let k = 2.5 * dirt;
    if (p < 1.0 - resetFrac) {
      w = (1.0 - exp(-k * p / (1.0 - resetFrac))) / (1.0 - exp(-k));
    } else {
      let into = (p - (1.0 - resetFrac)) / resetFrac;
      w = exp(-4.0 * into) * (1.0 - into);
    }
    sinceEdge = p * len;
    edgeStep = -1.0;
  } else if (shape < 1.5) {
    let peak = 0.5 + 0.15 * dirt;
    let lin = select((1.0 - p) / (1.0 - peak), p / peak, p < peak);
    let k = 1.5 * dirt;
    w = (1.0 - exp(-k * lin)) / (1.0 - exp(-k));
  } else if (shape < 2.5) {
    let bent = 2.0 * PI * p + 0.5 * dirt * sin(2.0 * PI * p);
    w = 0.5 + 0.5 * sin(bent);
  } else {
    let duty = 0.5 + 0.08 * dirt;
    let rise = 1.0 + 8.0 * dirt;
    let high = p < duty;
    let t = select((p - duty) * len, p * len, high);
    let half = select((1.0 - duty) * len, duty * len, high);
    let droop = 0.3 * dirt * t / half;
    let settled = select(droop, 1.0 - droop, high);
    let before = select(1.0, 0.0, high);
    w = mix(before, settled, smoothstep(0.0, rise, t));
    sinceEdge = t;
    edgeStep = select(-1.0, 1.0, high);
  }
  let ring = 0.35 * dirt * edgeStep * exp(-sinceEdge / 7.0) * sin(2.0 * PI * sinceEdge / 11.0);
  return w + ring;
}

// The noise of a worn circuit, band-limited to about a megahertz along the
// line, fresh every line and every frame, so a comparator that chatters on it
// tears short streaks out of its edge.
fn circuitNoise(rowU: u32, s: f32, frame: u32, seed: u32) -> f32 {
  let cell = floor(s / 10.0);
  let u = s / 10.0 - cell;
  let base = pcg((rowU * 7919u) ^ (frame * 2654435761u) ^ seed);
  let lo = rand01(pcg(base ^ u32(cell)));
  let hi = rand01(pcg(base ^ u32(cell + 1.0)));
  return mix(lo, hi, u * u * (3.0 - 2.0 * u)) * 2.0 - 1.0;
}

// The synth's supply ripple: the rectifier's 120 Hz, which the field rate does
// not divide, so it crawls slowly up the raster.
fn supplyRipple(row: f32, frame: u32) -> f32 {
  return sin(2.0 * humPhase(row, frame));
}

// One oscillator through its waveform selector, clean or worn.
fn oscWave(cyc: f32, shape: f32, perSample: f32, dirt: f32) -> f32 {
  if (dirt > 0.0) {
    return dirtyWave(cyc, shape, 1.0 / max(abs(perSample), 1e-6), dirt);
  }
  return synthWave(cyc, shape);
}

// A free-running oscillator's timing error, in units of rms. Its phase noise
// accumulates, so the error is weighted toward slow wander: octaves of value
// noise over the line count since power-on, the longer periods stronger. Indexed
// by the absolute line so the wander carries across frames.
fn oscJitter(line: u32, seed: u32) -> f32 {
  var sum = 0.0;
  for (var k = 2u; k <= 10u; k += 2u) {
    let cell = line >> k;
    let u = f32(line & ((1u << k) - 1u)) / f32(1u << k);
    let lo = rand01(pcg(cell ^ seed ^ (k * 0x9E3779B9u)));
    let hi = rand01(pcg((cell + 1u) ^ seed ^ (k * 0x9E3779B9u)));
    let v = mix(lo, hi, u * u * (3.0 - 2.0 * u)) * 2.0 - 1.0;
    sum += v * pow(f32(1u << k) / 1024.0, 0.38);
  }
  return sum * 1.62;
}

// A shape generator: a horizontal ramp reset by H drive and a vertical one
// reset by V drive, so it holds still on the raster. Each ramp is offset by a
// position knob and full-wave rectified into a V. Adding the two Vs makes a
// diamond, squaring and adding them makes a circle, and a non-additive mixer
// passing whichever is larger makes a rectangle. The horizontal ramp is scaled
// to the 4:3 picture so the shapes come out round.
//
// Worn, each drive ramp is an RC charge that bows, and the supply ripple rides
// on the horizontal one, so the shape comes out lopsided and its outline
// wobbles with the mains. A wavefolder's diodes turn over gradually, so the
// folds round off.
fn shapeGen(x: f32, y: f32, sp: SynthPatch) -> f32 {
  var hr = 2.0 * (x + 0.5) / f32(ACTIVE_W);
  var vr = 2.0 * (y + 0.5) / f32(ACTIVE_H);
  if (sp.dirt > 0.0) {
    let k = 0.8 * sp.dirt;
    hr = 2.0 * (1.0 - exp(-k * hr * 0.5)) / (1.0 - exp(-k));
    vr = 2.0 * (1.0 - exp(-k * vr * 0.5)) / (1.0 - exp(-k));
    hr = hr + 0.03 * sp.dirt * supplyRipple(y + f32(ACTIVE_TOP), sp.frame);
  }
  let h = abs(hr - 1.0 - sp.shapeX) * (4.0 / 3.0);
  let v = abs(vr - 1.0 - sp.shapeY);
  var level = max(h * 0.75, v);
  if (sp.bSrc < 1.5) {
    level = (h + v) * 0.5;
  } else if (sp.bSrc < 2.5) {
    level = (h * h + v * v) * 0.5;
  }
  // A wavefolder: past each rail the level turns back the way it came, so a
  // cone folded N times comes out as N concentric rings.
  let t = clamp(level * sp.shapeSize, 0.0, 1.0) * sp.shapeFold;
  let folded = 1.0 - abs(2.0 * fract(t * 0.5) - 1.0);
  return mix(folded, 0.5 - 0.5 * cos(PI * t), sp.dirt);
}

// The synth's output level before the colorizer, at one raster position
// (blanking included, so the delay line in feed.wgsl can read it under sync).
fn synthOut(rowU: u32, sU: u32, sp: SynthPatch, pic: f32, audio: vec2f) -> f32 {
  let row = f32(rowU);
  let s = f32(sU);
  // The FM term multiplies the sample index, not the phase, because pulling an
  // oscillator's frequency is not the same as offsetting its phase: phase
  // modulation would slide the pattern about, where this makes the wave
  // genuinely run faster through bright picture and slower through dark, so the
  // spacing of the bars is the brightness. It reads the picture at this pixel
  // alone — a control line has no memory of where it has been — which is why
  // the contours land on the picture rather than trailing it.
  let line = sp.frame * NLINES + rowU;
  var slipA = 0.0;
  var slipB = 0.0;
  if (sp.jitA != 0.0 || sp.jitB != 0.0) {
    slipA = sp.jitA * oscJitter(line, 0x51a3u);
    slipB = sp.jitB * oscJitter(line, 0xb07cu);
  }
  // A worn synth's supply ripple pulls both timing capacitors' charge current,
  // so the frequency wobbles at 120 Hz, and it rides on the output level too.
  var ripple = 0.0;
  if (sp.dirt > 0.0) {
    ripple = supplyRipple(row, sp.frame);
  }
  let fmA = sp.perSampleA * (1.0 + 0.012 * sp.dirt * ripple);
  let fmB = sp.perSampleB * (1.0 + 0.012 * sp.dirt * ripple);
  var a = oscWave(sp.phaseA + slipA + audio.x + sp.perLineA * row + (fmA + sp.fm * pic + audio.y) * s, sp.shape, sp.perSampleA, sp.dirt);
  var b = 0.0;
  if (sp.bSrc > 0.5) {
    b = shapeGen(s - f32(ACTIVE_START), row - f32(ACTIVE_TOP), sp);
  } else {
    b = oscWave(sp.phaseB + slipB + sp.perLineB * row + fmB * s, sp.shape, sp.perSampleB, sp.dirt);
  }
  if (sp.dirt > 0.0) {
    a = a + 0.06 * sp.dirt * circuitNoise(rowU, s, sp.frame, 0x2a17u);
    b = b + 0.06 * sp.dirt * circuitNoise(rowU, s, sp.frame, 0x7c31u);
  }
  var g = a;
  if (sp.combine > 0.5 && sp.combine < 1.5) {
    // A summing amplifier, referenced to mid-video: two signals added run into
    // the rails rather than wrapping, which is what makes a sum read as two
    // patterns lying over each other instead of a third pattern.
    g = clamp(a + b - 0.5, 0.0, 1.0);
  } else if (sp.combine > 1.5 && sp.combine < 2.5) {
    // Doubly-balanced multiply, both inputs referenced to mid so both carriers
    // are suppressed and only the sum and difference survive (the same bridge
    // the mixer loop's ring mod uses). Two free-running oscillators beating
    // against each other draw a moire whose own beat rate is the difference of
    // two frequency errors, so it breathes at a rate neither knob names.
    g = clamp(0.5 + 2.0 * (a - 0.5) * (b - 0.5), 0.0, 1.0);
  } else if (sp.combine > 2.5) {
    // A comparator with the second oscillator on its reference input: hard
    // two-level output, and the threshold is itself a moving waveform, so the
    // duty cycle is modulated everywhere the two patterns cross.
    // Worn, its gain is finite, so the edge is a short ramp, and the noise on
    // both inputs makes it chatter back and forth across that ramp.
    g = select(select(0.0, 1.0, a > b), clamp(0.5 + (a - b) / (0.06 * sp.dirt), 0.0, 1.0), sp.dirt > 0.0);
  }
  let level = sp.level * (1.0 + 0.08 * sp.dirt * ripple);
  return clamp(0.5 + level * (g - 0.5), 0.0, 1.0);
}

// A video synthesizer patched into a slot: two oscillators, a combiner and a
// colorizer, generating a picture instead of photographing one. Shared by A
// (compose) and B (compose_b) the same way snowSource is, so the two slots
// cannot drift apart.
//
// The whole instrument is one idea: an oscillator running free against a fixed
// raster. Nothing here draws a bar, a gradient or a diagonal — it sets a
// frequency, and what a frequency error against 15.734 kHz looks like is the
// picture. Sit an oscillator on line rate and its phase walk per line is zero,
// so it paints one standing vertical edge; a few hertz off and every line
// starts a little later than the last, which leans the bars and creeps them
// frame to frame. Wind it down to field rate and the same ramp becomes a
// vertical gradient — a ramp generator IS an oscillator locked to drive, which
// is why one knob covers both. Wind it up to 3.579545 MHz and it lands on the
// subcarrier, so the encoder downstream reads the whole screen as chroma and
// hands back flat colour; detune it from there and the hue turns across the
// picture on its own.
//
// Phase is counted from the sample index including blanking, because a bench
// oscillator does not stop for the retrace — the picture is a window onto a
// wave that was already running, and that offset is part of where the pattern
// lands.
// audio is this line's entry from SynthState.audioLines: the phase the audio
// input has added before the line starts, and its extra walk per sample.
fn videoSynth(xy: vec2u, sp: SynthPatch, pic: f32, colorPic: f32, audio: vec2f) -> vec3f {
  let lvl = synthOut(ACTIVE_TOP + xy.y, ACTIVE_START + xy.x, sp, pic, audio);
  // What the colorizer is slicing. Its own oscillator is one connector and the
  // picture is the other, and the second is the arrangement a colorizer was
  // actually sold as: video in, colour out, the oscillators out of circuit.
  // Pointed at the picture the box turns the image's own brightness into hue,
  // so equal-brightness areas come back the same colour however far apart they
  // are on screen — which is what makes it lay colour down in large fields
  // instead of on the detail an encoder puts colour on.
  let cin = select(lvl, clamp(colorPic, 0.0, 1.0), sp.colorSrc > 0.5);
  var tint: vec3f;
  if (sp.colorMode > 0.5) {
    // Three comparators at three thresholds, which is how the cheap boxes did
    // it before anyone put a phase shifter in one. Each gun is switched full on
    // or full off at its own level, so the output can only be one of eight
    // corners of the cube and the picture arrives posterized into flat areas of
    // saturated primary with hard edges between them. The hue knob slides all
    // three thresholds together, which walks the boundaries through the
    // picture's tonal range rather than turning the colours.
    let thr = vec3f(0.3, 0.5, 0.7) + sp.hue * (0.5 / PI) - 0.25;
    tint = step(thr, vec3f(cin));
  } else {
    // The phase rotator: one signal into three guns through three phase shifts
    // 120 degrees apart. At depth 0 the three agree and the signal comes out
    // the grey it is; opened up, level becomes hue and a ramp turns through the
    // wheel.
    //
    // Half a turn across the level range, not a whole one. A full turn brings
    // the top of the range back to the colour the bottom started on, which is
    // fine on a ramp and useless on anything two-level: a pulse would put both
    // its states on the same hue and come out a flat field. Half a turn keeps
    // black and white opposite, which is what a level-to-hue converter is for.
    tint = 0.5 + 0.5 * cos(PI * cin + sp.hue + vec3f(0.0, -2.0943951, 2.0943951));
  }
  return clamp(mix(vec3f(lvl), tint, sp.color), vec3f(0.0), vec3f(1.0));
}
`

const PRELUDE_LINES = PRELUDE.split('\n').length - 1

// Every module is PRELUDE + the shader, so this subtracts the prelude's lines to
// point a compiler message at the shader file.
export function wgslLine(
  label: string,
  { lineNum, linePos }: Pick<GPUCompilationMessage, 'lineNum' | 'linePos'>,
): string {
  return lineNum <= PRELUDE_LINES
    ? `prelude:${lineNum}:${linePos}`
    : `${label}.wgsl:${lineNum - PRELUDE_LINES}:${linePos}`
}
