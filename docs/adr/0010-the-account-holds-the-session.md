# 0010 — The account holds the session, not just the library

**Status:** accepted, 2026-09-14.

## Context

[0005](0005-saved-profiles-need-an-account.md) put saved profiles in Firestore
and drew a line around them: an account buys the library and nothing else, and
no other feature moved behind it. That line held while signing in was something
you did once, inside the app, to get a save box.

Signing in is now the landing page's main offer, and a signed-in visitor lands
on a home page at `/` instead of the marketing page. A home page has to have
something on it. The two things a returning visitor wants are the setup they
were last running and a way to tell their saved looks apart, and neither
survives the trip: the last session lives in the URL of a tab that is gone, and
the library is a list of names with no picture beside them.

So the account carries two more things. The session last open, as the same
packed query a profile holds plus a clock; and one still per saved profile, a
small webp of the picture as it was when the profile was saved.

## Decision

**The user document holds the session, and a subcollection holds the stills.**

`users/{uid}` gains an optional `current`, either `{query, at}` or null, merged
into the same document the profile list lives in. It is one more field on a
document the app already reads on load, so the home page's "Continue where you
left off" card costs no extra read.

Stills go to `users/{uid}/stills/{id}`, keyed by the profile's id, holding
`{webp, at}`. They are not fields on the user document for two reasons a
document cannot get around. A Firestore document is capped at 1 MiB, and the
profile list is capped at 200 entries — two hundred stills of a few KB each
passes the ceiling. And a still is written when one profile is saved, while the
list is written whenever any of them changes; separate documents mean the two
writes do not collide.

**Both new fields are optional, and so is `profiles`.** Two writers merge into
the user document from paths of their own: the session autosave can land before
the first profile is ever saved, and a profile save must leave `current` as it
found it. A rule that required either key would refuse one of those writes.

**Per-device state stays local.** The rundown, the clip library, the pinned
sliders, the 1–9 scenes and the drift switches stay in `localStorage`. They
describe how one machine is set up — which clips are on its disk, which sliders
its operator keeps to hand — and syncing them would mean reconciling two
machines' hardware. The account carries what is portable: the look, and the
picture of the look.

## Consequences

- **The rules can validate `current` and each still, and still not each
  profile.** `current` is a map, so `firestore.rules` checks its keys, that
  `query` is a string under 8000 characters, and that `at` is a number. A still
  is its own document, so the rules check both its fields and cap `webp` at
  60000 characters. `profiles` is still a list, and rules cannot iterate one, so
  the per-entry gap 0005 recorded is unchanged — narrower now, since the two
  fields added since are both checked.
- **The autosave adds writes.** Every settle of the controls sends one document
  write while signed in, throttled to roughly one per settle rather than one per
  slider move. A long session of dialling costs tens of writes where it used to
  cost none, which is small against the free tier and is the price of the resume
  card.
- **A still is a few KB.** Base64 inflates a webp by a third, so the 60000-
  character cap is about 45 kB of picture, far under the 1 MiB a document may
  hold. 200 profiles at that ceiling is 12 MB across 200 documents, which the
  subcollection holds and a single document would not. The app writes 320x256
  and falls back to 160x128 when the larger encode passes the cap; the gallery
  looks, rendered live, came to 28 kB of base64 at most at the larger size.
- **The session has a still too.** Each timed session write also writes
  `stills/_session`, which the rules already allow, since they accept any still
  id. A profile id is base36 and cannot collide with it. The resume card shows
  it only when it is no older than `current.at`: a session written from a
  hidden tab carries no still, because the grab waits for a frame a hidden tab
  never draws, and an older still pictures an earlier board.
- **The home page reads two queries on load.** One get of the user document for
  the library and the session, one list of the stills subcollection for the
  pictures. `list` is granted on stills and withheld on `/users` because the
  path binds the uid, so a stills query can only ever be over one person's own.
  A return from the app by Back keeps the stills it has and gets only the ones
  saved since.
- **A board the page opened on writes nothing.** The app button on the home
  page opens the landing look on bars, and a gallery card or a shared link
  opens a finished look. The autosave used to record either a few seconds
  later, so opening one and leaving put it over the session the account held.
  The autosave now takes the first board the page shows, once the engine is up,
  as where it opened, and writes nothing until the board moves off it. On the
  gallery links, measured in Firefox Nightly, that first board already carries
  the whole look, sources included, and nothing moves it until a control does.
- **The last write wins on `current`.** Two devices signed into one account
  overwrite each other's session, and the card resumes whichever settled last.
  No merge and no conflict prompt: `current` is a convenience, the profile
  library is the thing worth not losing, and a resume card that asked which
  device you meant would cost more than it saved.
- **Deploying the rules is still manual.** `pnpm firebase-deploy` sends them and
  nothing in CI does, so the new fields' guards are tested and not live until
  someone runs it — the same footgun 0005 recorded, now covering three shapes
  instead of one.
