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

// A transport symbol's dot, in the cell's own 8 by 12 grid. The arrow is a
// triangle ten dots tall and seven wide, so its edge steps one dot every
// column and it reads as a point, not a wedge.
fn symbolDot(kind: u32, ux: u32, uy: u32) -> bool {
  if (kind == SYM_BARS) {
    return uy >= 1u && uy <= 10u && (ux == 1u || ux == 2u || ux == 5u || ux == 6u);
  }
  let col = select(ux, GLYPH_W - 1u - ux, kind == SYM_REW);
  let reach = 5.0 - f32(col) * (4.0 / 6.0);
  return col <= 6u && abs(f32(uy) + 0.5 - 6.0) <= reach;
}

// The rotation this line's burst arrived at against the house carrier, as
// (cos, sin). Whatever sits upstream of the deck's output moves the burst:
// time-base error shifts the line by fractions of a subcarrier cycle and
// colour-under rotates it. The set takes hue from the burst, so chroma written
// at the house phase decodes as a different colour on every line.
//
// A burst sample is -A * carrierRot(...).x, and the four lattice phases make
// the carrier's two axes orthogonal, so correlating the 36 samples against each
// axis recovers the cosine and sine of the rotation, up to the burst's amplitude.
//
// The workgroup's lanes each load one sample and one lane sums them. A single
// lane walking all 36 loads measured 0.3 ms of a 0.37 ms pass.
var<workgroup> burstTerms: array<vec2f, BURST_LEN>;

// The house carrier turned by a burst rotation: what `carrierRot` computes from
// an angle, without the cosine and sine per sample.
fn rotated(sc: vec2f, cs: vec2f) -> vec2f {
  return vec2f(sc.x * cs.x + sc.y * cs.y, sc.y * cs.x - sc.x * cs.y);
}

fn fontDot(label: u32, dx: i32, dy: i32) -> bool {
  if (dx < 0) {
    return false;
  }
  let col = u32(dx) / GLYPH_W;
  if (col >= TEXT_LEN[label]) {
    return false;
  }
  let glyph = TEXT[label * 5u + col] - 0x20u;
  return ((font[glyph * GLYPH_H + u32(dy)] >> (u32(dx) % GLYPH_W)) & 1u) != 0u;
}

// A letter's dot is also lit by the dot to its left, so every stroke is two dots
// wide. The symbols are already solid.
fn ink(dx: i32, dy: i32) -> bool {
  if (dx < 0 || dy < 0 || dy >= i32(GLYPH_H)) {
    return false;
  }
  let col = u32(dx) / GLYPH_W;
  let ux = u32(dx) % GLYPH_W;
  let label = u32(P.osdLabel + 0.5);
  let len = TEXT_LEN[label];
  if (col <= len) {
    return fontDot(label, dx, dy) || fontDot(label, dx - 1, dy);
  }
  if (col - len - 1u >= SYMBOL_CELLS[label]) {
    return false;
  }
  return symbolDot(SYMBOL[label], ux, u32(dy));
}

// The box the word and its outline can be lit in, in dots and with one dot
// spare on each side for the outline: the longest word, PAUSE, plus its gap and
// symbol. A longer word needs this raised or its tail is clipped.
const BOX_COLS = 7u;

// One burst measurement per line, shared by the workgroup that draws it.
var<workgroup> lineBurst: vec2f;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(workgroup_id) wid: vec3u,
  @builtin(local_invocation_index) lid: u32,
) {
  // A workgroup covers part of one row, so `wid.y` and `gid.y` agree, but only
  // `wid.y` lets Chrome's uniformity analysis prove this return uniform, which
  // the barriers below need. Naga skips that check, so Firefox accepts either.
  let row = wid.y;
  if (row < ACTIVE_TOP || row >= ACTIVE_TOP + ACTIVE_H) {
    return;
  }
  let y = f32(row - ACTIVE_TOP) - P.osdY * f32(ACTIVE_H);
  let dy = i32(floor(y / (DOT_Y * P.osdScale)));
  let inBand = dy >= -1 && dy <= i32(GLYPH_H);
  let muted = P.osdBlue > 0.5;
  // The row and the uniform buffer alone decide this, so every lane of every
  // workgroup takes the same path through the barriers. Letters need the burst
  // only on the rows they are drawn on.
  if (muted || (inBand && P.osdColour > 0.5)) {
    if (lid < BURST_LEN) {
      let nb = row * SPL + BURST_START + lid;
      burstTerms[lid] = comp[nb] * carrier(nb, P.frame);
    }
    workgroupBarrier();
    if (lid == 0u) {
      var sum = vec2f(0.0);
      for (var k = 0u; k < BURST_LEN; k = k + 1u) {
        sum = sum + burstTerms[k];
      }
      let len = length(sum);
      lineBurst = select(vec2f(1.0, 0.0), -sum / len, len > 1e-3);
    }
    workgroupBarrier();
  }

  let s = gid.x;
  if (s < ACTIVE_START || s >= ACTIVE_START + ACTIVE_W) {
    return;
  }
  let x = f32(s - ACTIVE_START) - P.osdX * f32(ACTIVE_W);
  let dx = i32(floor(x / (DOT_X * P.osdScale)));
  let inBox = inBand && dx >= -1 && dx <= i32(BOX_COLS * GLYPH_W);

  let n = row * SPL + s;
  let lit = inBox && ink(dx, dy);
  var sc = carrier(n, P.frame);
  if (muted || (lit && P.osdColour > 0.5)) {
    sc = rotated(sc, lineBurst);
  }
  if (muted) {
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
  if (!inBox || P.osdEdge < 0.5) {
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
