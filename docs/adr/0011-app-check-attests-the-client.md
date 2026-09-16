# 0011 — App Check attests the client, and the rules do not rate limit

**Status:** accepted, 2026-09-16.

## Context

The project moved from the free Spark plan to Blaze, and that changes what an
abusive client costs.

`firestore.rules` bounds the _shape_ of every write: the collective collections
the labelling tools write into (`candidates`, `votes`, `ratings`) are
create-only, size-capped, and stamped with `request.auth.uid` and
`request.time`, so nobody can forge who wrote a row or when, alter one, delete
one, or enumerate the collection. Nothing bounds how _many_ a client writes. The
web config is public by design ([0005](0005-saved-profiles-need-an-account.md)),
so anyone with a Google account can sign in and write from a script.

On Spark that was a lockout: the day's quota ran out, the project stopped
serving, and it reset at midnight Pacific. On Blaze the free tier is the first
slice and everything past it bills, with no ceiling.

The rules cannot fix this, and the reason is worth recording because the
workaround looks like it works. The usual pattern is a `rateLimits/{uid}`
document holding the time of that user's last write, which the collection's rule
reads with `get()` and compares against `request.time`. Nothing forces a client
to update that document. One that never writes it leaves `at` old forever and
every write passes. Closing the hole needs the row and the limiter to land as
one operation the rules can see as one, and they cannot: rules evaluate each
write in a batch on its own, and `get()` returns committed state, so the row's
rule reads the limiter as it was before the batch. Requiring
`get(...).data.at == request.time` instead fails for the same reason from the
other side — two separate operations carry two different `request.time`s.

So a limiter in the rules costs a document read per write, bounds a naive
client, and steps aside for a determined one.

## Decision

**App Check attests that a request came from this app, and the rules stay as
they are.**

`cloud.ts` initializes App Check with a reCAPTCHA Enterprise provider
immediately after `initializeApp`, before `getAuth` and `getFirestore` have a
chance to send anything. The import is dynamic like every other firebase import
in that file.

**The site key is a constant that starts empty, and an empty key installs
nothing.** A build without a key fetches none of the App Check chunk and sends
requests exactly as every session has sent them since the project was created.
Registering a key in the console is the other half of turning this on, and it
cannot be done from the repository.

**Enforcement waits for the monitoring page.** App Check registers requests as
verified or unverified for as long as it is left unenforced, and that reading is
what says whether enforcing would lock out real users. A project that enforces
first finds out by taking the site down.

**No rate limiter in the rules**, for the reason in the context above.

## To turn it on

1. Firebase console → App Check → register the web app with reCAPTCHA
   Enterprise, and paste the key id into `APPCHECK_SITE_KEY` in `cloud.ts`, in
   both repos. The console deprecated plain reCAPTCHA v3 for App Check, which is
   why the provider is the Enterprise one; picking the other in the console
   while the code names this one leaves every request reading as unverified.
2. Leave enforcement off. Watch the App Check metrics page until verified
   requests are the overwhelming majority.
3. Enforce, per service, starting with Cloud Firestore.
4. Cloud Billing → Budgets & alerts, on `ntscjs-d4f56`. This is a backstop and
   it only notifies; a hard stop needs a budget-driven function that disables
   billing, which takes the whole site down with it.

## Consequences

- **The site key is public and committed**, like the config beside it. What it
  buys is attestation, and never secrecy — a token saying a request came from
  this app, which a script running the same key from another origin cannot get
  because reCAPTCHA is bound to the registered domains.
- **reCAPTCHA Enterprise is itself a billed service**, at 10,000 assessments a
  month free and roughly $1 per thousand after that. App Check exchanges a token
  about once per token TTL per client, an hour by default, so a session costs
  one assessment or two rather than one per request. The free tier covers this
  project's traffic by a wide margin, and it is one more line the budget alert
  is watching.
- **A signed-in user running the real app can still loop.** App Check answers
  "is this the app", and it does not answer "is this person reasonable". The
  bound left on that is the budget alert, plus create-only, size-capped rows
  that a training script can filter by `by` and deliberation time.
- **The cost lands on sessions that already load Firebase.** App Check
  initializes inside `loadSdk`, which a session reaches by pressing sign in or
  by carrying the `SIGNED_IN_HINT`. A signed-out visitor still fetches zero
  bytes from any Google host, which is the measurement 0005 recorded. The App
  Check chunk builds to 16 kB, 5.5 kB gzipped, on top of Google's own reCAPTCHA
  script; with the key empty, nothing fetches either.
- **Sign-in waits for one more round trip.** `loadSdk` awaits the App Check
  install before it hands back the auth instance, so the reCAPTCHA script is on
  the sign-in path. `warmSignIn` already fetches ahead on a pointer over the
  button, which is where that cost is meant to be absorbed.
- **Enforcement makes localhost need a debug token.**
  `FIREBASE_APPCHECK_DEBUG_TOKEN` is registered per browser in the console.
  Nothing is needed while enforcement is off, which is why step 3 above is the
  one to be slow about.
- **Anyone adding a deploy target adds its domain to the reCAPTCHA key**, the
  same way 0005 records that they have to add it to the authorized-domains list.
  A key that does not name the host returns no token and every request reads as
  unverified.
- **Do not add a rules rate limiter that reads a client-updated document.** It
  reads as protection in review, spends a document read per write, and a client
  that declines to update the limiter is unaffected. Rate limiting that holds
  needs a Cloud Function, which the project has never needed and which is its
  own bill.
