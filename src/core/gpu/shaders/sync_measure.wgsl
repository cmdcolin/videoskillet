// Sync separator, measurement half: one thread per line hunts the falling
// sync edge near the expected line start and samples the gated sync depth
// (tip vs back porch) and the mid-line level (broad-pulse detection for
// vertical lock). The flywheel PLL in sync.wgsl consumes these per-line
// measurements; only that tiny recurrence stays serial.
//
// Two vec4 per line:
// measure[2*row]     = (edge sample or -1000 if not found, porch - tip depth
//                       at the AGC's key,
//                       mean active-picture level (beam load), 1 if mid-line
//                       sits at sync level)
// measure[2*row + 1] = (deepest excursion inside active video, separated
//                       sync's first harmonic re and im, separated sync's
//                       total width in samples) — the first is
//                       what the peak detector in sync.wgsl charges to,
//                       post-IF-gain, and the harmonic is what the flywheel's
//                       phase comparator integrates
//
// The slicer sits halfway down to the peak the separator has been charging to,
// the way a capacitor-coupled separator's does, rather than at a fixed level.
// With the fixed slicer, nominal sync is the floor of that peak, so on any line
// whose picture stays above blanking the slice is the -20 IRE it always was. A
// line arriving negated has its old peak whites as the deepest thing on it, and
// the slice follows them down into the picture, where the set then finds its
// "sync". The peak slicer (syncSlicer 1) has no floor and charges to the whole
// line, sync interval included, so it follows a tip a scrambler has lifted
// toward blanking and locks to it. Its reference never rises above blanking,
// so a tip the carrier scrambler has lifted above picture black is out of its
// reach. Its gate is the narrow window round the expected line start while the
// flywheel is locked, and the whole line once it has lost the pulses.
//
// The AC-coupled separator (syncSlicer 2) clips a fixed 10 IRE above the level
// its coupling capacitor has charged to, with no ceiling on that level, so it
// slices at -30 IRE on a clean line. Its edge hunt only counts pulses for the
// gate and the DC restorer. What moves the oscillator is the flywheel's phase
// comparator, which multiplies the whole separated line by a reference at the
// oscillator's phase, so a pulse anywhere on the line pulls according to how
// far it sits from the oscillator. The comparator's reference is a sinusoid at
// line rate, so all it needs from a line is the first harmonic of the
// separated waveform and its width. On a carrier-scrambled line the deepest
// thing is dark picture, so the separator passes the picture's dark areas and
// the oscillator is dragged toward them. 20 IRE above the charged level passed
// every shadow on the carnival clip and tore the picture past recognition.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> comp: array<f32>;
@group(0) @binding(2) var<storage, read> timing: array<f32>;
@group(0) @binding(3) var<storage, read_write> measure: array<vec4f>;

const SLICE = -20.0; // IRE slicing level on nominal sync
const AC_SLICE_ABOVE_PEAK = 10.0;
// half the clipped transistor's turn-on, in IRE, so noise on a dark area
// dithers the separated output instead of flipping it
const AC_SLICE_SOFT = 3.0;

// The separator taps video after the IF stage, inside the AGC loop — so the
// receiver's gain reaches sync stability, not just brightness. A dim
// double-terminated feed relocks as the gain ramps; hum-mod gain pumping
// genuinely breathes the horizontal lock. Last frame's gain, which is the lag
// a real AGC's time constant gives; identity while the agc control is 0.
fn separatorGain() -> f32 {
  return ifGain(timing[AGC_GAIN], P.agc);
}

fn levelAt(n: i32) -> f32 {
  // small boxcar lowpass, the sync separator's RC filter
  var acc = 0.0;
  for (var k = -2; k <= 2; k = k + 1) {
    acc = acc + comp[clampIdx(n + k)];
  }
  return acc / 5.0 * separatorGain();
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
  let peak = P.syncSlicer > 0.5;
  let acCoupled = P.syncSlicer > 1.5;
  let slice = select(select(min(0.5 * tipRef, SLICE), 0.5 * tipRef, peak), tipRef + AC_SLICE_ABOVE_PEAK, acCoupled);
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

  // gated depth: sample mid-tip and back porch relative to the found edge. The
  // AC-coupled set keys its AGC off its own flyback, which is wherever the
  // oscillator drew this line last frame, so on a line it has not locked it
  // samples picture as though it were tip and porch.
  let keyAt = select(edge, round(timing[row]), acCoupled);
  var depth = 0.0;
  if (keyAt > -999.0) {
    let tip = levelAt(base + i32(keyAt) + 20);
    let porch = levelAt(base + i32(keyAt) + i32(SYNC_LEN) + 8);
    depth = porch - tip;
  }

  // The deepest excursion the peak detector charges to: inside active video for
  // the fixed slicer, whose floor stands in for the tip, and the whole line for
  // the peak slicer, which has to see the tip itself. Coarse stride: the
  // separator's RC filter is already five samples wide.
  let lineFrom = select(i32(ACTIVE_START), 0, peak);
  let span = select(i32(ACTIVE_W), i32(SPL), peak);
  var activeMin = 1000.0;
  var harmonic = vec2f(0.0);
  var separatedWidth = 0.0;
  for (var k = 0; k < span; k = k + 4) {
    let level = levelAt(base + lineFrom + k);
    activeMin = min(activeMin, level);
    if (acCoupled) {
      let separated = clamp(0.5 + (slice - level) / (2.0 * AC_SLICE_SOFT), 0.0, 1.0);
      let theta = 2.0 * PI * f32(lineFrom + k) / f32(SPL);
      harmonic = harmonic + 4.0 * separated * vec2f(cos(theta), sin(theta));
      separatedWidth = separatedWidth + 4.0 * separated;
    }
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
  load = load * separatorGain();

  // The vertical integrator: an RC on the separated sync charges for as long as
  // the line sits below the slice, so it fires on a line that spends a good
  // part of its length there. A broad pulse holds sync for 85% of the line and
  // an equalizing pulse or a line sync for 7%; a seventh separates them, and
  // keeps a broad pulse that a sine-wave scrambler has lifted near the line
  // start but left at full depth mid-line.
  // Only the field-sync lines are scored, so only they are integrated.
  var below = 0.0;
  if (row >= VSYNC_FIRST && row <= VSYNC_LAST) {
    for (var k = 0; k < 64; k = k + 1) {
      below = below + select(0.0, 1.0, levelAt(base + k * i32(SPL / 64u)) < SLICE);
    }
  }
  // 64 taps put a line sync or an equalizing pulse at 5 and a full-depth sine
  // broad pulse at 13, so 9 leaves four taps of margin either side.
  let broad = select(0.0, 1.0, below > 8.0);
  measure[row * 2u] = vec4f(edge, depth, load / 24.0, broad);
  measure[row * 2u + 1u] = vec4f(activeMin, harmonic, separatedWidth);
}
