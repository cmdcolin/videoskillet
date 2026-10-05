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
// It replaces the composite where it draws, chroma included. A character
// generator that adds to the video would leave the picture's colour burning
// through the letters; this one keys, so a letter carries no colour of its own.
//
// Letters come from the font ROM the chyron already reads. The transport
// symbols are not in that font, so they are drawn here on the same dot grid.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> comp: array<f32>;
@group(0) @binding(2) var<storage, read> font: array<u32>;

// One dot of the font is this many samples wide and lines tall. The sample is
// 0.85 of a line wide on a 4:3 raster, so 4 by 3 keeps the dot close to square.
const DOT_X = 4.0;
const DOT_Y = 3.0;
// Where the display's top-left dot sits, as a fraction of the active picture.
const ORIGIN_X = 0.07;
const ORIGIN_Y = 0.09;
// A deck's display is not full white, and the outline is black rather than the
// blanking level so it stays visible over a dark picture.
const LETTER_IRE = 90.0;
const EDGE_IRE = IRE_BLACK;

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
  let x = f32(s - ACTIVE_START) - ORIGIN_X * f32(ACTIVE_W);
  let y = f32(row - ACTIVE_TOP) - ORIGIN_Y * f32(ACTIVE_H);
  let dx = i32(floor(x / DOT_X));
  let dy = i32(floor(y / DOT_Y));

  var level = EDGE_IRE;
  var keyed = false;
  if (ink(dx, dy)) {
    level = LETTER_IRE;
    keyed = true;
  } else {
    for (var j = -1; j <= 1 && !keyed; j = j + 1) {
      for (var i = -1; i <= 1 && !keyed; i = i + 1) {
        keyed = ink(dx + i, dy + j);
      }
    }
  }
  if (!keyed) {
    return;
  }
  let n = row * SPL + s;
  comp[n] = mix(comp[n], level, P.osdMix);
}
