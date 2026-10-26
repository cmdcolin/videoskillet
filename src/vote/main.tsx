import { startAnalytics } from 'skillet-shared/analytics'

import '../theme.css'
import { VotePage } from './VotePage'

// The vote page's own entry, and the reason it is a second page rather than a
// dialog in the app: the instrument has enough on it, and this tool wants the
// whole screen, its own engine and none of the panel. Astro builds it
// from `site/pages/vote/`, so it ships alongside the app at /vote/.
//
// Not wrapped in <StrictMode>, for exactly the reason src/main.tsx gives: it
// double-invokes effects, and the effect here calls Engine.create. Two
// GPUDevices per load with a teardown between them is the shape that used to
// freeze the tab.
document.body.style.margin = '0'
startAnalytics()

export default VotePage
