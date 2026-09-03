// Where the files in `public/` are, from a page that is not at the root.
//
// `import.meta.env.BASE_URL` is what this used to be, and it stopped being
// right the moment the instrument moved off the root to make room for the
// landing page. The base is relative (vite.config.ts, so a build runs from any
// sub-path) and a relative base compiles `BASE_URL` to the literal `./` — which
// resolves against the *page*. From `/app/` that asks for `/app/sample.jpg`,
// and everything in `public/` is at `/sample.jpg`. It 404s rather than falling
// back, so what breaks is the bundled cat, the test clip and the wordmark.
//
// Every page is one directory below the root (vite.config.ts pins that), so the
// root is `../` from whichever one is asking — on a dev server, on
// videoskillet.com, and on a project site served from a sub-path, none of which
// this has to be told apart.
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
