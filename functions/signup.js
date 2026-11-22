import { Timestamp } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

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

class CounterError extends Error {
  constructor(path, status) {
    super(`GoatCounter ${path} answered ${status}`)
    this.status = status
  }
}

const RETRIES = 4
const RETRY_PAUSE = 1000
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

const get = async (site, path, token, params, retries = RETRIES) => {
  const response = await fetch(
    `${counter(site)}${path}?${new URLSearchParams(params)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (response.ok) {
    return response.json()
  } else if (response.status === 429 && retries > 0) {
    await pause(RETRY_PAUSE)
    return get(site, path, token, params, retries - 1)
  } else {
    throw new CounterError(path, response.status)
  }
}

const views = async (site, token, now, days) => {
  try {
    const { total } = await get(site, '/stats/total', token, {
      start: new Date(now.getTime() - days * DAY).toISOString(),
      end: now.toISOString(),
    })
    return total
  } catch (error) {
    if (error instanceof CounterError && error.status === 404) {
      return 0
    } else {
      throw error
    }
  }
}

export async function traffic(site, token, at) {
  const now = new Date(Math.floor(at.getTime() / HOUR) * HOUR)
  const today = await views(site, token, now, 1)
  const week = await views(site, token, now, 7)
  const month = await views(site, token, now, 30)
  const pages = await get(site, '/stats/hits', token, {
    start: new Date(now.getTime() - 7 * DAY).toISOString(),
    end: now.toISOString(),
    limit: String(TOP_PAGES),
  })
  return {
    today,
    week,
    month,
    top: pages.hits.map(h => ({ path: h.path, count: h.count })),
  }
}

const dashboard = app => `https://${app}.goatcounter.com`

export async function trafficOrFailure(app, token, at) {
  try {
    return await traffic(app, token, at)
  } catch (error) {
    logger.error('GoatCounter traffic failed', error)
    return { failed: error.message }
  }
}

const trafficText = (app, stats) =>
  [
    stats.failed === undefined
      ? [
          'Visitors',
          `  last 24 hours  ${stats.today}`,
          `  last 7 days    ${stats.week}`,
          `  last 30 days   ${stats.month}`,
          '',
          'Top pages, last 7 days',
          ...stats.top.map(p => `  ${String(p.count).padStart(6)}  ${p.path}`),
        ].join('\n')
      : `Traffic overview unavailable: ${stats.failed}`,
    `GoatCounter: ${dashboard(app)}`,
  ].join('\n\n')

export const signInMail = (app, user, stats) => {
  const who = user.displayName ?? user.email ?? user.uid
  return {
    subject: `${app}: ${who} signed in for the first time`,
    text: [
      `${user.displayName ?? 'no name'} <${user.email ?? 'no email'}> ${user.uid}`,
      trafficText(app, stats),
      'The account alert follows if they save.',
    ].join('\n\n'),
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
      trafficText(app, stats),
      'An account counts from its first save, so someone who signs in and saves nothing is not counted.',
    ].join('\n\n'),
  }
}

const claim = async (db, collection, uid) => {
  try {
    await db
      .doc(`signupAlerts/${collection}_${uid}`)
      .create({ at: Timestamp.now() })
    return true
  } catch (error) {
    if (error.code === ALREADY_EXISTS) {
      return false
    } else {
      throw error
    }
  }
}

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
      trafficOrFailure(app, token, new Date()),
    ])
    await mail(signupMail(app, user, totals, stats)).catch(async error => {
      await db.doc(`signupAlerts/${collection}_${uid}`).delete()
      throw error
    })
  }
}
