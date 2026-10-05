// A deck's on-screen display: the PLAY, PAUSE, FF or REW it draws over its
// output when the transport moves.
//
// The deck generates this itself and mixes it into the video it hands to the
// set, so it stands after the tape. The timebase error and the tracking bars
// are already in the picture behind it and none of them reaches the word, which
// is why the word holds still while the picture under it shakes. Everything
// downstream treats it as video: the set locks to it, decodes it and bends it
// with the rest of the line.
//
// A deck with no lock on its tape mutes its output to a flat blue field, and the
// word is drawn over that. The field is encoded here the way the encoder would
// encode a blue source, so the set decodes it as colour.
//
// It replaces the composite where it draws, chroma included. A character
// generator that adds to the video would leave the picture's colour burning
// through the letters; this one keys, so a letter carries no colour of its own.
//
// Letters come from the font ROM the chyron already reads. The transport
// symbols are not in that font, so they are drawn here on the same dot grid.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> comp: array<f32>;
@group(0) @binding(2) var<storage, read> font: array<u32>;

// One dot of the font at stock size is this many samples wide and lines tall.
// The sample is 0.85 of a line wide on a 4:3 raster, so 4 by 3 keeps the dot
// close to square.
const DOT_X = 4.0;
const DOT_Y = 3.0;
// The two letter colours: the white a deck draws, a little short of peak, and
// the bright green a television draws its own channel and volume in. The
// letters are encoded like any picture, so the green carries chroma.
const WHITE = vec3f(0.9, 0.9, 0.9);
const GREEN = vec3f(0.1, 1.0, 0.2);
// The optional outline is black rather than the blanking level so it stays
// visible over a dark picture.
const EDGE_IRE = IRE_BLACK;

// The deck's background. Its chroma swing has to leave the trough of the
// subcarrier above blanking: a fully saturated blue dips toward the sync
// separator's slice level, and with any noise on the line the set loses lock.
const BLUE = vec3f(0.1, 0.2, 0.7);

const SYM_PLAY = 0u;
const SYM_BARS = 1u;
const SYM_REW = 2u;

// Five words, five glyphs each, space padded: play, pause, slow, ff, rew.
const TEXT = array<u32, 25>(
  0x50u, 0x4cu, 0x41u, 0x59u, 0x20u,
  0x50u, 0x41u, 0x55u, 0x53u, 0x45u,
  0x53u, 0x4cu, 0x4fu, 0x57u, 0x20u,
  0x46u, 0x46u, 0x20u, 0x20u, 0x20u,
  0x52u, 0x45u, 0x57u, 0x20u, 0x20u,
);
const TEXT_LEN = array<u32, 5>(4u, 5u, 4u, 2u, 3u);
const SYMBOL = array<u32, 5>(SYM_PLAY, SYM_BARS, SYM_PLAY, SYM_PLAY, SYM_REW);
const SYMBOL_CELLS = array<u32, 5>(1u, 1u, 1u, 2u, 2u);

// A transport symbol's dot, in the cell's own 8 by 12 grid.
fn symbolDot(kind: u32, ux: u32, uy: u32) -> bool {
  var fx = (f32(ux) + 0.5) / f32(GLYPH_W);
  let fy = (f32(uy) + 0.5) / f32(GLYPH_H);
  if (kind == SYM_BARS) {
    return fy > 0.1 && fy < 0.9
      && ((fx > 0.15 && fx < 0.4) || (fx > 0.6 && fx < 0.85));
  }
  if (kind == SYM_REW) {
    fx = 1.0 - fx;
  }
  return fx > 0.1 && fx < 0.9 && abs(fy - 0.5) < 0.42 * (0.9 - fx) / 0.8;
}

// The phase this line's burst arrived at, against the house carrier. Whatever
// sits upstream of the deck's output moves the burst: time-base error shifts
// the line by fractions of a subcarrier cycle and colour-under rotates it. The
// set takes hue from the burst, so chroma written at the house phase decodes as
// a different colour on every line.
//
// A burst sample is -A * carrierRot(...).x, and the four lattice phases make
// the carrier's two axes orthogonal, so correlating the 36 samples against each
// axis recovers the cosine and sine of the rotation.
fn burstPhase(row: u32) -> f32 {
  var sx = 0.0;
  var sy = 0.0;
  for (var k = 0u; k < BURST_LEN; k = k + 1u) {
    let nb = row * SPL + BURST_START + k;
    let sc = carrier(nb, P.frame);
    sx = sx + comp[nb] * sc.x;
    sy = sy + comp[nb] * sc.y;
  }
  return atan2(-sy, -sx);
}

fn ink(dx: i32, dy: i32) -> bool {
  if (dx < 0 || dy < 0 || dy >= i32(GLYPH_H)) {
    return false;
  }
  let col = u32(dx) / GLYPH_W;
  let ux = u32(dx) % GLYPH_W;
  let uy = u32(dy);
  let label = u32(P.osdLabel + 0.5);
  let len = TEXT_LEN[label];
  if (col < len) {
    let glyph = TEXT[label * 5u + col] - 0x20u;
    return ((font[glyph * GLYPH_H + uy] >> ux) & 1u) != 0u;
  }
  if (col <= len || col - len - 1u >= SYMBOL_CELLS[label]) {
    return false;
  }
  return symbolDot(SYMBOL[label], ux, uy);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let row = gid.y;
  let s = gid.x;
  if (s >= SPL) {
    return;
  }
  if (row < ACTIVE_TOP || row >= ACTIVE_TOP + ACTIVE_H
      || s < ACTIVE_START || s >= ACTIVE_START + ACTIVE_W) {
    return;
  }
  let x = f32(s - ACTIVE_START) - P.osdX * f32(ACTIVE_W);
  let y = f32(row - ACTIVE_TOP) - P.osdY * f32(ACTIVE_H);
  let dx = i32(floor(x / (DOT_X * P.osdScale)));
  let dy = i32(floor(y / (DOT_Y * P.osdScale)));

  let n = row * SPL + s;
  let lit = ink(dx, dy);
  let coloured = P.osdBlue > 0.5 || (lit && P.osdColour > 0.5);
  var sc = carrier(n, P.frame);
  if (coloured) {
    sc = carrierRot(n, P.frame, burstPhase(row));
  }
  if (P.osdBlue > 0.5) {
    let yuv = yuvOf(BLUE);
    comp[n] = activeComposite(yuv.x, yuv.y, yuv.z, sc, 1.0, 0.0);
  }

  if (lit) {
    let rgb = select(WHITE, GREEN, P.osdColour > 0.5);
    let yuv = yuvOf(rgb);
    let letter = activeComposite(yuv.x, yuv.y, yuv.z, sc, 1.0, 0.0);
    comp[n] = mix(comp[n], letter, P.osdMix);
    return;
  }
  if (P.osdEdge < 0.5) {
    return;
  }
  var edge = false;
  for (var j = -1; j <= 1 && !edge; j = j + 1) {
    for (var i = -1; i <= 1 && !edge; i = i + 1) {
      edge = ink(dx + i, dy + j);
    }
  }
  if (edge) {
    comp[n] = mix(comp[n], EDGE_IRE, P.osdMix);
  }
}
