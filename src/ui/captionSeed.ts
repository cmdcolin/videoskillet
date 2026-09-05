import { TELETYPE_DEFAULT } from '../sources/teletype'

import type { Controls } from '../core/controls'

// A look that turns on the caption decoder or the chyron has nothing to show
// until line 21 carries words, and the caption is blank until someone types
// one. A chip that reads as doing nothing is a chip nobody clicks twice, so a
// look that wants words is handed the teletype card's default when the caption
// is empty, and leaves any caption already there alone.
export const CAPTION_SEED = TELETYPE_DEFAULT.text

export const wantsWords = (patch: Partial<Controls>) =>
  (patch.cc !== undefined && patch.cc > 0) ||
  (patch.cgMix !== undefined && patch.cgMix > 0)
