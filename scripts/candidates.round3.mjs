// Round 3 of preset screening: the mechanisms no shipped preset reaches for.
//
//   node scripts/contact.mjs scripts/candidates.round3.mjs docs/contact <url>
//
// Seventy-five controls appeared in no preset when this was written — the
// whole chyron and caption family, the PiP inset, every per-feed fault, tint,
// the hard polarity flip, Y/C delay, adjacent-channel leak, and the raster
// underscan among them. One candidate per family, screened in Chrome on `cat`
// with `bars` on B where a second source is the point.
//
// What this round taught:
//
//  - **Underscan needs the roll.** `vSize` alone is a still frame with the VBI
//    showing; `vHold` under about 0.4 with `vFreqHz` off 60 is what makes the
//    picture travel through the raster while the caption stays pinned.
//  - **An inverted chyron is a black frame with the picture in the type.** The
//    fill wire is black outside the glyphs, so inverting the matte keys black
//    over the whole raster. Not a fault — a look of its own, and the loop adds
//    nothing to it.
//  - **The hard polarity flip renders near black** with the AGC on or off. The
//    receiver keeps blanking at 0 rather than re-deriving it from the tip it
//    found in the negated line, so every picture sample sits below black. Same
//    finding as `reversePolarity` in docs/CURATION.md; still open.
//  - **The scorer is blind to hue.** Tint walked round the wheel and the demod
//    axes sheared read as `still, static-from-start`, because motion and
//    departure are luma numbers. Judge colour-only looks off the frame.
//  - **The colour killer is a cliff.** At 28 IRE it kills colour outright; at
//    14 it barely notices. The chatter lives in a narrow band between.
//  - **A camera loop aimed off-centre dims away** even at a 1.1 round trip with
//    the zoom under 1; the off-axis shift takes most of the picture out of the
//    frame each lap. Left unsolved.
//
// Keepers, in the order they earned it: service position v2, split phase,
// wiggled plugs v2, three servos, a hair off the crystal, clamp in the picture,
// colour parked late v2, aimed at the vcr, bent font rom, one head packed,
// tint in a slow hand, overmodulated chyron v2.

const CAPTION_NEWS = 'BREAKING NEWS\nSIGNAL LOST AT THE HEAD END'
const CAPTION_FOX = 'THE QUICK BROWN FOX\nJUMPS OVER THE LAZY DOG'

