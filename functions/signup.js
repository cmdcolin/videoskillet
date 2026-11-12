import { Timestamp } from 'firebase-admin/firestore'

const ALREADY_EXISTS = 6
const HOUR = 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000
const counter = site => `https://${site}.goatcounter.com/api/v0`
const TOP_PAGES = 5

export const APPS = { users: 'videoskillet', benderUsers: 'bender' }

export async function countAccounts(db) {
  const counts = await Promise.all(
    Object.keys(APPS).map(async collection => [
      APPS[collection],
      (await db.collection(collection).count().get()).data().count,
    ]),
  )
  return Object.fromEntries(counts)
}

const get = async (site, path, token, params) => {
  const response = await fetch(
    `${counter(site)}${path}?${new URLSearchParams(params)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok) {
    throw new Error(`GoatCounter ${path} answered ${response.status}`)
  }
  return response.json()
}

const views = async (site, token, now, days) => {
  const { total } = await get(site, '/stats/total', token, {
    start: new Date(now.getTime() - days * DAY).toISOString(),
    end: now.toISOString(),
  })
  return total
}

export async function traffic(site, token, at) {
  const now = new Date(Math.floor(at.getTime() / HOUR) * HOUR)
  const [today, week, month, pages] = await Promise.all([
    views(site, token, now, 1),
    views(site, token, now, 7),
    views(site, token, now, 30),
    get(site, '/stats/hits', token, {
      start: new Date(now.getTime() - 7 * DAY).toISOString(),
      end: now.toISOString(),
      limit: String(TOP_PAGES),
    }),
  ])
  return {
    today,
    week,
    month,
    top: pages.hits.map(h => ({ path: h.path, count: h.count })),
  }
}

export const signupMail = (app, user, totals, stats) => {
  const who = user.displayName ?? user.email ?? user.uid
  return {
    subject: `${app}: ${who} saved for the first time (${totals[app] ?? '?'} accounts)`,
    text: [
      [
        `New ${app} account: ${user.displayName ?? 'no name'} <${user.email ?? 'no email'}> ${user.uid}`,
        ...Object.entries(totals).map(([name, n]) => `${name} accounts: ${n}`),
      ].join('\n'),
      stats === undefined
        ? 'Traffic: GoatCounter is not reachable, so there is no overview this time.'
        : [
            'Visitors',
            `  last 24 hours  ${stats.today}`,
            `  last 7 days    ${stats.week}`,
            `  last 30 days   ${stats.month}`,
            '',
            'Top pages, last 7 days',
            ...stats.top.map(
              p => `  ${String(p.count).padStart(6)}  ${p.path}`,
            ),
          ].join('\n'),
      'An account counts from its first save, so someone who signs in and saves nothing is not counted.',
    ].join('\n\n'),
  }
}

const claim = (db, collection, uid) =>
  db
    .doc(`signupAlerts/${collection}_${uid}`)
    .create({ at: Timestamp.now() })
    .then(
      () => true,
      error => (error.code === ALREADY_EXISTS ? false : Promise.reject(error)),
    )

export async function signupAlert({
  db,
  auth,
  mail,
  token,
  collection,
  app,
  uid,
}) {
  const first = await claim(db, collection, uid)
  if (first) {
    const [user, totals, stats] = await Promise.all([
      auth.getUser(uid).catch(() => ({ uid })),
      countAccounts(db).catch(() => ({})),
      traffic(app, token, new Date()).catch(() => undefined),
    ])
    await mail(signupMail(app, user, totals, stats)).catch(async error => {
      await db.doc(`signupAlerts/${collection}_${uid}`).delete()
      return Promise.reject(error)
    })
  }
}
