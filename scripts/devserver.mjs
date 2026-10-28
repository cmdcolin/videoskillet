// An astro dev server of a harness's own, on a private port, so a run never
// reloads under somebody editing against the shared one.
//
// astro's own binary and not `pnpm exec astro`, so the kill reaches the server:
// killing pnpm leaves its child holding the port. `--ignore-lock` because the
// lock file names whichever server started first, and a harness that attached
// to it would be measuring somebody else's.

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const portFree = port =>
  new Promise(resolve => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })

// Resolves once `path` answers 200, which is the page compiled and served; a
// 404 means the server is up and the page is not, which is the failure this
// exists to catch.
export const startDevServer = async (
  port,
  { path = '/', timeoutMs = 120_000 } = {},
) => {
  if (!(await portFree(port))) {
    throw new Error(`port ${port} is taken; stop whatever holds it`)
  }
  const url = `http://127.0.0.1:${port}`
  const child = spawn(
    'node',
    [
      'node_modules/astro/bin/astro.mjs',
      'dev',
      '--port',
      String(port),
      '--host',
      '127.0.0.1',
      '--ignore-lock',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
  const close = () => {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  }
  const interrupted = () => {
    close()
    process.exit(130)
  }
  process.on('exit', close)
  process.once('SIGINT', interrupted)
  process.once('SIGTERM', interrupted)

  let exit = null
  child.once('exit', (code, signal) => {
    exit = code ?? signal
  })
  const deadline = Date.now() + timeoutMs
  let status = null
  while (status !== 200) {
    if (exit !== null || Date.now() > deadline) {
      close()
      throw new Error(
        exit === null
          ? `astro dev: ${url}${path} answered ${status ?? 'nothing'} for ${timeoutMs}ms`
          : `astro dev exited (${exit})`,
      )
    }
    status = await fetch(`${url}${path}`, {
      signal: AbortSignal.timeout(30_000),
    }).then(
      res => {
        res.body?.cancel()
        return res.status
      },
      () => null,
    )
    if (status !== 200) await new Promise(r => setTimeout(r, 250))
  }
  return { url, close }
}
