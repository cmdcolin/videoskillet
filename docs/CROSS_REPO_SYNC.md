<!-- CROSS_REPO_SYNC_FILE(sync-doc) -->

# Cross-repo sync

videoskillet and bender are sibling apps by the same author. They share a design
system, a site shape (a static landing page that becomes a signed-in home), one
Firebase project and one way of saving work under a name. The products differ:
videoskillet saves looks, bender saves voices, and each has its own accent
colour and copy. Everything else aims to be the same code.

Marked regions keep the shared code identical. `scripts/sync-check.mjs` compares
every marked region in this repo with its counterpart in the sibling and fails
when they differ.

## Markers

Put a marker in whatever comment syntax the file uses.

| Marker                       | Region                                |
| ---------------------------- | ------------------------------------- |
| `CROSS_REPO_SYNC_FILE(<id>)` | the whole file, minus the marker line |
| `CROSS_REPO_SYNC(<id>)`      | from the line after this marker…      |
| `CROSS_REPO_SYNC_END(<id>)`  | …to the line before this one          |

An id is lowercase letters, digits and hyphens, and appears once per repo. The
file paths may differ between the repos: the id pairs the regions.

## What the check ignores

Each repo explains shared code in its own words and formats it with its own
tools, so the checker normalises both sides before comparing:

- It drops comment lines: `//`, `/* … */`, `<!-- … -->` and `{/* … */}`. Shell
  `#` comments stay, so hook files match line for line.
- It drops all whitespace, and a trailing comma before a closing bracket.
- It reads `<span></span>` as `<span/>`.
- Outside Markdown, it replaces each repo's product terms with a placeholder.
  `terms` in `cross-repo-sync.json` lists them, so `SavedProfile` in
  videoskillet and `SavedVoice` in bender both read as `«SavedItem»`.

Everything else counts, including import order inside a region. Keep imports
outside regions, since the two formatters sort them differently.

## Keeping a local value out of a region

A region holds the shared logic. A value that belongs to one product goes in a
named constant just outside the region, and the region refers to the name. The
existing regions show the pattern:

- `SIGNED_IN_HINT` and `COLLECTION` sit above the `firebase-auth` region in
  `cloud.ts`.
- `privacyHref` sits above the `landing-page-test` region.
- `LOADING` and `CARDS` sit below the `home-skeleton-markup` region, which
  holds the markup both sites share.
- bender imports its storage helpers under videoskillet's names
  (`read as readStored`), so `firebase-auth` reads the same on both sides.

## Running it

- `pnpm sync:check` compares with the sibling checkout. `--list` prints every id
  with its file on each side.
- The pre-commit hook runs it as a warning, because the sibling may be mid-port.
- The release preflight in `scripts/push.mjs` runs it and blocks.
- The checker looks for the sibling next to this repo's primary checkout, so a
  worktree finds it too. `CROSS_REPO_SYNC_SIBLING=/path` points it at another
  checkout, such as a worktree of the sibling.
- A missing sibling is a warning and a pass, which is what CI gets. `--strict`
  makes it a failure.

## Changing shared code

1. Make the change in one repo.
2. Port it to the same region in the sibling.
3. Run `pnpm sync:check` in either repo. When one side is a worktree, set
   `CROSS_REPO_SYNC_SIBLING` to the other side's worktree.
4. Commit and land both repos.

To share something new, align the two copies first, then add the same marker to
both. To stop sharing a region, remove its markers from both repos in the same
change.

## Not shared yet

These have counterparts in both repos that still differ. Each one needs a
decision about which side's version wins before it can be marked.

- Design tokens: videoskillet's `site/styles/tokens.css` and `src/theme.css` use
  different names for the same roles, and bender's `src/theme.css` uses px where
  videoskillet uses rem.
- Home and site-bar CSS: the same class names with different values.
- The page shell: bender links its stylesheets where videoskillet inlines them.
  Both carry the same canonical, Open Graph and theme-colour meta now, and the
  unfurl tags themselves are shared as `social-meta`. The two landing pages hold
  different things either way.
- Storage helpers: videoskillet's `src/ui/storage.ts` and bender's
  `src/ui/persist.ts`.
- The current-session hook body, the saved-list hook and its popover, and the
  app menu.
- The why-sign-in card's picture and its closing line: the two name different
  files and say different amounts. The head of the card and its buttons are
  `why-card-top` and `why-card-cta`.
- The home script's `showFrame`, `showHome`, `showLanding`, `paint` and
  `failedSection`.
- Tooling: formatters, lint, tsconfig, CI workflows, the release script and
  commit message conventions.
