import { afterEach, describe, expect, it, vi } from 'vitest'

import { countAccounts, signupAlert, signupMail, traffic } from './signup.js'

describe('countAccounts', () => {
  it('counts each apps collection', async () => {
    const sizes = { users: 7, benderUsers: 2 }
    const db = {
      collection: name => ({
        count: () => ({
          get: () => Promise.resolve({ data: () => ({ count: sizes[name] }) }),
        }),
      }),
    }
    expect(await countAccounts(db)).toEqual({ videoskillet: 7, bender: 2 })
  })
})

describe('signupMail', () => {
  const user = { displayName: 'Ada', email: 'ada@example.com' }

  it('names the signup, the total and the traffic', () => {
    const { subject, text } = signupMail(
      'bender',
      user,
      { videoskillet: 7, bender: 42 },
      {
        today: 3,
        week: 20,
        month: 90,
        top: [{ path: '/', count: 15 }],
      },
    )
    expect(subject).toBe('bender: Ada saved for the first time (42 accounts)')
    expect(text).toContain('videoskillet accounts: 7')
    expect(text).toContain('last 7 days    20')
    expect(text).toContain('15  /')
  })

  it('names a user with no profile by uid', () => {
    const { subject } = signupMail('bender', { uid: 'u1' }, {}, undefined)
    expect(subject).toBe('bender: u1 saved for the first time (? accounts)')
  })

  it('still reports the signup when traffic is missing', () => {
    const { text } = signupMail(
      'bender',
      { uid: 'u1' },
      { bender: 1 },
      undefined,
    )
    expect(text).toContain('no overview this time')
  })
})

afterEach(() => vi.unstubAllGlobals())

const answer = body =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

describe('traffic', () => {
  it('asks for whole hours and maps the answers', async () => {
    const calls = []
    vi.stubGlobal('fetch', (url, init) => {
      calls.push([url, init.headers.Authorization])
      return url.includes('/stats/hits')
        ? answer({ hits: [{ path: '/', count: 4, extra: 1 }] })
        : answer({ total: 9 })
    })
    const stats = await traffic(
      'bender',
      't0k',
      new Date('2026-11-11T10:42:31.500Z'),
    )
    expect(stats).toEqual({
      today: 9,
      week: 9,
      month: 9,
      top: [{ path: '/', count: 4 }],
    })
    expect(calls[0][1]).toBe('Bearer t0k')
    expect(calls[0][0]).toContain('https://bender.goatcounter.com/api/v0/')
    expect(calls[0][0]).toContain('end=2026-11-11T10%3A00%3A00.000Z')
  })

  it('throws when GoatCounter refuses', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 401 }))
    await expect(traffic('bender', 'bad', new Date())).rejects.toThrow('401')
  })
})

const setup = (create = () => Promise.resolve()) => {
  const marker = {
    create: vi.fn(create),
    delete: vi.fn(() => Promise.resolve()),
  }
  const sizes = { users: 3, benderUsers: 1 }
  const db = {
    doc: vi.fn(() => marker),
    collection: name => ({
      count: () => ({
        get: () => Promise.resolve({ data: () => ({ count: sizes[name] }) }),
      }),
    }),
  }
  const mail = vi.fn(() => Promise.resolve())
  const deps = {
    db,
    auth: { getUser: uid => Promise.resolve({ uid, email: 'a@b.c' }) },
    mail,
    token: 't',
    collection: 'users',
    app: 'videoskillet',
    uid: 'u1',
  }
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 500 }))
  return { marker, mail, deps }
}

describe('signupAlert', () => {
  it('mails once and claims the uid first', async () => {
    const { marker, mail, deps } = setup()
    await signupAlert(deps)
    expect(deps.db.doc).toHaveBeenCalledWith('signupAlerts/users_u1')
    expect(marker.create).toHaveBeenCalledOnce()
    expect(mail).toHaveBeenCalledOnce()
    expect(mail.mock.calls[0][0].text).toContain('a@b.c')
  })

  it('stays quiet when the uid was already claimed', async () => {
    const { mail, deps } = setup(() =>
      Promise.reject(Object.assign(new Error('exists'), { code: 6 })),
    )
    await signupAlert(deps)
    expect(mail).not.toHaveBeenCalled()
  })

  it('fails loudly when the marker cannot be written', async () => {
    const { mail, deps } = setup(() =>
      Promise.reject(Object.assign(new Error('unavailable'), { code: 14 })),
    )
    await expect(signupAlert(deps)).rejects.toThrow('unavailable')
    expect(mail).not.toHaveBeenCalled()
  })

  it('releases the claim when the mail fails so a retry can send it', async () => {
    const { marker, mail, deps } = setup()
    mail.mockRejectedValueOnce(new Error('454 too many logins'))
    await expect(signupAlert(deps)).rejects.toThrow('454')
    expect(marker.delete).toHaveBeenCalledOnce()
  })
})
