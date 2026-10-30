import { startAnalytics } from 'skillet-shared/analytics'

import '../theme.css'
import { StreamPage } from './StreamPage'

// The stream's own entry, beside /vote/ and for the same reasons main.tsx
// there gives — and no <StrictMode>, since the effect creates an engine.
document.body.style.margin = '0'
startAnalytics()

export default StreamPage

// A hot update hands the device on to the next engines; see src/app.tsx.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.vfs?.forEach(engine => engine.destroy({ keepDevice: true }))
    window.vfs = undefined
    window.vf = undefined
  })
}