export default {
  src: 'cat',
  srcb: 'none',
  frames: 420,
  settle: 4500,
  late: 1000,
  items: [
    { name: 'ref clean', blurb: 'the source, untouched', set: '' },
    {
      name: 'service position',
      blurb:
        'underscanned so the raster shows past the picture, rolling slowly through the vertical interval',
      set: 'vSize:0.7,macrovision:0.8,cc:1,ccBox:0.9,vHold:0.5,vFreqHz:59.4,headSwitchShiftUs:2.5,headSwitchNoise:0.7,scanBeam:0.55,phosphor:0.3',
      caption: 'PLEASE STAND BY',
    },
    {
      name: 'overmodulated chyron',
      blurb:
        'a lower third at 120 IRE with the key mis-timed, the AGC pumping on the type',
      set: 'cgMix:1,cgFill:120,cgScale:3,cgY:0.42,cgKeyDelayNs:210,cgEdgeX:5,cgEdgeY:3,agc:1,soundIre:12,noiseIre:2,phosphor:0.3',
      caption: CAPTION_NEWS,
    },
    {
      name: 'letters are holes',
      blurb:
        'inverted key: a full-frame fill with the picture showing through the type, laddered by the mixer loop',
      set: 'cgMix:1,cgInvert:1,cgScale:6,cgX:0.02,cgY:0.2,cgKeyMHz:1,cgClip:0.3,cgFill:60,cfbMix:0.72,cfbGain:1,cfbLines:5,cfbDelayUs:0.3,cfbGenlock:1,phosphor:0.5',
      caption: 'VIDEO SKILLET',
    },
    {
      name: 'bent font rom',
      blurb:
        'the same words through two boxes with pins held on their font ROMs, over a noisy line 21',
      set: 'cc:1,ccBox:1,ccRomAddr:2,ccRomData:-5,cgMix:0.9,cgY:0.08,cgScale:3,cgRomAddr:9,noiseIre:10,phosphor:0.3',
      caption: CAPTION_FOX,
    },
    {
      name: 'split phase',
      blurb:
        'two feeds on opposite legs of the mains, each hum bar pushing the other way, the sync contest riding the hum',
      srcb: 'bars',
      set: 'aHumIre:32,bHumIre:-32,bGain:0.55,agc:1,hHold:0.5,phosphor:0.35',
    },
    {
      name: 'wiggled plugs',
      blurb:
        'both inputs loose in their jacks, so the receiver snaps between two geometries band by band',
      srcb: 'bars',
      set: 'aConnector:0.55,aConnectorMode:2,bConnector:0.5,bConnectorMode:0,bGain:0.6,bDetuneHz:25,hHold:0.6,phosphor:0.45',
    },
    {
      name: 'tint in a slow hand',
      blurb:
        'the tint knob walked the whole wheel while the demod axes shear, geometry never moving',
      set: 'demodAxisDeg:70,chromaGain:2.2,matrixClip:0.6,crtSat:1.3',
      mod: 'tintDeg:smooth:0.06:0.4,demodAxisDeg:sine:0.03:0.3',
    },
    {
      name: 'wandering inset',
      blurb:
        'a luma-keyed DVE inset walking the frame on its own, leaving phosphor behind it',
      srcb: 'bars',
      set: 'pipMix:1,pipW:0.45,pipH:0.45,pipBorder:0.02,pipSoft:0.01,pipKey:0.6,pipKeyLevel:0.3,pipKeySoft:0.12,phosphor:0.9,phosphorBleed:0.5',
      mod: 'pipX:walk:0.25:0.35,pipY:walk:0.2:0.35',
    },
    {
      name: 'colour three microseconds late',
      blurb:
        'the chroma path mistrimmed so far the colour slides off its edges and back, displaced rather than rotated',
      set: 'colorUnderMix:1,chromaGain:1.8,chromaNoiseIre:4,phosphor:0.2',
      mod: 'ycDelayNs:triangle:0.08:0.4',
    },
    {
      name: 'colour parked late',
      blurb: 'the same mistrim held still at 2.6 us',
      set: 'colorUnderMix:1,ycDelayNs:2600,chromaGain:1.8,chromaNoiseIre:4,phosphor:0.2',
    },
    {
      name: 'the neighbours channel',
      blurb:
        'the next channel up leaking through the trap: the wiper band, the sound weave, and a CB operator keying in',
      set: 'rfAdjacent:1,rfMistuneMHz:1.1,rfSnow:0.2,ingress:0.4,agc:1,hHold:0.45,phosphor:0.4',
    },
    {
      name: 'signal and ground swapped',
      blurb:
        'hard polarity flip, sync included: the receiver hunts for sync in what used to be peak white',
      set: 'polarityFlip:1,agc:1,hHold:0.7,vHold:0.7,phosphor:0.6,noiseIre:3',
    },
    {
      name: 'three servos',
      blurb:
        'beam limiter, auto-iris and a ringing HV tank all inside one camera loop, beating against each other',
      set: 'abl:0.9,fbIris:0.9,fbMix:0.7,fbGain:1.5,fbZoom:0.975,fbFocus:1.2,fbKnee:0.5,fbBlack:0.03,hvSagUs:35,hvRing:0.9,crtBloom:0.6,phosphor:0.5',
    },
    {
      name: 'a hair off the crystal',
      blurb:
        'the synth parked 650 Hz off the subcarrier: the encoder reads the whole screen as chroma and hue turns across it',
      set: 'synthOver:0.6,synthAHz:3580200,synthShape:2,synthLevel:1.6,chromaGain:2,svideoBleed:0.35',
      mod: 'synthAHz:smooth:0.05:0.0002',
    },
    {
      name: 'one head packed',
      blurb:
        'one of the two video heads clogged: picture and snow alternate at field rate, sync going with the dead sweep',
      set: 'headClog:0.75,colorUnderMix:0.8,chromaNoiseIre:8,hHold:0.4,phosphor:0.65',
    },
    {
      name: 'killer cannot decide',
      blurb:
        'colour killer set high over a noisy dropout-ridden burst, with a slow chroma AGC blooming colour back late',
      set: 'killThresh:28,accLagLines:140,noiseIre:16,noiseTilt:0.7,dropoutRate:50,dropoutLenUs:12,dropoutComp:1,chromaGain:1.6,phosphor:0.3',
    },
    {
      name: 'clamp in the picture',
      blurb:
        'the enhancer clamp gate slid into active video, black level set by whatever the picture is at that instant',
      set: 'enhClampUs:24,enhDroopUs:110,enhPeakMHz:1.3,enhPeakQ:0.55,enhPeakBoost:2.5,agc:0.6,phosphor:0.3',
    },
    {
      name: 'aimed at the vcr',
      blurb:
        'colorstripe bands over a VIR set that trusts a poisoned line 19, so the whole frame drifts after the bands',
      set: 'macrovision:0.7,mvStripeDeg:150,vir:1,virLag:15,agc:1,colorUnderMix:0.6,chromaGain:1.4,phosphor:0.3',
    },
    {
      name: 'core at the horizon',
      blurb:
        'camera loop collapsing inward toward a core parked high in the frame',
      set: 'fbMix:0.85,fbGain:1.12,fbZoom:0.965,fbShiftY:-0.35,fbRotateDeg:2.5,fbFocus:1,fbKnee:0.55,fbVign:0.3,fbBlack:0.03,crtBloom:0.5,noiseIre:1.5',
    },
    {
      name: 'stepped ladder',
      blurb:
        'the mixer loop rung spacing sampled and held, so the ladder jumps pitch twice a second',
      set: 'cfbMix:0.8,cfbGain:1,cfbLines:6,cfbDelayUs:0.2,cfbGenlock:1,chromaGain:1.3,phosphor:0.45',
      mod: 'cfbLines:hold:2:0.04',
    },
    // Round 3b: retunes of what the first pass missed, kept under new names so
    // the sheet shows both.
    {
      name: 'service position v2',
      blurb:
        'underscan with the vertical oscillator actually winning: the picture rolls through the raster',
      set: 'vSize:0.7,macrovision:0.8,cc:1,ccBox:0.9,vHold:0.35,vFreqHz:57,headSwitchShiftUs:2.5,headSwitchNoise:0.7,scanBeam:0.55,phosphor:0.3',
      caption: 'PLEASE STAND BY',
    },
    {
      name: 'letters are holes v2',
      blurb:
        'inverted key alone, no loop, to see what the inverted fill renders as',
      set: 'cgMix:1,cgInvert:1,cgScale:6,cgX:0.02,cgY:0.2,cgKeyMHz:1,cgClip:0.3,cgFill:70,phosphor:0.3',
      caption: 'VIDEO SKILLET',
    },
    {
      name: 'letters are holes v3',
      blurb: 'inverted key at stock clip and key bandwidth',
      set: 'cgMix:1,cgInvert:1,cgScale:6,cgX:0.02,cgY:0.2,cgFill:70,phosphor:0.3',
      caption: 'VIDEO SKILLET',
    },
    {
      name: 'overmodulated chyron v2',
      blurb: 'bigger type, hotter fill, key further off',
      set: 'cgMix:1,cgFill:120,cgScale:5,cgX:0.05,cgY:0.33,cgKeyDelayNs:280,cgEdgeX:6,cgEdgeY:4,agc:1,soundIre:14,noiseIre:2,phosphor:0.3',
      caption: 'BREAKING NEWS\nSIGNAL LOST AT THE HEAD END',
    },
    {
      name: 'wiggled plugs v2',
      blurb: 'the same two loose plugs, less far out of their jacks',
      srcb: 'bars',
      set: 'aConnector:0.35,aConnectorMode:2,bConnector:0.3,bConnectorMode:0,bGain:0.6,bDetuneHz:25,hHold:0.6,phosphor:0.5',
    },
    {
      name: 'wandering inset v2',
      blurb: 'a bigger unkeyed inset on a livelier walk',
      srcb: 'bars',
      set: 'pipMix:1,pipW:0.5,pipH:0.5,pipBorder:0.02,pipSoft:0.005,phosphor:0.92,phosphorBleed:0.5',
      mod: 'pipX:walk:2:0.5,pipY:walk:1.6:0.5',
    },
    {
      name: 'colour parked late v2',
      blurb: 'the mistrim at 1.4 us, clean chroma so the displacement reads',
      set: 'colorUnderMix:1,ycDelayNs:1400,chromaGain:2,phosphor:0.2',
    },
    {
      name: 'the neighbours channel v2',
      blurb: 'less snow, so the wiper band and the weave read',
      set: 'rfAdjacent:1,rfMistuneMHz:0.6,ingress:0.6,agc:1,hHold:0.45,phosphor:0.4',
    },
    {
      name: 'signal and ground swapped v2',
      blurb: 'hard polarity flip with the AGC off and a loose flywheel',
      set: 'polarityFlip:1,agc:0,hHold:0.3,vHold:0.8,phosphor:0.5,noiseIre:3',
    },
    {
      name: 'killer cannot decide v2',
      blurb: 'threshold down where the burst is marginal rather than dead',
      set: 'killThresh:14,accLagLines:120,noiseIre:12,noiseTilt:0.7,dropoutRate:40,dropoutLenUs:12,dropoutComp:1,chromaGain:1.8,phosphor:0.3',
    },
    {
      name: 'core at the horizon v2',
      blurb: 'the same off-centre collapse with the round trip over unity',
      set: 'fbMix:0.85,fbGain:1.3,fbZoom:0.965,fbShiftY:-0.35,fbRotateDeg:2.5,fbFocus:1,fbKnee:0.55,fbVign:0.3,fbBlack:0.03,crtBloom:0.5,noiseIre:1.5',
    },
    {
      name: 'stepped ladder v2',
      blurb: 'rung spacing held and re-drawn, no delay smear',
      set: 'cfbMix:0.8,cfbGain:1,cfbLines:8,cfbGenlock:1,chromaGain:1.3,phosphor:0.45',
      mod: 'cfbLines:hold:3:0.03',
    },
  ],
}
