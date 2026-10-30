// The bracketed clause a stage's hover text ends on, and nothing when there is
// nothing in it.
export const countSay = (touched: number, say?: string) =>
  touched === 0 ? '' : ` (${say ?? `${touched} off stock`})`
