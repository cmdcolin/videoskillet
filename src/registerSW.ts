import { publicUrl } from './publicUrl'

// Production only: in dev the pages are served by vite, and a worker that
// answers from a cache is the one thing that can make an HMR edit appear not to
// have happened.
export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // The script's own directory becomes the scope, so the worker covers the
    // landing page and the labelling tools as well as the instrument, wherever
    // the build is served from.
    navigator.serviceWorker
      .register(publicUrl('sw.js'))
      .catch((err: unknown) => {
        console.warn('[sw] registration failed', err)
      })
  }
}
