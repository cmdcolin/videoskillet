import { createRoot } from 'react-dom/client'

import '../theme.css'
import { StreamPage } from './StreamPage'

// The stream's own entry, beside /vote/ and for the same reasons main.tsx
// there gives — and no <StrictMode>, since the effect creates an engine.
const root = document.getElementById('root')
if (root) {
  document.body.style.margin = '0'
  createRoot(root).render(<StreamPage />)
}
