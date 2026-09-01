// Hardware mixer feedback: the mixer's own output (last frame's degraded
// composite, one frame sync of delay) is routed back into an input bus and
// crossfaded against the live signal — no camera, no lens. A fader is a
// crossfade, not a sum, which is why hardware loops regress instead of
// whiting out. The loop delay knob is the cable length: each 70ns sample of
// delay spins fed-back hue 90 degrees per generation. Fed-back burst replaces
// part of live burst, so ACC pumping and color killer dropout at high mix are
// emergent. The output stage compresses into its rails rather than clipping.

// The keyer gates the crossfade with a slice of the signal it is watching, so
// the loop only regenerates on one side of that slice. Negative key amount
// inverts polarity. Two connectors decide what it is watching and what it
// slices: the key input is the loop return itself (self-key, the loop's own
// past drawing its own boundary) or program (the live picture carving the
// accumulation), and the acceptance angle takes the box off level and puts it
// on hue.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> prev: array<f32>;
@group(0) @binding(2) var<storage, read_write> comp: array<f32>;
// Program as the mixer had it, before this pass crossfades over it. Only the
// keyer's external key input reads it, and the pipeline only refreshes it on
// the frames that input is patched in.
@group(0) @binding(3) var<storage, read> prog: array<f32>;

// The loop amplifier's output stage. A hard rail pins runaway energy into
// flat white; a real stage compresses into its rails, so past the knee the
// gain falls away smoothly and a loop above unity folds into glowing bands
// that keep their structure instead of whiting out. The compression also
// manufactures harmonics, which is what an overdriven bus genuinely does —
// more sidebands for the next lap to chew on. Identity below the knee, so a
// loop that never runs away never notices the stage is there.
fn rails(v: f32) -> f32 {
  if (v > 110.0) {
    let t = (v - 110.0) / 30.0;
    return 110.0 + 30.0 * t / (1.0 + t);
  }
  if (v < -50.0) {
    let t = (-50.0 - v) / 10.0;
    return -50.0 - 10.0 * t / (1.0 + t);
  }
  return v;
}

// The keyer's key aperture: a 4-sample boxcar, which at 4x fsc spans one
// subcarrier cycle exactly. Summed, that nulls the chroma and leaves the
// luma; the same four taps dotted against the carrier lattice they arrived on
// are the U and V of the same sample. One aperture, both things the box can
// slice on, and no trig either way — the lattice is four unit vectors.
//
// `ext` is the key-input connector. Self reads the loop return at the delayed
// position, so the boundary is a generation old and moves with the delay;
// program reads what the mixer handed the loop this frame, so the boundary is
// now and a subject moving through the frame carves it. Both are referenced to
// the output lattice, which is what makes the delay a hue rotation the keyer
// can see rather than one it is blind to.
//
// Branched rather than selected between: `select` evaluates both arms, and the
// arm this one does not want is a read of `comp` at the neighbours of a sample
// every other invocation is about to write. `ext` is one uniform for the whole
// dispatch, so the branch is coherent and costs nothing.
struct KeyTap {
  luma: f32,
  uv: vec2f,
}

fn keyTap(pos: f32, n: u32, ext: bool) -> KeyTap {
  let i0 = select(i32(floor(pos)) - 1, i32(n) - 1, ext);
  var y = 0.0;
  var uv = vec2f(0.0);
  for (var k = 0u; k < 4u; k = k + 1u) {
    var v = 0.0;
    if (ext) {
      v = prog[clampIdx(i0 + i32(k))];
    } else {
      v = prev[clampIdx(i0 + i32(k))];
    }
    y = y + v;
    uv = uv + v * carrier(n + k + 3u, P.frame);
  }
  return KeyTap(y * 0.25, uv * 0.5);
}

// Below this much chroma amplitude there is no phase to slice: a demodulator
// handed an unsaturated sample reports an essentially arbitrary angle, and a
// loop keyed on that would flicker its own territory out of noise. 3 IRE
// against a saturated primary's ~30 on this bus.
const KEY_CLIP = 3.0;

fn keyGate(tap: KeyTap) -> f32 {
  if (P.cfbKeyAccept <= 0.0) {
    return smoothstep(P.cfbKeyLevel - P.cfbKeySoft, P.cfbKeyLevel + P.cfbKeySoft, tap.luma);
  }
  // A chroma keyer in the loop return instead of a luma one. Self-limiting on
  // the self-key, because the loop delay is a hue rotation: a region
  // regenerates until its own return has spun out of the wedge, stops, and
  // whatever has spun in takes the territory over. The softness knob is in IRE
  // of a 100 IRE slice, so it carries over as the same fraction of PI.
  var w = atan2(tap.uv.y, tap.uv.x) - P.cfbKeyHue;
  w = w - 2.0 * PI * round(w / (2.0 * PI));
  let soft = P.cfbKeySoft * 0.01 * PI;
  let ang = 1.0 - smoothstep(P.cfbKeyAccept - soft, P.cfbKeyAccept + soft, abs(w));
  return ang * smoothstep(KEY_CLIP, 2.0 * KEY_CLIP, length(tap.uv));
}

