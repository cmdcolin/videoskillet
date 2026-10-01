import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import nodemailer from 'nodemailer'

import { digest, gather } from './digest.js'

// Reports of recordings that failed or crashed the page (src/ui/takeLog.ts),
// emailed once an hour. A visitor writes a report without signing in, so the
// hourly batch is what bounds the mail a flood of them could send.

// The Gmail account that sends the digest to itself, and an app password for
// it, set with `firebase functions:secrets:set GMAIL_APP_PASSWORD`.
const GMAIL = 'colin.diesh@gmail.com'
const PASSWORD = defineSecret('GMAIL_APP_PASSWORD')

initializeApp()

export const takeDigest = onSchedule(
  { schedule: 'every 60 minutes', secrets: [PASSWORD], timeoutSeconds: 120 },
  async event => {
    const { reports, total } = await gather(
      getFirestore(),
      new Date(event.scheduleTime),
    )
    if (total === 0) return
    await nodemailer
      .createTransport({
        service: 'gmail',
        auth: { user: GMAIL, pass: PASSWORD.value() },
      })
      .sendMail({ from: GMAIL, to: GMAIL, ...digest(reports, total) })
  },
)
