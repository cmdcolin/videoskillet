import type { Plugin } from 'vite'

// Dev-only. The landing page and the guide are Astro's
// (`site/pages/`, astro.config.mjs) and this server does not know how to render
// either — so `/` had nothing behind it and answered 404, while `/app/` worked.
// That is a confusing way to find out the front door moved.
//
// Redirected rather than proxied, and the difference is not fussiness: Astro's
// dev server injects `/@vite/client` and `/@id/astro/runtime/...` into every
// page it serves, and both of those paths mean something else on this server.
// Proxying the document alone hands the browser a page whose scripts resolve
// against the wrong dev server; sending the browser to Astro's port hands it a
// page whose scripts resolve against the one that emitted them.
//
// Keep SITE_PORT in step with `astro dev --port` in package.json's `dev`.
const SITE_PORT = 4321

export function site(): Plugin {
  return {
    name: 'videoskillet.js-site',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://app').pathname
        if (path === '/' || path === '/guide' || path.startsWith('/guide/')) {
          res.writeHead(302, {
            location: `http://localhost:${SITE_PORT}${req.url}`,
          })
          res.end()
        } else {
          next()
        }
      })
    },
  }
}
