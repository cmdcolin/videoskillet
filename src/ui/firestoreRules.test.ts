import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteField, documentId, serverTimestamp } from 'firebase/firestore'
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

  // The autosaved sessions, newest first. A list, so the rules check its size
  // and leave the entries to the client, as they do for profiles.
  const recent = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, ...session() }))

  it('lets the owner write the recent sessions and drop the old one', async () => {
    await seed(OWNER, { ...docOf('vhs'), current: session() })
    await assertSucceeds(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ recent: recent(1000), current: deleteField() }, { merge: true }),
    )
    const snap = await asOwner().doc(`users/${OWNER}`).get()
    expect(snap.data()).toEqual({ ...docOf('vhs'), recent: recent(1000) })
  })

  it('refuses a recent list that is too long or not a list', async () => {
    await assertFails(
      asOwner()
        .doc(`users/${OWNER}`)
        .set({ recent: recent(1001) }),
    )
    await assertFails(
      asOwner().doc(`users/${OWNER}`).set({ recent: session() }),
    )
    await assertFails(
      asStranger()
        .doc(`users/${OWNER}`)
        .set({ recent: recent(1) }, { merge: true }),
    )
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
      // `q` is the board the picture is of, and optional: a still written
      // before tagging has none, and one written for a saved look does not
      // need one.
      await assertSucceeds(ref.set(still({ q: 'x1y2z3' })))
      await assertFails(ref.set(still({ q: 7 })))
      await assertFails(ref.set(still({ q: 'A'.repeat(17) })))
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

  it('refuses the retired labelling collections, read and write', async () => {
    for (const name of ['candidates', 'votes', 'ratings']) {
      await assertFails(asOwner().doc(`${name}/anything`).get())
      await assertFails(asOwner().collection(name).add({ by: OWNER }))
    }
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
      const saved = { id: 'a1', query: 'p=Ab', at: 1 }
      await assertSucceeds(
        asOwner()
          .doc(doc)
          .set({ recent: [saved] }, { merge: true }),
      )
      const snap = await asOwner().doc(doc).get()
      expect(snap.data()).toEqual({
        voices: [voice],
        current: null,
        recent: [saved],
      })
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
      await assertFails(
        asOwner()
          .doc(doc)
          .set({ recent: Array.from({ length: 9 }, () => ({})) }),
      )
    })

    it('lets the owner keep the setup beside the voices', async () => {
      const prefs = {
        at: 1,
        bench: { all: true, closed: ['FM chip'] },
        morph: 4,
        keys: ['a', 'b'],
      }
      await assertSucceeds(
        asOwner()
          .doc(doc)
          .set({ voices: [voice] }),
      )
      await assertSucceeds(asOwner().doc(doc).set({ prefs }, { merge: true }))
      await assertSucceeds(
        asOwner()
          .doc(doc)
          .set({ prefs: { at: 2 } }, { mergeFields: ['prefs'] }),
      )
      const snap = await asOwner().doc(doc).get()
      expect(snap.data()).toEqual({ voices: [voice], prefs: { at: 2 } })
    })

    it('refuses a setup of the wrong shape', async () => {
      const bad = (prefs: unknown) =>
        assertFails(asOwner().doc(doc).set({ prefs }))
      await bad('nope')
      await bad({ bench: { all: true, closed: [] } })
      await bad({ at: 'now' })
      await bad({ at: 1, extra: true })
      await bad({ at: 1, morph: 3 })
      await bad({ at: 1, bench: { all: 'yes', closed: [] } })
      await bad({ at: 1, bench: { all: true, closed: Array(9).fill('x') } })
      await bad({ at: 1, bench: { all: true, closed: [], extra: 1 } })
      await bad({ at: 1, keys: Array(65).fill('a') })
    })

    it('keeps a bender uid out of the videoskillet document', async () => {
      await assertFails(
        asOwner()
          .doc(`users/${OWNER}`)
          .set({ voices: [voice] }),
      )
    })
  })

  describe('takeReports', () => {
    const report = (over: object = {}) => ({
      kind: 'lost',
      version: '2.6.0',
      browser: 'Mozilla/5.0 (Linux; Android 14; K) Chrome/141',
      page: '/cam/',
      width: 822,
      height: 1096,
      fps: 30,
      codec: 'avc1.64001f',
      hardware: 'no',
      seconds: 7,
      frames: 210,
      held: 40,
      deepest: 3,
      encoded: 170,
      chunks: 168,
      coded: '816x1088',
      canvas: '822x1096',
      configs: 1,
      error: 'OperationError',
      stage: 'recording',
      hidden: false,
      model: 'XQ-DQ54',
      memory: 8,
      sat: serverTimestamp(),
      ...over,
    })

    it('takes a report from a visitor who never signed in', async () => {
      await assertSucceeds(asAnon().collection('takeReports').add(report()))
      await assertSucceeds(
        asAnon().collection('takeReports').add({
          kind: 'failed',
          version: '2.6.0',
          browser: 'x',
          message: 'could not start',
          sat: serverTimestamp(),
        }),
      )
    })

    it('refuses a report with extra, oversized or mistyped fields', async () => {
      const add = (over: object) =>
        assertFails(asAnon().collection('takeReports').add(report(over)))
      await add({ extra: 1 })
      await add({ kind: 'other' })
      await add({ message: 'x'.repeat(101) })
      await add({ browser: 'x'.repeat(201) })
      await add({ frames: '210' })
      await add({ encoded: '170' })
      await add({ error: 'x'.repeat(33) })
      await add({ coded: 'x'.repeat(17) })
      await add({ hidden: 'no' })
      await add({ sat: 1_700_000_000_000 })
    })

    it('lets nobody read, change or list a report', async () => {
      await env.withSecurityRulesDisabled(async ctx => {
        await ctx
          .firestore()
          .doc('takeReports/one')
          .set(report({ sat: 1 }))
      })
      await assertFails(asAnon().doc('takeReports/one').get())
      await assertFails(asOwner().doc('takeReports/one').get())
      await assertFails(asOwner().collection('takeReports').get())
      await assertFails(asAnon().doc('takeReports/one').update({ held: 0 }))
      await assertFails(asAnon().doc('takeReports/one').delete())
    })
  })
})
