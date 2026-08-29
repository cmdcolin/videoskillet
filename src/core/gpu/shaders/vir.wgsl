// The set correcting itself off the VIR line — a corrective box whose failure
// mode is the effect.
//
// Line 19 carries a chroma reference stamped at burst phase on a 70 IRE
// pedestal (`encode_composite.wgsl`). A VIR-equipped receiver compared what it
// decoded off that line against what it knew was stamped there, and trimmed its
// own hue and saturation until the two agreed. That is a closed loop around the
// demodulator, so everything it does is a consequence of what the reference
// arrived looking like — and this app spends most of its time damaging signals.
//
// The measurement is the *residual*, not the error. The burst loop has already
// had its say by the time this runs, so what the corrector sees is whatever
// burst could not account for. That is exactly what the line was installed for:
// burst sits at blanking level and picture chroma does not, so a path that is
// nonlinear in luma rotates the two differently, and no amount of burst lock
// can see it. Point `diffPhaseDeg` at a VIR set and this is the loop that
// notices.
//
// One invocation. It produces two numbers and they are a servo's state.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> comp: array<f32>;
@group(0) @binding(2) var<storage, read> lineInfo: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> timing: array<f32>;

const VIR_LINE = 19u;
// Inside the reference's own 380 samples, clear of the transition at either
// end — a real gate sits off the edges for the same reason.
const VIR_FIRST = 40u;
const VIR_LAST = 360u;
const VIR_AMP = 20.0; // what the line is stamped with, IRE

@compute @workgroup_size(1)
fn main() {
  if (P.vir == 0.0) {
    return;
  }
  let hoff = i32(round(timing[VIR_LINE]));

  // Demodulated against the same carrier `line_analyze` gates burst with, and
  // accumulated the same way, because the whole measurement is a difference
  // between the two and a difference is only meaningful between like things.
  //
  // The 70 IRE pedestal leaks into this: it is DC against a carrier over forty
  // whole cycles, so what survives is a fraction of a cycle's worth at the ends
  // of the window and it lands two orders under the reference itself.
  var su = 0.0;
  var sv = 0.0;
  var cnt = 0.0;
  for (var x = VIR_FIRST; x < VIR_LAST; x = x + 1u) {
    let n = clampIdx(i32(VIR_LINE * SPL + ACTIVE_START + x) + hoff);
    let sc = carrier(n, P.frame);
    let v = comp[n];
    su = su + v * sc.x;
    sv = sv + v * sc.y;
    cnt = cnt + 1.0;
  }
  let uv = 2.0 * vec2f(su, sv) / cnt;

  // What the burst loop already took out of this line, on this line's own
  // burst. Both angles are measured about the expected 180 degrees the way
  // decode measures its own, so subtracting them is honest.
  let li = lineInfo[VIR_LINE];
  let locked = li.w > P.killThresh;
  let phBurst = select(0.0, atan2(-li.y, -li.x), locked);
  var resid = atan2(-uv.y, -uv.x) - phBurst * P.burstLock;
  resid = resid - 2.0 * PI * round(resid / (2.0 * PI));

  // Saturation, against the gain the chroma ACC has already applied. A
  // reference that comes back weak makes the set turn colour *up* — which is
  // why a dub, whose chroma the colour-under path has been eating a generation
  // at a time, arrives on a VIR set looking garish rather than washed out.
  let acc = select(0.0, clamp(BURST_AMP / max(li.w, 0.5), 0.0, 4.0), locked);
  let seen = length(uv) * mix(1.0, acc, P.burstLock);
  let gainErr = clamp(VIR_AMP / max(seen, 1.0), 0.25, 4.0);

  // A first-order integrator, and the lag is the point rather than a cost. A
  // real corrector answered over many fields, so a reference that has been
  // damaged does not make the picture flicker — it drags the whole frame
  // somewhere wrong and leaves it there, and only comes back as slowly.
  //
  // Except on the very first frame, where the loop snaps instead. A zeroed
  // gain is not a value the servo can ever converge to — `gainErr` is clamped
  // to 0.25 at the bottom — so zero is what an untouched buffer looks like, and
  // `resetSignal` clears every buffer precisely so that nobody has to keep a
  // list of which ones carry state. Lagging up from zero would open the
  // corrector on a picture with no colour in it for `virLag` frames.
  let cold = timing[VIR_GAIN] == 0.0;
  let k = select(1.0 / max(P.virLag, 1.0), 1.0, cold);
  timing[VIR_HUE] = mix(timing[VIR_HUE], resid, k);
  timing[VIR_GAIN] = mix(timing[VIR_GAIN], gainErr, k);
}
