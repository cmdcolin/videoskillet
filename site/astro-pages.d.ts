declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
  const page: AstroComponentFactory
  export default page
}
