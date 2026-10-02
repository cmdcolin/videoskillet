import { deleteApp, initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { afterAll, describe, expect, it } from 'vitest'

import { digest, gather } from './digest.js'

const at = iso => Timestamp.fromDate(new Date(iso))

const report = (over = {}) => ({
  kind: 'lost',
  version: '2.6.0',
  browser: 'Chrome/141',
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
  stage: 'recording',
  hidden: false,
  model: 'XQ-DQ54',
  sat: new Date('2026-09-30T10:15:00Z'),
  ...over,
})

describe('digest', () => {
  it('names the device and how far the take got', () => {
    const { subject, text } = digest([report()], 1)
    expect(subject).toBe('videoskillet: 1 recording failed or crashed')
    expect(text).toContain('XQ-DQ54')
    expect(text).toContain('210 frames, 40 held, queue 3')
    expect(text).toContain(
      '170 encoded, 168 chunks back, coded 816x1088 in 1 config, canvas 822x1096',
    )
  })

  it('puts the error name in front of the message', () => {
    const { text } = digest(
      [report({ error: 'OperationError', message: 'Encoding error.' })],
      1,
    )
    expect(text).toContain('  OperationError: Encoding error.')
  })

  it('counts the reports it leaves out', () => {
    const { subject, text } = digest([report(), report()], 7)
    expect(subject).toBe('videoskillet: 7 recordings failed or crashed')
    expect(text).toContain('…and 5 more')
  })

  it('shows a failure message and a sparse report', () => {
    const { text } = digest(
      [
        {
          kind: 'failed',
          version: '2.6.0',
          browser: 'x',
          message: 'could not start',
          sat: new Date(0),
        },
      ],
      1,
    )
    expect(text).toContain('could not start')
    expect(text).toContain('unknown device')
  })
})

// Against the emulator, under `pnpm test:rules`.
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST

describe.skipIf(EMULATOR === undefined)('gather', () => {
  const app = initializeApp({ projectId: 'ntscjs-rules-test' }, 'digest-test')
  const db = getFirestore(app)
  afterAll(() => deleteApp(app))

  it('takes the hour before the run, oldest first', async () => {
    const end = new Date('2026-09-30T11:00:00Z')
    const col = db.collection('takeReports')
    await Promise.all([
      col.add(report({ model: 'early', sat: at('2026-09-30T09:59:59Z') })),
      col.add(report({ model: 'second', sat: at('2026-09-30T10:30:00Z') })),
      col.add(report({ model: 'first', sat: at('2026-09-30T10:00:00Z') })),
      col.add(report({ model: 'late', sat: at('2026-09-30T11:00:00Z') })),
    ])
    const { reports, total } = await gather(db, end)
    expect(total).toBe(2)
    expect(reports.map(r => r.model)).toEqual(['first', 'second'])
    expect(reports[0].sat).toBeInstanceOf(Date)
  })
})