// Bent-enhancer resonance: the bend bridges a frequency-selective network
// across the box's feedback path, so the loop gain stays flat where the wire
// was (sync and levels ride through untouched) and rises in the band the
// network favors. Once crossfade x gain x (1 + boost) passes unity inside the
// band, the loop stops echoing the picture and self-oscillates, ringing
// standing bars and mesh over live video out of whatever content excites it.
// Windowed-cosine bandpass, normalized to unity at center so the boost knob
// reads directly as added in-band loop gain.
//
// The network is a network — one set of component values, not a different one
// per sample. Its 33 taps and its normalizer are functions of the two loop
// controls alone, so building them inside the tap loop cost 33 cos and 33 exp
// at every one of the raster's 477750 samples to arrive at the same 34 numbers
// each time. Staged per workgroup instead, the same way crt_face hoisted its
// disk taps: one thread designs the filter, everyone else reads it as plain
// coefficients — 66 transcendentals per workgroup rather than per sample.
//
// The summation order is untouched, so this is not an approximation: pixdiff
// reads max 0 against a floor of 0 over 200 frames of a live sub-unity loop,
// which is the strictest available check on this pass because a one-bit error
// would compound every lap. Worth 3.22 -> 3.06 ms/frame best-of (two dev
// servers off their own worktrees, four alternating rounds, on a look with
// this resonance and a 96-line chroma AGC lag both up). Read best-of and not
// the median: another agent's WebGPU session was on the box, and it disturbed
// whichever arm it landed on — rounds 1-2 the new one, rounds 3-4 the old —
// and the new arm won all four regardless, which is the control that makes
// the direction safe even though the magnitude is a quiet-box number.
const RES_M = 16;
const RES_TAPS = 2 * RES_M + 1;
var<workgroup> resK: array<f32, RES_TAPS>;
var<workgroup> resNorm: f32;

