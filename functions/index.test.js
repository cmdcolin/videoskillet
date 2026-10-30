import { beforeEach, describe, expect, it, vi } from 'vitest'

import { gather } from './digest.js'
import { takeDigest } from './index.js'

const sendMail = vi.hoisted(() => vi.fn())

vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }))
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => 'db' }))
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}))
vi.mock('./digest.js', () => ({
  gather: vi.fn(() => Promise.resolve({ reports: ['r'], total: 1 })),
  digest: () => ({ subject: 's', text: 't' }),
}))

const RUN = { jobName: 'take-digest', scheduleTime: '2026-10-30T11:00:00.000Z' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('GMAIL_APP_PASSWORD', 'app-password')
})

describe('takeDigest', () => {
  it('asks Cloud Scheduler to retry a failed run with a backoff', () => {
    // The endpoint is what `firebase deploy` reads the schedule from.
    // oxlint-disable-next-line no-underscore-dangle
    expect(takeDigest.__endpoint.scheduleTrigger.retryConfig).toEqual({
      retryCount: 3,
      minBackoffSeconds: 60,
      maxBackoffSeconds: 600,
    })
  })

  it('fails the run when the mail fails, and a retry mails the same hour', async () => {
    sendMail.mockRejectedValueOnce(new Error('454 too many logins'))
    await expect(takeDigest.run(RUN)).rejects.toThrow('454')
    await takeDigest.run(RUN)
    expect(sendMail).toHaveBeenCalledTimes(2)
    const ends = vi.mocked(gather).mock.calls.map(([, end]) => end.getTime())
    expect(ends).toEqual([
      Date.parse(RUN.scheduleTime),
      Date.parse(RUN.scheduleTime),
    ])
  })
})
