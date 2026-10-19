# Signal diagrams: what landed and what is next

**2026-10-19.** Review of the 25 panel schematics (`src/ui/*Diagram.tsx`, about
6,400 lines) for simplification, compactness, interactivity and a way to turn
them off.

## Landed

- **Switch** (`704be3bc`): `src/ui/signalDiagrams.ts` holds a persisted flag
  (`videoskillet_signal_diagrams`, default on). A ☰ row and a palette entry
  flip it. `ControlGroup` drops a schematic group's frame when it is off. The
  wipe, PiP, mask and view miniatures stay, because they are controls.
- **`role="group"`** (`08d82ee9`, bender `aacc210`): an `img` role makes its
  children presentational, which hid the boxes and plot handles from screen
  readers.
- **`openBox`** (`bc3ec36a`): `BoxRows` takes `{...openBox(boxes, selected)}`.
  Chyron and Caption still pass their own props, because their bus labels are
  selectable ids with no box.
- **Key lists** (`206d00a1`): mixer loop, decoder, deflection and sync derive
  `*_KEYS` from `*_OPENS`. A throwaway test checked the sets matched first.
- **Plot handles** (`4f215fed`): RF drags the `pic` marker (`rfMistuneMHz`),
  Recording drags the luma filter's corner (`lumaMHz` across, `lumaPeak` up),
  and Leak drags the echo span's far end (`ghostDelayUs`).
  - Recording's gain scale steps between 2, 5 and 15× with the peaking, so the
    diagram holds the scale from the first pointer move until the new
    `PlotHandle.onDrop`.
  - A harness drag on a `#set=` look needs a few seconds to settle first. The
    look morphs in, and the morph overwrites the drag's writes.

## Next, in the order worth doing

- **Rows land under the plot.** Pressing a box at the top puts its rows 110-145
  units lower, possibly below the fold. `scrollIntoView({block: 'nearest'})` on
  select is the obvious fix and is unmeasured. `nearest` on a tall rows block
  has edge cases, so scroll a small anchor, and skip the scroll on first mount
  (Chyron and Camera loop open a box initially). Test on a short window.
- **Open box resets.** `Section` unmounts its children when a group folds, so
  `useSelectedBox` and `showFramed` reset. Keeping the selection per group needs
  a key in `useSelectedBox`, which sits in the shared `diagram-boxes` region, so
  bender changes too.
- **Flat plots at stock.** Several plots, Sync's line and frame shifts among
  them, are probably flat lines at stock and cost about 45 units each. Folding a
  plot away until a knob moves saves that height. The flat shape also shows what
  the plot measures, and it conflicts with the plots-side-by-side rule in the
  compact-schematics memory. Ask first.
- **Touch targets.** Boxes are 20-24 units tall, roughly 24px. A taller hit area
  drawn the same size would help. Box `<title>` tooltips never show on touch, so
  help text appears only once a box is open.
- **Group names** repeat in `schematicKeys.ts`, `SCHEMATIC_FRAMES` and
  `HEADING`. The `Record<SchematicGroup, ...>` type already catches a missing
  entry, so this is low value.

## Tried and dropped

- **A `box()` factory.** The 22 closures take five signatures: a per-box `y`, an
  optional `h`, an optional `off`, and `live(id)` or `r.touched(...)`. A shared
  helper needs as many options as it saves lines.

## Traps

- **Do not symlink `node_modules` into a worktree.** The pre-commit hook runs
  pnpm, which tried to purge the linked directory (it aborted for lack of a
  TTY). Run `CI=true pnpm install --frozen-lockfile` in the worktree.
- **`EnterWorktree` branches from `origin/main`.** Local commits that are not
  pushed are missing, so run `git rebase main` first.
- **`pnpm sync:check` compares against the sibling's primary checkout.** A
  shared-region change fails the pre-commit warning until both repos have landed
  it.
- **`rerender.dom.test.tsx` mounts the App once per `describe`.** Tests share
  the open stage, and `openGroup` clicks the stage button, so a test that
  re-opens an already open stage closes it. Add new cases after the existing
  ones.
- **The flag is module state.** `signalDiagrams.ts` reads storage at import and
  keeps the value, so a test that turns it off has to turn it back on.
