# Agent documentation

Top level is exactly this file. Everything else is filed:

- `handoffs/` — live state of an unfinished thread. Pointers, not content;
  delete when the thread lands. Re-read its open list against main before
  editing, and let a done item leave the list. `docs/handoffs/` is a different
  thing: dated evidence notes the guide publishes, kept while something cites
  them (`docs/handoffs/README.md`).
- Settled how-it-works → `reference/`; a proposal → `ideas/` (none yet); a
  decision → `docs/adr/`.
- Tried and declined → a sentence at the code that would re-try it, with the
  number. There is no rejected-ideas shelf.
- What a session did and which commits → git already holds it.

Cite a doc by its path, so a move is a grep.
