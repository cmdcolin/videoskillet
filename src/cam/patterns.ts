// The pictures the set makes itself, the same ones the app's source menus
// offer, and what each one is.
export const PATTERNS = [
  'bars',
  'tv static',
  'vhs static',
  'synth',
  'sweep',
] as const
export type Pattern = (typeof PATTERNS)[number]
export const PATTERN_TITLE: Record<Pattern, string> = {
  bars: 'SMPTE colour bars',
  'tv static': 'snow from a channel with no station on it',
  'vhs static': 'the noise off a blank tape',
  synth: 'oscillators patched into the input',
  sweep: 'a frequency zone plate',
}
