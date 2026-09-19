# 0012 — The account keeps one session per visit, up to a cap

**Status:** accepted, 2026-09-17, cap raised and manual delete added 2026-09-19.
Supersedes the single `current` session in
[0010](0010-the-account-holds-the-session.md).

## Context

0010 gave the account one session, which the home page offers back as "Continue
where you left off". Every settled write replaced it, so the board a visitor ran
yesterday was gone the moment they opened a gallery look today and touched a
slider. The autosave already writes on every settle, so the account was
discarding boards it had been sent.

The obvious extension is to keep every write as a history entry, and it is
wrong. A session of dialling writes once every ten seconds, so a short cap would
hold only the last minute or two of one visit, each a slightly different board —
which is why a page load gets one entry, not one per write.

## Decision

**The user document holds `recent`, a list of up to `RECENT_MAX`
`{id, query, at}`, newest first.** A page load mints one id, and every write
from that load replaces its own entry and moves it to the front. A later load
adds a new entry. An entry whose query matches the one being written is the same
board and gives up its place too.

**Resuming continues the entry it opened.** The home page's Resume link writes
the session's id into `sessionStorage` as it is followed, and the app takes it
once on load (`resumeHandoff.ts`). Without that, resume, tweak and leave would
leave the old entry and a near-copy side by side, and a few visits would fill
the list with one session's lineage. A link opened in a new tab carries no id
and starts a new entry, which costs a slot and loses nothing.

**Each entry has its own still,** `stills/_session-{id}`. A write that pushes an
entry off the list deletes that entry's still, best effort.

**`current` is read once and removed.** An account with no `recent` reads its
`current` as one entry with an empty id, whose still is the old
`stills/_session`. The first write folds it into the list and deletes `current`
in the same transaction.

**A session can also be deleted by hand.** The home page shows a preview of the
account's earlier sessions plus a link to `/sessions/`, which lists every one of
them; each card there and on the home page carries a "Delete" that calls
`dropSession`, the same kind of transaction as a push, and cleans up the entry's
still the same way a push dropping it off the end would.

## Consequences

- **A session write is a transaction.** It reads the document to merge the list,
  so a write from another device or tab is kept. That is one read more per
  autosave than 0010's blind merge.
- **The rules check the list's size and not its entries,** the same gap 0005
  records for `profiles`. `readRecent` drops malformed entries and duplicate ids
  on the way in.
- **Bender shares the model and the rules.** `recent` is in both
  `isValidProfileDoc` and `isValidVoiceDoc`, and the list algebra is in the
  `saved-list-model` and `saved-list-cloud` sync regions. `RECENT_MAX` itself
  sits just outside those regions, since each product's history cap is its own
  choice — videoskillet's is 1000, bender's is still 8.
- **The rules' number has to match `RECENT_MAX`.** `isValidProfileDoc`'s
  `size() <= 1000` and the rules test have to move together with it. A session's
  query is normally the packed form (tens to a few hundred bytes), which is what
  keeps 1000 of them under Firestore's 1 MiB document cap; `QUERY_MAX` alone
  would not.
