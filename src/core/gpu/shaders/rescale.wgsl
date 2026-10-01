// The presented frame scaled to a take's size, for a window resized mid-take.
// An encoder is configured once with a frame size, so the recorder keeps the
// size the take started at and this fits the new picture into it.

@group(0) @binding(0) var rescaleSrc: texture_2d<f32>;
@group(0) @binding(1) var rescaleSamp: sampler;

struct RescaleOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn rescaleVs(@builtin(vertex_index) vi: u32) -> RescaleOut {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: RescaleOut;
  o.pos = vec4f(pos[vi], 0.0, 1.0);
  o.uv = pos[vi] * vec2f(0.5, -0.5) + vec2f(0.5);
  return o;
}

@fragment
fn rescaleFs(v: RescaleOut) -> @location(0) vec4f {
  return textureSampleLevel(rescaleSrc, rescaleSamp, v.uv, 0.0);
}