fn loopResonance(pos: f32) -> f32 {
  let c0 = i32(round(pos));
  var acc = 0.0;
  for (var i = 0; i < RES_TAPS; i = i + 1) {
    acc = acc + resK[i] * prev[clampIdx(c0 + i - RES_M)];
  }
  return acc / resNorm;
}

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_id) lid: vec3u,
) {
  // Ahead of the bounds return below, because the barrier has to be reached by
  // every invocation in the workgroup and 910 samples do not divide by 64.
  let resonating = P.cfbFilterFc > 0.0 && P.cfbFilterBoost != 0.0;
  if (resonating && lid.x == 0u) {
    let sigma = mix(1.2, 8.0, clamp(P.cfbFilterQ, 0.0, 1.0));
    var g = 0.0;
    for (var i = 0; i < RES_TAPS; i = i + 1) {
      let k = i - RES_M;
      let cs = cos(2.0 * PI * P.cfbFilterFc * f32(k));
      let h = exp(-f32(k * k) / (2.0 * sigma * sigma)) * cs;
      resK[i] = h;
      g = g + h * cs;
    }
    resNorm = max(g, 0.05);
  }
  workgroupBarrier();

  let s = gid.x;
  let row = gid.y;
  if (s >= SPL || row >= NLINES) {
    return;
  }
  let n = row * SPL + s;
  // The frame store's read clock against the clock it was written at. A store
  // re-triggers its readout on the output's own line sync, so the error does
  // not accumulate down the raster — it accumulates along each line and starts
  // again at the next one, which is why this scales the sample within the line
  // and leaves the line count to the offset below.
  //
  // What makes it worth a knob is that the subcarrier is in the samples being
  // re-clocked. Read a line's samples at a rate a thousandth off and the
  // carrier comes back a thousandth off the lattice the decoder demodulates
  // against, so the phase error grows with distance from the line start: about
  // 80 degrees by the end of a line at one part in a thousand. The picture is
  // stretched and repainted at once, further round the wheel the further out it
  // sits — and the next lap re-clocks what this one wrote, so the fan of hue
  // opens further every generation. A lens cannot do this; only a clock can.
  // Run past the end of the line the read walks into the store's next line,
  // which is what a store read too slowly actually hands back.
  let pos0 = f32(row * SPL) + f32(s) * (1.0 + P.cfbClock)
    - P.cfbDelay - P.cfbLines * f32(SPL);
  var pos = pos0;
  if (P.cfbServo != 0.0) {
    // The loop's delay trimmer replaced by a varactor hanging off the video
    // bus: the fed-back waveform tunes the very delay it is riding through.
    // Sensed through a short aperture (a control line has nothing like video
    // bandwidth), referenced to mid-video so dark and bright pull opposite
    // ways — and since a sample of delay is 90 degrees of subcarrier, the
    // picture is repainting its own hue and its own geometry at once, again
    // every generation. Sync tips are the deepest thing on the wire, so they
    // yank hardest, and once a line's pull walks its sync into the next
    // line's territory the receiver's problems compound on their own. Nothing
    // here repeats: the displacement field is the picture, and the picture is
    // the displacement field one lap later.
    var lvl = 0.0;
    let c0 = i32(round(pos0));
    for (var k = -8; k <= 7; k = k + 1) {
      lvl = lvl + prev[clampIdx(c0 + k * 2)];
    }
    pos = pos0 - P.cfbServo * (lvl / 16.0 - 40.0) / 100.0;
  }
  let i0 = i32(floor(pos));
  var fb = catmull(prev[clampIdx(i0 - 1)], prev[clampIdx(i0)], prev[clampIdx(i0 + 1)], prev[clampIdx(i0 + 2)], fract(pos));
  if (P.cfbReturn > 0.5) {
    // A Y/C separator on the return and a recombiner after it, so one wire
    // comes from the loop and the other from the live picture. Four
    // consecutive samples at 4x fsc span exactly one subcarrier cycle, so
    // their sum nulls chroma however the span happens to land — the same
    // aperture the keyer below slices with, doing the job a trap does in a
    // set. What is left when that mean comes off is the chroma.
    //
    // The recombiner is what makes this a patch rather than a mute. One wire
    // alone cannot go into a crossfader: a chroma line rides about blanking,
    // so a fader opening onto it takes the picture to black and the arm is a
    // dead frame rather than a look — measured, and it is why the other wire
    // is taken from the program here instead.
    //
    // So: chroma carries the loop's colour over the live brightness, and
    // colour accumulates and spins through the delay's rotation while the
    // picture underneath stays sharp and current. Luma is the reverse — the
    // loop's brightness and its sync tip go round under the live colour, so
    // trails stack up in grey and still drag at where the receiver thinks each
    // line starts.
    //
    // The program's half is read from the snapshot rather than from `comp`,
    // because a boxcar reads neighbours and `comp` is a buffer this same
    // dispatch is part way through overwriting. The keyer's external input
    // takes it from there for the same reason; the pipeline refreshes it
    // whenever either of them is patched in.
    var ry = 0.0;
    var py = 0.0;
    let c0 = i32(round(pos)) - 2;
    let p0 = i32(n) - 2;
    for (var k = 0; k < 4; k = k + 1) {
      ry = ry + prev[clampIdx(c0 + k)];
      py = py + prog[clampIdx(p0 + k)];
    }
    ry = ry * 0.25;
    py = py * 0.25;
    fb = select(ry + (prog[n] - py), py + (fb - ry), P.cfbReturn < 1.5);
  }
  if (resonating) {
    fb = fb + P.cfbFilterBoost * loopResonance(pos);
  }
  if (P.cfbRing != 0.0) {
    // The loop bus into a doubly-balanced bridge: both inputs referenced to
    // mid-video, so both carriers are suppressed and the product straddles
    // zero. (Single-quadrant — raw fb * live — has the DC of both inputs in
    // it, and a loop integrates that bias into a white-out within a few laps.)
    // Because one input is the loop's own past, every product it makes is
    // re-multiplied next frame.
    //
    // What is on the other input decides whether any of that reaches the
    // screen as colour, and the two connectors are genuinely different boxes.
    //
    // On the program, both sides carry their subcarrier on the *same crystal*,
    // so chroma against chroma lands at DC and at 7.16 MHz: the chroma filter
    // discards the sum, and the difference is brightness. What that patch
    // makes is luma structure and minted sync — measured, and written up in
    // docs/CURATION.md, where six candidates built on the opposite assumption
    // all rendered the same grey-blue wash.
    //
    // On the oscillator the bridge is an encoder's chroma modulator, which is
    // the one arrangement that puts the products back inside the chroma band.
    // Against a carrier at the subcarrier, the return's baseband — its
    // brightness — is translated up onto 3.58 MHz where the decoder reads it
    // as colour, and the return's own chroma is translated down to DC where it
    // is read as brightness. So one lap swaps what the picture carries: light
    // becomes hue and hue becomes light, and the next lap swaps what that
    // made. Detuning the oscillator off the house crystal ramps the phase it
    // writes with, so the manufactured hue turns along the line and down the
    // frame instead of landing on one colour — and since the two crystals are
    // in two boxes, nothing pulls them back together.
    var other = comp[n] - 40.0;
    if (P.cfbRingSrc > 0.5) {
      let ph = P.cfbCarrierPhase + P.cfbCarrierPerSample * f32(n);
      other = VIDEO_RANGE * carrierRot(n, P.frame, ph).x;
    }
    fb = fb + P.cfbRing * (fb - 40.0) * other * 0.01;
  }
  var m = P.cfbMix;
  if (P.cfbKey != 0.0) {
    var gate = keyGate(keyTap(pos, n, P.cfbKeyExt > 0.5));
    if (P.cfbKey < 0.0) {
      gate = 1.0 - gate;
    }
    m = m * mix(1.0, gate, abs(P.cfbKey));
  }
  comp[n] = rails(mix(comp[n], P.cfbGain * fb, m));
}
