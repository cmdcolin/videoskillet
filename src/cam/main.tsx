import { startAnalytics } from 'skillet-shared/analytics'

import { paramsOf } from '../core/gpu/env'
import { registerServiceWorker } from '../registerSW'
import '../theme.css'
import { CamPage } from './CamPage'
import { boopThreshold, wantsCostume } from './costume'
import { CostumePage } from './CostumePage'
import { readLink } from './link'

// The camera page's entry. The camera is a page of its own because a phone
// needs the picture and a shutter, and the instrument's panel would need a
// second layout to offer them. It renders without <StrictMode> for the reason
// src/main.tsx gives.
document.body.style.margin = '0'
registerServiceWorker()
startAnalytics()

export default function Cam() {
  const search = paramsOf(location)
  return wantsCostume(search) ? (
    <CostumePage threshold={boopThreshold(search)} />
  ) : (
    <CamPage link={readLink(search)} />
  )
}

// A hot update hands the device on to the next engine; see src/app.tsx.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.vf?.destroy({ keepDevice: true })
    window.vf = undefined
  })
}
