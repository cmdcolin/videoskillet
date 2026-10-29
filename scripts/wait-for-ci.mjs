// CROSS_REPO_SYNC_FILE(wait-for-ci)
//
// Pushes HEAD if origin lacks it, then blocks until CI finishes on that commit.
// Usage: node scripts/wait-for-ci.mjs [--job <name>]...
// Without --job, waits for every workflow run on the commit, so a release tag
// waits on its own workflow as well as the deploy. With --job, waits for the
// named jobs only and leaves the rest to finish on their own. Exits 1 on the
// first red one. CI_WAIT_MINUTES bounds the wait (default 45).

import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const POLL_MS = 15_000
const APPEAR_MS = 5 * 60_000
const WAIT_MS = Number(process.env.CI_WAIT_MINUTES ?? 45) * 60_000

const jobs = process.argv.flatMap((arg, i, all) =>
  arg === '--job' ? [all[i + 1]] : [],
)

const out = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()
const api = path => JSON.parse(out('gh', ['api', path]))

function fail(problem) {
  console.error(`CI is not green: ${problem}`)
  process.exit(1)
}

const sha = out('git', ['rev-parse', 'HEAD'])
const short = sha.slice(0, 7)

if (!out('git', ['branch', '-r', '--contains', sha])) {
  console.log(`Pushing ${short} so CI can see it`)
  execFileSync('git', ['push', '--follow-tags'], { stdio: 'inherit' })
}

// The API lists runs newest first; keep the newest per workflow, so a manual
// re-run replaces the run it repeats.
function latestRuns() {
  const seen = new Set()
  return api(
    `repos/:owner/:repo/actions/runs?head_sha=${sha}`,
  ).workflow_runs.filter(
    run => !seen.has(run.workflow_id) && seen.add(run.workflow_id),
  )
}

function findJobs(runs) {
  const found = runs.flatMap(run =>
    api(`repos/:owner/:repo/actions/runs/${run.id}/jobs`)
      .jobs.filter(j => jobs.includes(j.name))
      .map(j => ({ ...j, html_url: run.html_url })),
  )
  return jobs.map(
    name => found.find(j => j.name === name) ?? { name, status: 'not started' },
  )
}

const started = Date.now()
const announced = new Set()

for (;;) {
  const runs = latestRuns()
  for (const run of runs) {
    if (!announced.has(run.id)) {
      console.log(`${run.name} on ${short}: ${run.html_url}`)
      announced.add(run.id)
    }
  }

  const watched = jobs.length > 0 ? findJobs(runs) : runs
  const red = watched.find(
    w => w.status === 'completed' && w.conclusion !== 'success',
  )
  if (red) fail(`${red.name} ${red.conclusion}: ${red.html_url}`)
  if (watched.length > 0 && watched.every(w => w.status === 'completed')) {
    console.log(`${watched.map(w => w.name).join(', ')} green on ${short}`)
    break
  }

  const waited = Date.now() - started
  if (runs.length === 0 && waited > APPEAR_MS) {
    fail(`no run appeared for ${short} in ${APPEAR_MS / 60_000} minutes`)
  }
  if (waited > WAIT_MS) {
    const pending = watched.filter(w => w.status !== 'completed')
    fail(
      `still waiting on ${pending.map(w => `${w.name} (${w.status})`).join(', ') || 'a run'} ` +
        `after ${WAIT_MS / 60_000} minutes`,
    )
  }
  await sleep(POLL_MS)
}
