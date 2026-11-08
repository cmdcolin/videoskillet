# videoskillet

Real-time NTSC signal-path simulator in WebGPU compute shaders. Read
`docs/ARCHITECTURE.md` before any non-trivial change; `docs/adr/` holds the
decisions where the obvious thing is wrong.

- Before touching code that creates, releases or tears down a `GPUDevice`, or
  when a tab freezes: `agent-docs/reference/gpu-device-lifetime.md`.
- Before writing a commit message: `agent-docs/reference/commits.md`.

## Traps

- **Model the mechanism that causes an artifact**, never a drawing of the
  artifact, and put a displacement in the domain that causes it (signal, sync or
  deflection; `docs/ARCHITECTURE.md` › The three domains). A geometry fault
  routed through sync spins hue that should stay put.
- **Keep horizontal offsets row-uniform**: `decode` stages a shared tile per
  row, so per-pixel horizontal scaling needs that staging restructured first.
- **Let go of a presenting `GPUDevice` and hand the live one on**, in `pagehide`
  and unload cleanup too. `device.destroy()` silently ends the tab's rendering
  step, and the next page loaded in that tab stops rendering as well (ADR 0004).
- **Write plain declarative English** in docs, comments and app copy, with no
  inversions, fragments or aphorisms, and state the positive half of a contrast
  unless the reader needs the distinction to choose. `docs/WRITING.md` is the
  checklist for a prose pass.

## Testing WebGPU

- **Test WebGPU on Linux in Firefox Nightly** (`scripts/browser.mjs` launches
  it). Chrome's ANGLE/Vulkan backend there reports texture-allocation errors
  that are driver artifacts.
- **Run long or repeated browser measurements from a `git worktree add --detach`
  copy with its own vite server.** Other agents share this checkout, and any
  `src/` write, your own included, hot-reloads the page and resets the engine
  mid-run. `docs/DEVELOPMENT.md` › Browser harness traps lists the rest.

## Recorded clips

- **`appreel`, `demoreel` and `agentreel --upload` publish to a public bucket**:
  each mp4 goes to `s3://myloveydove.com/videoskillet/` under `--profile colin`
  at the end of a take, and CloudFront is invalidated. `demoreel --no-upload`
  keeps a trial local.
- **Store a new kind of recording through `publish` in `scripts/bucket.mjs`**
  and commit only its still.

<!-- CROSS_REPO_SYNC(agent-sync-rules) -->

## Cross-repo sync

videoskillet and bender share a design system, a site structure and most of
their account code. Regions marked `CROSS_REPO_SYNC` must stay identical across
the two repos; [`docs/CROSS_REPO_SYNC.md`](docs/CROSS_REPO_SYNC.md) covers the
markers and the workflow.

- Before editing a marked region, port the same change to the sibling repo
  (`~/src/videoskillet` or `~/src/bender`) and run `pnpm sync:check` in either.
- When a change applies to both apps but touches unmarked code, make it in both
  anyway, and mark the result once the two copies match.
- Keep product-specific values in constants outside a region.

<!-- CROSS_REPO_SYNC_END(agent-sync-rules) -->
