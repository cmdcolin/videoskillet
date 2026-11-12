import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import nodemailer from 'nodemailer'

import { digest, gather } from './digest.js'
import { APPS, signupAlert } from './signup.js'

// Reports of recordings that failed or crashed the page (src/ui/takeLog.ts),
// emailed once an hour. A visitor writes a report without signing in, so the
// hourly batch is what bounds the mail a flood of them could send.

// The Gmail account that sends the digest to itself, and an app password for
// it, set with `firebase functions:secrets:set GMAIL_APP_PASSWORD`.
const GMAIL = 'colin.diesh@gmail.com'
const PASSWORD = defineSecret('GMAIL_APP_PASSWORD')

// `firebase functions:secrets:set GOATCOUNTER_TOKEN`, a token with the
// statistics permission. Deploying needs it set, even to a placeholder.
const COUNTER_TOKEN = defineSecret('GOATCOUNTER_TOKEN')

initializeApp()

const mailer = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL, pass: PASSWORD.value() },
  })

// A failed run is retried, so one Gmail error does not lose that hour's
// report. The window is the hour before `event.scheduleTime`, which Cloud
// Scheduler sends unchanged on every attempt at the same run, so a retry
// mails the same reports. The backoff goes 1, 2 and 4 minutes, and every
// retry lands well before the next hour's run.
export const takeDigest = onSchedule(
  {
    schedule: 'every 60 minutes',
    secrets: [PASSWORD],
    timeoutSeconds: 120,
    retryCount: 3,
    minBackoffSeconds: 60,
    maxBackoffSeconds: 600,
  },
  async event => {
    const { reports, total } = await gather(
      getFirestore(),
      new Date(event.scheduleTime),
    )
    if (total === 0) return
    await mailer().sendMail({
      from: GMAIL,
      to: GMAIL,
      ...digest(reports, total),
    })
  },
)

const alertOn = (collection, app) =>
  onDocumentCreated(
    {
      document: `${collection}/{uid}`,
      secrets: [PASSWORD, COUNTER_TOKEN],
      timeoutSeconds: 60,
      retry: true,
    },
    event =>
      signupAlert({
        db: getFirestore(),
        auth: getAuth(),
        mail: message =>
          mailer().sendMail({ from: GMAIL, to: GMAIL, ...message }),
        token: COUNTER_TOKEN.value(),
        collection,
        app,
        uid: event.params.uid,
      }),
  )

export const videoskilletSignup = alertOn('users', APPS.users)
export const benderSignup = alertOn('benderUsers', APPS.benderUsers)
