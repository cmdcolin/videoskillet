import { describe, expect, it } from 'vitest'

import { arrowhead, route, type Point } from './wire'

describe('route', () => {
  it('draws two points as a straight line', () => {
    expect(
      route(
        [
          [0, 0],
          [10, 0],
        ],
        4,
      ),
    ).toBe('M0 0L10 0')
  })

  // The construction both maps already used, so porting a call site moves
  // nothing on screen: the corner itself is the control point, and the curve
  // starts and ends `radius` away from it along each leg.
  it('rounds a corner with the corner as the control point', () => {
    expect(
      route(
        [
          [0, 0],
          [0, 20],
          [30, 20],
        ],
        4,
      ),
    ).toBe('M0 0L0 16Q0 20 4 20L30 20')
  })

  // A short leg between two turns is the case a hand-written path gets wrong:
  // spend the full radius at both ends and the two curves overlap, which draws
  // a wire that bulges backwards through its own corner.
  it('caps the radius at half the shorter leg', () => {
    const d = route(
      [
        [0, 0],
        [0, 6],
        [6, 6],
        [6, 0],
      ],
      10,
    )
    expect(d).toBe('M0 0L0 3Q0 6 3 6L3 6Q6 6 6 3L6 0')
  })

  it('is empty for no points at all', () => {
    expect(route([], 4)).toBe('')
  })
})

describe('arrowhead', () => {
  // Off the same list the wire is routed from — which is the whole point, and
  // what nothing checked while the head was built from a point and a direction
  // the caller worked out separately.
  const leg = (a: Point, b: Point) => arrowhead([a, b], 3, 2)

  it('points the way the last leg travels', () => {
    expect(leg([0, 0], [10, 0])).toBe('M7 2L10 0L7 -2Z')
    expect(leg([0, 0], [-10, 0])).toBe('M-7 -2L-10 0L-7 2Z')
    expect(leg([0, 0], [0, 10])).toBe('M-2 7L0 10L2 7Z')
    expect(leg([0, 0], [0, -10])).toBe('M2 -7L0 -10L-2 -7Z')
  })

  it('reads only the last leg of a longer run', () => {
    const pts: Point[] = [
      [0, 0],
      [0, 20],
      [30, 20],
    ]
    expect(arrowhead(pts, 3, 2)).toBe(
      arrowhead(
        [
          [0, 20],
          [30, 20],
        ],
        3,
        2,
      ),
    )
  })

  it('has nothing to point along with fewer than two points', () => {
    expect(arrowhead([[0, 0]], 3, 2)).toBe('')
    expect(arrowhead([], 3, 2)).toBe('')
  })

  it('draws nothing rather than NaN for a run that never moves', () => {
    expect(
      arrowhead(
        [
          [5, 5],
          [5, 5],
        ],
        3,
        2,
      ),
    ).toBe('')
  })
})
