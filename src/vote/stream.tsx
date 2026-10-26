import { startAnalytics } from 'skillet-shared/analytics'

import '../theme.css'
import { StreamPage } from './StreamPage'

// The stream's own entry, beside /vote/ and for the same reasons main.tsx
// there gives — and no <StrictMode>, since the effect creates an engine.
document.body.style.margin = '0'
startAnalytics()

export default StreamPage
