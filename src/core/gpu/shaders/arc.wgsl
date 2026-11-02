// The radiated half of a flyback arc. The discharge is a spark a few inches
// from the set's own video stages, so it lands on the signal inside the
// receiver, after the tuner and the tape: a burst of hash that starts where on
// the line the arc struck and dies away over the next few lines. sync.wgsl
// decides when the arcs strike and how hard; this pass only lays the burst
// onto the composite, ahead of the burst measurement and the decoder, so the
// colour on those lines is thrown as well.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> comp: array<f32>;
@group(0) @binding(2) var<storage, read> timing: array<f32>;

// Peak level of the burst per unit of collapse, IRE. An arc saturates the
// stage it couples into, so it is mostly bright.
const ARC_IRE = 200.0;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  let row = gid.y;
  if (s < SPL && row < NLINES) {
    let amp = timing[ARC_BURST + row];
    let t = f32(s) - timing[ARC_ONSET + row];
    if (amp > 0.002 && t >= 0.0) {
      let n = row * SPL + s;
      let h = pcg(n ^ (P.frame * 0x9E3779B9u));
      // Fades along the line at the rate sync.wgsl fades it from line to line.
      let env = amp * pow(0.93, f32(s) / f32(SPL));
      let spike = select(0.0, 1.0, rand01(h ^ 0x51u) < 0.12);
      let hash = 0.35 + 0.9 * (rand01(h) - 0.4) + 0.8 * spike;
      comp[n] = comp[n] + ARC_IRE * env * hash;
    }
  }
}
