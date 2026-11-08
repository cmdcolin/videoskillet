<!-- CROSS_REPO_SYNC(commit-conventions) -->

## Commits

Use Conventional Commits (`type(scope): description`). `cliff.toml` groups the
changelog by type and renders the scope inline. `Release vX.Y.Z` commits come
from `scripts/push.mjs` and stay out of the changelog.

<!-- CROSS_REPO_SYNC_END(commit-conventions) -->

Scope is optional; when used, pick one of `signal`, `sync`, `deflection`, `gpu`,
`ui`, `midi`, `audio`, `docs`. The first three are the domains in
`docs/ARCHITECTURE.md`.
