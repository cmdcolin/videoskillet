import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { documentId, serverTimestamp } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'

import { readFileSync } from 'node:fs'

// firestore.rules, exercised against the real rules engine in the emulator.
//
// This is the only test in the suite that needs a process outside vitest, and it
// is the one test the app could not otherwise have: the signed-in path needs a
// Google account, which no headless run can complete, so until this existed the
// rules had been *compiled* and never *evaluated*. They are also the whole
// boundary — the web config is public (docs/adr/0005), so if these are wrong,
// nothing else is stopping a stranger.
//
// Run with `pnpm test:rules`, which wraps `firebase emulators:exec`. Under a bare
// `pnpm test` there is no emulator, so the suite skips itself rather than failing
// — a missing emulator is not a broken app, and `pnpm test` has to stay runnable
// on a machine with no Java.
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST
const PROJECT = 'ntscjs-rules-test'
const OWNER = 'owner-uid'
const STRANGER = 'stranger-uid'

// A profile as the app writes one, and a document holding some.
const entry = (name: string) => ({ name, query: 'set=noiseIre:4&mod=' })
const docOf = (...names: string[]) => ({ profiles: names.map(entry) })

describe.skipIf(EMULATOR === undefined)('firestore.rules', () => {
  let env: RulesTestEnvironment

  beforeAll(async () => {
    const [host, port] = (EMULATOR ?? '').split(':')
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host,
        port: Number(port),
      },
    })
  })

  afterAll(async () => {
    await env?.cleanup()
  })

  // Seeded through withSecurityRulesDisabled, so a read test is testing the read
  // rule rather than whichever write rule happened to put the data there.
  const seed = async (uid: string, data: object) => {
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(`users/${uid}`).set(data)
    })
  }
  const asOwner = () => env.authenticatedContext(OWNER).firestore()
  const asStranger = () => env.authenticatedContext(STRANGER).firestore()
  const asAnon = () => env.unauthenticatedContext().firestore()

  it('lets the owner read and write their own document', async () => {
    // The app's whole happy path: save a list, read it back on the next load.
    await assertSucceeds(asOwner().doc(`users/${OWNER}`).set(docOf('vhs')))
    await assertSucceeds(asOwner().doc(`users/${OWNER}`).get())
    // ...and overwrite it, which is what every later save does.
    await assertSucceeds(
      asOwner().doc(`users/${OWNER}`).set(docOf('vhs', 'worn tape')),
    )
    // The document really holds what the app expects to read back.
    const snap = await asOwner().doc(`users/${OWNER}`).get()
    expect(snap.data()).toEqual(docOf('vhs', 'worn tape'))
  })

  it('lets the owner clear the list, and delete the document', async () => {
    // Deleting the last profile writes an empty list rather than removing the
    // document, so the empty list has to be a legal write.
    await assertSucceeds(asOwner().doc(`users/${OWNER}`).set({ profiles: [] }))
    await assertSucceeds(asOwner().doc(`users/${OWNER}`).delete())
  })

  it('refuses another signed-in user', async () => {
    await seed(OWNER, docOf('private look'))
    // The finding that would matter most: one account reading another's library.
    await assertFails(asStranger().doc(`users/${OWNER}`).get())
    await assertFails(asStranger().doc(`users/${OWNER}`).set(docOf('theirs')))
    await assertFails(asStranger().doc(`users/${OWNER}`).delete())
  })

  it('refuses an unauthenticated client', async () => {
    await seed(OWNER, docOf('private look'))
    await assertFails(asAnon().doc(`users/${OWNER}`).get())
    await assertFails(asAnon().doc(`users/${OWNER}`).set(docOf('theirs')))
  })

  it('refuses a query over the collection, even a scoped one', async () => {
    // The rules allow `get` and deliberately not `list`. Without that split, any
    // signed-in user could enumerate every user document in the project — the one
    // hole a per-document ownership check does not close by itself.
    await seed(OWNER, docOf('private look'))
    await assertFails(asOwner().collection('users').get())
    await assertFails(asStranger().collection('users').get())
    // The assertion that actually pins the get/list split, and the reason this
    // test is written in two halves. An *unconstrained* query is refused whatever
    // the rules say, because `request.auth.uid == uid` cannot hold across every
    // document it would match — so the two lines above pass just as happily
    // against `allow read`, which grants list. Binding the wildcard with a
    // documentId constraint makes the condition satisfiable, so this query is
    // allowed under `read` and refused under `get`: it fails only because list is
    // withheld. Verified by mutation — swapping `get` for `read` in the rules
    // turns exactly this line red and leaves the rest of the file green.
    await assertFails(
      asOwner().collection('users').where(documentId(), '==', OWNER).get(),
    )
  })

  it('refuses a document carrying anything but the profile list', async () => {
    // hasOnly(['profiles']): the document is this app's list and nothing else.
    // Somebody's own uid is not a place to park arbitrary data in the project.
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ ...docOf('vhs'), admin: true }),
    )
    await assertFails(asOwner().doc(`users/${OWNER}`).set({ notes: 'hello' }))
  })

  it('refuses a profiles field that is not a list', async () => {
    await assertFails(asOwner().doc(`users/${OWNER}`).set({ profiles: 'vhs' }))
    await assertFails(asOwner().doc(`users/${OWNER}`).set({ profiles: 7 }))
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ profiles: { vhs: 'x' } }),
    )
  })

  it('caps the list at 200 entries, on create and on update', async () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => entry(`look ${i}`))
    await assertSucceeds(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ profiles: many(200) }),
    )
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ profiles: many(201) }),
    )
    // The update path is checked separately on purpose: a cap enforced only on
    // create is a cap you get past by creating a small document and growing it,
    // which is the first thing the rules auditor's checklist asks about.
    await seed(OWNER, docOf('vhs'))
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ profiles: many(201) }),
    )
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .update({ profiles: many(201) }),
    )
  })

  // The session the account carries alongside the library: the same packed query
  // a profile holds, and a clock. The app writes it with merge from a path of its
  // own, so it has to be legal on its own and legal absent — see docs/adr/0010.
  const session = (over: object = {}) => ({
    query: 'set=noiseIre:4&mod=',
    at: 1_700_000_000_000,
    ...over,
  })

  it('lets the owner write the session on its own, and the list on its own', async () => {
    // The autosave can land before the first profile is ever saved, so a document
    // with no `profiles` key at all has to be a legal write.
    await assertSucceeds(
      asOwner().doc(`users/${OWNER}`).set({ current: session() }),
    )
    // ...and a profile save must be able to leave `current` alone, which with
    // merge means sending a document that does not mention it.
    await assertSucceeds(
      asOwner().doc(`users/${OWNER}`).set(docOf('vhs'), { merge: true }),
    )
    const snap = await asOwner().doc(`users/${OWNER}`).get()
    expect(snap.data()).toEqual({ ...docOf('vhs'), current: session() })
  })

  it('accepts a cleared session', async () => {
    // Signing out of a look writes null rather than deleting the field, so null
    // is part of the contract.
    await assertSucceeds(asOwner().doc(`users/${OWNER}`).set({ current: null }))
    await assertSucceeds(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ ...docOf('vhs'), current: null }),
    )
  })

  it('refuses a malformed session', async () => {
    // Unlike a profile entry, `current` is a map the rules can read field by
    // field, so every one of these is caught in the rules and not in the client.
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ current: session({ extra: 'field' }) }),
    )
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ current: session({ query: 7 }) }),
    )
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ current: session({ query: 'x'.repeat(8001) }) }),
    )
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ current: session({ at: 'now' }) }),
    )
    await assertFails(asOwner().doc(`users/${OWNER}`).set({ current: 'vhs' }))
  })

  it('refuses a session written by anybody else', async () => {
    await seed(OWNER, docOf('private look'))
    await assertFails(
      asStranger().doc(`users/${OWNER}`).set({ current: session() }),
    )
    await assertFails(
      asStranger()
        .doc(`users/${OWNER}`)
        .set({ current: session() }, { merge: true }),
    )
    await assertFails(
      asAnon().doc(`users/${OWNER}`).set({ current: session() }),
    )
  })

  // One still per saved profile, keyed by the profile's id. Its own
  // subcollection because the user document is capped at 1 MiB and two hundred
  // stills would pass it.
  describe('the stills subcollection', () => {
    const still = (over: object = {}) => ({
      webp: 'UklGRh'.repeat(4),
      at: 1_700_000_000_000,
      ...over,
    })
    const seedStill = async (uid: string, id: string, data: object) => {
      await env.withSecurityRulesDisabled(async ctx => {
        await ctx.firestore().doc(`users/${uid}/stills/${id}`).set(data)
      })
    }

    it('lets the owner read, write and remove their own stills', async () => {
      const ref = asOwner().doc(`users/${OWNER}/stills/p1`)
      await assertSucceeds(ref.set(still()))
      await assertSucceeds(ref.get())
      await assertSucceeds(ref.update({ at: 1_700_000_001_000 }))
      await assertSucceeds(ref.delete())
    })

    it('lets the owner list their own stills', async () => {
      // `list` is allowed here and withheld on /users because the path binds the
      // uid, so the query can only ever be over one person's own stills. The home
      // page reads the whole set in one query to put a picture on every card.
      await seedStill(OWNER, 'p1', still())
      await seedStill(OWNER, 'p2', still())
      await assertSucceeds(asOwner().collection(`users/${OWNER}/stills`).get())
    })

    it('refuses another signed-in user and an unauthenticated client', async () => {
      await seedStill(OWNER, 'p1', still())
      await assertFails(asStranger().doc(`users/${OWNER}/stills/p1`).get())
      await assertFails(
        asStranger().doc(`users/${OWNER}/stills/p1`).set(still()),
      )
      await assertFails(asStranger().doc(`users/${OWNER}/stills/p1`).delete())
      await assertFails(asAnon().doc(`users/${OWNER}/stills/p1`).get())
      await assertFails(asAnon().doc(`users/${OWNER}/stills/p1`).set(still()))
    })

    it("refuses a stranger listing somebody else's stills", async () => {
      // The finding that would matter most on this collection: `list` is granted,
      // so the uid in the path is the only thing keeping one account's pictures
      // out of another's query.
      await seedStill(OWNER, 'p1', still())
      await assertFails(asStranger().collection(`users/${OWNER}/stills`).get())
      await assertFails(asAnon().collection(`users/${OWNER}/stills`).get())
    })

    it('refuses a still that is too big or the wrong shape', async () => {
      const ref = asOwner().doc(`users/${OWNER}/stills/p1`)
      // 60000 characters of base64 is roughly 45 kB of webp, which is a wide
      // margin over the thumbnails the app writes and well under the 1 MiB a
      // document may hold.
      await assertSucceeds(ref.set(still({ webp: 'A'.repeat(60000) })))
      await assertFails(ref.set(still({ webp: 'A'.repeat(60001) })))
      await assertFails(ref.set(still({ webp: 7 })))
      await assertFails(ref.set({ webp: 'UklGRh' }))
      await assertFails(ref.set(still({ at: 'now' })))
      await assertFails(ref.set(still({ admin: true })))
      // The cap has to hold on update too, for the same reason the 200-entry cap
      // does: a cap enforced only on create is one you get past by growing a
      // small document.
      await seedStill(OWNER, 'p2', still())
      await assertFails(
        asOwner()
          .doc(`users/${OWNER}/stills/p2`)
          .update({ webp: 'A'.repeat(60001) }),
      )
    })
  })

  it('refuses every other collection in the project', async () => {
    // Default deny: firestore.rules names the paths it grants, so anything added
    // later without a rule of its own is closed rather than open.
    await assertFails(asOwner().doc('presence/anything').set({ x: 1 }))
    await assertFails(asOwner().doc('config/flags').get())
    await assertFails(asOwner().doc(`users/${OWNER}/extra/doc`).set({ x: 1 }))
  })

  // bender's document: the /users shape under another name, on the same
  // project. One test per guard that differs from nothing above, and one that
  // the two collections stay apart.
  describe('the bender collection', () => {
    const voice = { name: 'squeezed screamer', query: 'p=AbCd' }
    const doc = `benderUsers/${OWNER}`

    it('lets the owner write voices and the session, apart or together', async () => {
      await assertSucceeds(
        asOwner()
          .doc(doc)
          .set({ voices: [voice] }),
      )
      await assertSucceeds(
        asOwner()
          .doc(doc)
          .set({ current: { query: 'p=Ab', at: 1 } }, { merge: true }),
      )
      await assertSucceeds(
        asOwner().doc(doc).set({ current: null }, { merge: true }),
      )
      const snap = await asOwner().doc(doc).get()
      expect(snap.data()).toEqual({ voices: [voice], current: null })
      await assertSucceeds(asOwner().doc(doc).delete())
    })

    it('refuses a stranger, an unauthenticated client, and a bad shape', async () => {
      await env.withSecurityRulesDisabled(async ctx => {
        await ctx
          .firestore()
          .doc(doc)
          .set({ voices: [voice] })
      })
      await assertFails(asStranger().doc(doc).get())
      await assertFails(asStranger().doc(doc).set({ voices: [] }))
      await assertFails(asAnon().doc(doc).get())
      await assertFails(
        asOwner()
          .doc(doc)
          .set({ profiles: [voice] }),
      )
      await assertFails(asOwner().doc(doc).set({ voices: 'nope' }))
      await assertFails(
        asOwner()
          .doc(doc)
          .set({ current: { query: 'p=', at: 'now' } }),
      )
      await assertFails(
        asOwner()
          .doc(doc)
          .set({ voices: Array.from({ length: 201 }, () => voice) }),
      )
    })

    it('keeps a bender uid out of the videoskillet document', async () => {
      await assertFails(
        asOwner()
          .doc(`users/${OWNER}`)
          .set({ voices: [voice] }),
      )
    })
  })

  // The vote page's two collections. Unlike saved profiles these are shared —
  // anyone signed in contributes to one dataset — so the rules bound what a bad
  // contributor can do rather than who can contribute. Every assertion below is
  // one of those bounds.
  describe('the vote collections', () => {
    const CID = 'abc1234'
    const candidate = (over: object = {}) => ({
      v: 1,
      id: CID,
      seed: 42,
      kind: 'mix',
      weights: { vhs: 1, 'fb bloom': 0.4 },
      query: 'set=noiseIre:4&mod=',
      by: OWNER,
      sat: serverTimestamp(),
      ...over,
    })
    const vote = (over: object = {}) => ({
      v: 1,
      a: 'abc1234',
      b: 'def5678',
      choice: 'a',
      ms: 1800,
      seed: 21,
      source: 'bars',
      at: 1_700_000_000_000,
      by: OWNER,
      sat: serverTimestamp(),
      ...over,
    })
    const seedDoc = async (path: string, data: object) => {
      await env.withSecurityRulesDisabled(async ctx => {
        await ctx.firestore().doc(path).set(data)
      })
    }

    it('lets a signed-in voter add a candidate and a vote', async () => {
      await assertSucceeds(asOwner().doc(`candidates/${CID}`).set(candidate()))
      await assertSucceeds(asOwner().collection('votes').add(vote()))
    })

    it('lets any signed-in voter read a candidate somebody else rolled', async () => {
      // The point of a shared pool: a look one person rolled gets judged by
      // another person's eyes.
      await seedDoc(`candidates/${CID}`, candidate())
      await assertSucceeds(asStranger().doc(`candidates/${CID}`).get())
    })

    it('refuses an unauthenticated client entirely', async () => {
      await seedDoc(`candidates/${CID}`, candidate())
      await assertFails(asAnon().doc(`candidates/${CID}`).get())
      await assertFails(asAnon().doc('candidates/zzz').set(candidate()))
      await assertFails(asAnon().collection('votes').add(vote()))
    })

    it('makes a candidate immutable, even to whoever wrote it', async () => {
      // The id is a hash of the recipe, so a document that could change would be
      // lying about its own name — and every vote already cast refers to it.
      await seedDoc(`candidates/${CID}`, candidate())
      await assertFails(
        asOwner().doc(`candidates/${CID}`).update({ query: 'set=&mod=' }),
      )
      await assertFails(asOwner().doc(`candidates/${CID}`).delete())
      await assertFails(asStranger().doc(`candidates/${CID}`).delete())
    })

    it('refuses a candidate whose id does not match its own key', async () => {
      // Without this the id stops determining the contents, and create-only stops
      // being a safe way to store a hash-addressed document.
      await assertFails(
        asOwner()
          .doc('candidates/wrongkey')
          .set(candidate({ id: CID })),
      )
    })

    it('makes a vote immutable and undeletable', async () => {
      // A dataset whose rows can be rewritten after the fact is not evidence of
      // anything. Changing your mind means casting another vote.
      await seedDoc('votes/v1', vote())
      await assertFails(asOwner().doc('votes/v1').update({ choice: 'b' }))
      await assertFails(asOwner().doc('votes/v1').delete())
      await assertFails(asStranger().doc('votes/v1').update({ choice: 'b' }))
    })

    it('shows a voter their own votes and nobody else theirs', async () => {
      await seedDoc('votes/mine', vote())
      await seedDoc('votes/theirs', vote({ by: STRANGER }))
      await assertSucceeds(asOwner().doc('votes/mine').get())
      await assertFails(asOwner().doc('votes/theirs').get())
    })

    it('refuses a forged author on either collection', async () => {
      // `by` is what a training script filters on when a run of votes turns out
      // to be junk, so it must not be something a client can choose.
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ by: STRANGER })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ by: STRANGER })),
      )
    })

    it('refuses a client-chosen timestamp', async () => {
      // `sat == request.time` is what forces a real server stamp. The client's
      // own clock rides along in `at`, and the gap between them is what makes a
      // vote cast offline and flushed hours later visible as exactly that.
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ sat: 1_700_000_000_000 })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ sat: new Date('2020-01-01') })),
      )
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ sat: 12345 })),
      )
    })

    it('refuses a query over either collection', async () => {
      // Same get/list split the users collection makes, for the same reason:
      // exporting the dataset for training is an admin job, and a client query
      // would let any signed-in user pull the whole pool down. Constrained by
      // documentId so the query is satisfiable and fails only because list is
      // withheld — see the users test above for why that distinction matters.
      await seedDoc(`candidates/${CID}`, candidate())
      await seedDoc('votes/mine', vote())
      await assertFails(asOwner().collection('candidates').get())
      await assertFails(asOwner().collection('votes').get())
      await assertFails(
        asOwner().collection('candidates').where(documentId(), '==', CID).get(),
      )
      await assertFails(
        asOwner().collection('votes').where(documentId(), '==', 'mine').get(),
      )
    })

    it('refuses a candidate carrying an unbounded map or extra fields', async () => {
      const many = Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`preset ${i}`, 0.5]),
      )
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ weights: many })),
      )
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ weights: 'vhs' })),
      )
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ query: 'x'.repeat(8001) })),
      )
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ admin: true })),
      )
      await assertFails(
        asOwner()
          .doc('candidates/zzz')
          .set(candidate({ kind: 'whatever' })),
      )
    })

    it('refuses a vote that is not a comparison', async () => {
      // A vote between a candidate and itself carries no preference, and a choice
      // outside the four the page can send is a hand-rolled request.
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ b: 'abc1234' })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ choice: 'maybe' })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ ms: -1 })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ ms: 600_001 })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ source: 'x'.repeat(65) })),
      )
      await assertFails(
        asOwner()
          .collection('votes')
          .add(vote({ extra: 'field' })),
      )
    })

    const rating = (over = {}) => ({
      v: 1,
      tagSet: 1,
      look: 'abc1234',
      query: 'set=noiseIre:4&mod=',
      weights: { vhs: 1 },
      preset: null,
      provenance: 'surprise',
      tags: ['calm', 'warm'],
      cool: 4,
      ms: 2200,
      source: 'bars',
      at: 1_700_000_000_000,
      by: OWNER,
      sat: serverTimestamp(),
      ...over,
    })

    it('accepts a rated look from the app and from the page', async () => {
      await assertSucceeds(asOwner().collection('ratings').add(rating()))
      // A look dialled in by hand has no recipe behind it — empty weights and no
      // preset — and still has to be ratable, since that is most of what the app
      // will send.
      await assertSucceeds(
        asOwner()
          .collection('ratings')
          .add(rating({ weights: {}, preset: null, provenance: 'hand' })),
      )
      await assertSucceeds(
        asOwner()
          .collection('ratings')
          .add(rating({ tags: [], preset: 'vhs', provenance: 'preset' })),
      )
    })

    it('refuses a rating with a forged author, clock or score', async () => {
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ by: STRANGER })),
      )
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ sat: 1_700_000_000_000 })),
      )
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ cool: 0 })),
      )
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ cool: 6 })),
      )
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ cool: 3.5 })),
      )
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ provenance: 'somewhere' })),
      )
      await assertFails(
        asOwner()
          .collection('ratings')
          .add(rating({ extra: 'field' })),
      )
    })

    it('keeps ratings private, immutable and unqueryable', async () => {
      await seedDoc('ratings/mine', rating())
      await seedDoc('ratings/theirs', rating({ by: STRANGER }))
      await assertSucceeds(asOwner().doc('ratings/mine').get())
      await assertFails(asOwner().doc('ratings/theirs').get())
      await assertFails(asOwner().doc('ratings/mine').update({ cool: 1 }))
      await assertFails(asOwner().doc('ratings/mine').delete())
      await assertFails(asOwner().collection('ratings').get())
      await assertFails(asAnon().collection('ratings').add(rating()))
    })

    it('accepts every choice the page can actually send', async () => {
      for (const choice of ['a', 'b', 'skip', 'neither']) {
        await assertSucceeds(
          asOwner().collection('votes').add(vote({ choice })),
        )
      }
    })
  })
})
