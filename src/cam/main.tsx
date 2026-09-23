import { createRoot } from 'react-dom/client'

import { startAnalytics } from '../analytics'
import { registerServiceWorker } from '../registerSW'
import '../theme.css'
import { CamPage } from './CamPage'

// The camera page's entry. The camera is a page of its own because a phone
// needs the picture and a shutter, and the instrument's panel would need a
// second layout to offer them. It renders without <StrictMode> for the reason
// src/main.tsx gives.
const root = document.getElementById('root')
if (root) {
  document.body.style.margin = '0'
  createRoot(root).render(<CamPage />)
}

registerServiceWorker()
startAnalytics()

// A hot update hands the device on to the next engine; see src/app.tsx.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.vf?.destroy({ keepDevice: true })
    window.vf = undefined
  })
}
