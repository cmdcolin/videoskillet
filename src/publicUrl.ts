// Where the files in `public/` are, from a page that is not at the root.
//
// Every page is one directory below the root (`site/pages/{app,cam,vote,stream}`),
// and everything in `public/` is at the root, so the root is `../` from whichever
// page is asking. That holds on a dev server, on videoskillet.com and on a
// preview, none of which this has to tell apart.
//
// Resolved per call rather than once into a module constant, and that is not a
// style choice: `scripts/docgen.mjs` imports the control tables through vite's
// SSR runner, which pulls this module in with no `document` in scope. A
// top-level `new URL('../', document.baseURI)` threw there and took `pnpm build`
// down with it — the same reason `core/gpu/env.ts` guards its `location` read.
export const publicUrl = (name: string) =>
  typeof document === 'undefined'
    ? `/${name}`
    : new URL(`../${name}`, document.baseURI).href
