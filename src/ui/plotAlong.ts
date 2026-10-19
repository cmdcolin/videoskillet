// What a fraction of the way across a plot's axis reads as, for the figure under
// the pointer.
export const alongRange =
  (from: number, to: number, unit: string) => (fraction: number) =>
    `${Number((from + (to - from) * fraction).toPrecision(3))} ${unit}`

export const alongPicture = (fraction: number) =>
  `${Math.round(fraction * 100)}% down`
