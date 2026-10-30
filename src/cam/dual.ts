// What a phone did when asked for its other camera while one was open. Only
// `oneAtATime` says the phone cannot run both: it took the first camera down
// or handed the same one back. A refusal that left the first camera running
// may be a camera busy for a moment, and a superseded ask says nothing.
export type OtherAnswer<T> =
  | { kind: 'ok'; other: T }
  | { kind: 'oneAtATime' }
  | { kind: 'refused' }
  | { kind: 'superseded' }

export const answerOf = <T>(ask: {
  other: T | null
  latest: boolean
  same: boolean
  firstLive: boolean
  otherLive: boolean
}): OtherAnswer<T> =>
  !ask.latest
    ? { kind: 'superseded' }
    : !ask.firstLive || ask.same
      ? { kind: 'oneAtATime' }
      : ask.other === null || !ask.otherLive
        ? { kind: 'refused' }
        : { kind: 'ok', other: ask.other }

// The stored word for whether this phone runs both cameras, after `answer`.
export const dualAfter = (
  answer: OtherAnswer<unknown>['kind'],
  was: string | null,
) => (answer === 'ok' ? 'yes' : answer === 'oneAtATime' ? 'no' : was)
