// Sync separator, measurement half: one thread per line hunts the falling
// sync edge near the expected line start and samples the gated sync depth
// (tip vs back porch) and the mid-line level (broad-pulse detection for
// vertical lock). The flywheel PLL in sync.wgsl consumes these per-line
// measurements; only that tiny recurrence stays serial.
//
// Two vec4 per line:
// measure[2*row]     = (edge sample or -1000 if not found, porch - tip depth,
//                       mean active-picture level (beam load), 1 if mid-line
//                       sits at sync level)
// measure[2*row + 1] = (deepest excursion inside active video, 0, 0, 0) —
//                       what the peak detector in sync.wgsl charges to,
//                       post-IF-gain
//
// The slicer sits halfway down to the peak the separator has been charging to,
// the way a capacitor-coupled separator's does, rather than at a fixed level.
// Nominal sync is the floor of that peak, so on any line whose picture stays
// above blanking the slice is the -20 IRE it always was. A line arriving
// negated has its old peak whites as the deepest thing on it, and the slice
// follows them down into the picture, where the set then finds its "sync".
// Its gate is the narrow window round the expected line start while the
// flywheel is locked, and the whole line once it has lost the pulses.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> comp: array<f32>;
@group(0) @binding(2) var<storage, read> timing: array<f32>;
@group(0) @binding(3) var<storage, read_write> measure: array<vec4f>;

const SLICE = -20.0; // IRE slicing level on nominal sync
const GATE_NARROW = 55; // samples past the expected start the locked gate looks

// The separator taps video after the IF stage, inside the AGC loop — so the
// receiver's gain reaches sync stability, not just brightness. A dim
// double-terminated feed relocks as the gain ramps; hum-mod gain pumping
// genuinely breathes the horizontal lock. Last frame's gain, which is the lag
// a real AGC's time constant gives; identity while the agc control is 0.
fn ifGain() -> f32 {
  return mix(1.0, timing[AGC_GAIN], P.agc);
}

fn levelAt(n: i32) -> f32 {
  // small boxcar lowpass, the sync separator's RC filter
  var acc = 0.0;
  for (var k = -2; k <= 2; k = k + 1) {
    acc = acc + comp[clampIdx(n + k)];
  }
  return acc / 5.0 * ifGain();
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let row = gid.x;
  if (row >= NLINES) {
    return;
  }
  let base = i32(row * SPL);

  // The peak detector's reference: the tip level the separator has been
  // measuring (or the deepest excursions it can find, once it has lost lock).
  // Fresh state reads as nominal sync.
  var tipRef = timing[TIP_LEVEL];
  if (tipRef == 0.0) {
    tipRef = IRE_SYNC;
  }
  let slice = min(0.5 * tipRef, SLICE);
  let gateEnd = select(GATE_NARROW, i32(SPL) - 40, timing[GATE_WIDE] >= GATE_OPEN_FRAMES);

  // hunt for the falling edge through the slice, from just ahead of the
  // expected line start to wherever the gate closes
  var edge = -1000.0;
  var prev = levelAt(base - 30);
  for (var s = -29; s < gateEnd; s = s + 1) {
    let cur = levelAt(base + s);
    if (prev >= slice && cur < slice) {
      edge = f32(s);
      break;
    }
    prev = cur;
  }

  // gated depth: sample mid-tip and back porch relative to the found edge
  var depth = 0.0;
  if (edge > -999.0) {
    let tip = levelAt(base + i32(edge) + 20);
    let porch = levelAt(base + i32(edge) + i32(SYNC_LEN) + 8);
    depth = porch - tip;
  }

  // The deepest excursion inside active video. A peak detector charges to the
  // most negative thing on the line, which on a nominal line is the tip; only
  // picture that reaches below blanking can pull it further. Coarse stride:
  // the separator's RC filter is already five samples wide.
  var activeMin = 1000.0;
  for (var k = 0; k < i32(ACTIVE_W); k = k + 4) {
    activeMin = min(activeMin, levelAt(base + i32(ACTIVE_START) + k));
  }

  // Beam load: mean active-picture level on this line, i.e. how much current
  // this line asks the tube to draw. The deflection sag in sync.wgsl integrates
  // it — bright content physically bends the scan. Post-AGC, because the gun
  // is driven by the gain-corrected video: a pumping AGC pumps the sag too.
  var load = 0.0;
  let step = i32(ACTIVE_W / 24u);
  for (var k = 0; k < 24; k = k + 1) {
    load = load + comp[clampIdx(base + i32(ACTIVE_START) + k * step)];
  }
  load = load * ifGain();

  let broad = select(0.0, 1.0, levelAt(base + 200) < SLICE);
  measure[row * 2u] = vec4f(edge, depth, load / 24.0, broad);
  measure[row * 2u + 1u] = vec4f(activeMin, 0.0, 0.0, 0.0);
}
