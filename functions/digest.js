import { Timestamp } from 'firebase-admin/firestore'

const HOUR = 60 * 60 * 1000
const SHOWN = 50

// The reports from the hour before `end`, oldest first, the first SHOWN of
// them, and how many there were in all.
export async function gather(db, end) {
  const hour = db
    .collection('takeReports')
    .where('sat', '>=', Timestamp.fromMillis(end.getTime() - HOUR))
    .where('sat', '<', Timestamp.fromDate(end))
  const total = (await hour.count().get()).data().count
  if (total === 0) return { reports: [], total }
  const shown = await hour.orderBy('sat').limit(SHOWN).get()
  return {
    reports: shown.docs.map(d => ({ ...d.data(), sat: d.data().sat.toDate() })),
    total,
  }
}

// The email: one block per report, and a count of any past the ones it lists.
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// A file size at the precision worth reading. A take's own size is the first
// thing a crash report is read for, so it is spelled rather than left in bytes.
const size = n =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`

// `lost` is a take whose note outlived its tab, and `failed` one the encoder
// declined; the model is only ever there on Chrome. Spelled out because
// `lost  unknown device` read as a lost GPU device, which is a different fault
// with its own page of documentation.
const head = r =>
  [r.sat.toISOString(), `take ${r.kind}`, r.page, r.model ?? 'model unknown']
    .filter(Boolean)
    .join('  ')

const block = r =>
  [
    head(r),
    `  ${r.width ?? '?'}x${r.height ?? '?'} @${r.fps ?? '?'}fps ${r.codec ?? ''}, hardware encoder ${r.hardware ?? '?'}`,
    `  ${r.seconds ?? '?'}s, ${r.frames ?? '?'} frames, ${r.held ?? '?'} held, queue ${r.deepest ?? '?'}, ${r.stage ?? '?'}${r.hidden === true ? ', page was hidden' : ''}`,
    ...(r.encoded === undefined
      ? []
      : [
          `  ${r.encoded} encoded, ${r.chunks ?? '?'} chunks back${r.bytes === undefined ? '' : `, ${size(r.bytes)}`}, coded ${r.coded || '?'} in ${plural(r.configs ?? 0, 'config')}, canvas ${r.canvas || '?'}`,
        ]),
    ...(r.message === undefined
      ? []
      : [`  ${r.error === undefined ? '' : `${r.error}: `}${r.message}`]),
    ...(r.memory === undefined ? [] : [`  ${r.memory} GB memory`]),
    `  ${r.browser} (v${r.version})`,
  ].join('\n')

export function digest(reports, total) {
  const more = total - reports.length
  return {
    subject: `videoskillet: ${plural(total, 'recording')} failed or crashed`,
    text: [
      ...reports.map(block),
      ...(more > 0 ? [`…and ${more} more in the takeReports collection.`] : []),
    ].join('\n\n'),
  }
}
