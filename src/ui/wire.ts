// A wire on either drawing of the chain, built from where it goes rather than
// written out as a path.
//
// Both maps used to spell their own `d` strings — 22 of them across four files,
// including two separate hand-written `returnPath`s, one per drawing — and the
// arrowheads were built somewhere else again, off a point and a direction the
// caller worked out for itself. Nothing checked that a head pointed the way its
// wire actually left, because the head and the wire never met.
//
// So a wire is a list of the corners it turns, and the head comes off the last
// leg of the same list. A run that changes shape takes its head with it.
//
// Adapted from the routing in ~/src/bender (src/ui/svg.ts), which is where the
// idea of handing the drawing a polyline instead of a string comes from. The
// corner construction is the one both maps already used — a quadratic with the
// corner itself as the control point — so this is the same curve under a name,
// and porting a call site moves nothing.

export type Point = readonly [number, number]

const round = (n: number) => Math.round(n * 1000) / 1000

const at = (p: Point) => `${round(p[0])} ${round(p[1])}`

const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

// `by` units from `from` along the line to `to`. Clamped by the caller, not
// here: a zero-length leg has no direction to travel, and the corner it belongs
// to is the one place that knows what to do about it.
const toward = (from: Point, to: Point, by: number): Point => {
  const d = dist(from, to)
  if (d === 0) return from
  return [
    from[0] + ((to[0] - from[0]) * by) / d,
    from[1] + ((to[1] - from[1]) * by) / d,
  ]
}

/**
 * A run through the given corners, each rounded off by `radius`.
 *
 * The radius is capped at half of the shorter leg either side of a corner, so a
 * short leg between two turns rounds to what fits instead of overshooting into
 * the next one. Two points are a straight line and no corner at all.
 */
export function route(pts: readonly Point[], radius: number): string {
  if (pts.length === 0) return ''
  const d = [`M${at(pts[0])}`]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const corner = pts[i]
    const next = pts[i + 1]
    const r = Math.min(radius, dist(prev, corner) / 2, dist(corner, next) / 2)
    d.push(`L${at(toward(corner, prev, r))}`)
    d.push(`Q${at(corner)} ${at(toward(corner, next, r))}`)
  }
  d.push(`L${at(pts[pts.length - 1])}`)
  return d.join('')
}

/**
 * The head on the end of a run: a triangle whose tip is the last point and
 * whose base sits `len` back along the last leg, `half` to either side of it.
 *
 * Off the same list the wire is routed from, so the head cannot point somewhere
 * the wire does not go. The two numbers are the drawing's, not this file's —
 * the miniature and the card set their type at different sizes and their heads
 * with it.
 */
export function arrowhead(
  pts: readonly Point[],
  len: number,
  half: number,
): string {
  if (pts.length < 2) return ''
  const tip = pts[pts.length - 1]
  const back = toward(tip, pts[pts.length - 2], len)
  // The perpendicular to the last leg, at unit length times `half`.
  const [dx, dy] = [tip[0] - back[0], tip[1] - back[1]]
  const n = Math.hypot(dx, dy)
  if (n === 0) return ''
  const [px, py] = [(-dy / n) * half, (dx / n) * half]
  return `M${at([back[0] + px, back[1] + py])}L${at(tip)}L${at([back[0] - px, back[1] - py])}Z`
}
