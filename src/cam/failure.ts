import { reason } from '../ui/format'

// What the page was doing when something went wrong. The shutter's recorder
// words its own errors.
export type During =
  | 'sound'
  | 'captions'
  | 'tilt'
  | 'clip'
  | 'tape'
  | 'second camera'
  | 'camera on B'
  | 'shutter'

// Something that went wrong, kept as it was thrown and worded where it is
// shown.
export interface Failure {
  during: During
  error: unknown
}

const SETTINGS = 'Allow it in the browser’s site settings and try again.'

const denied = (e: unknown) =>
  e instanceof DOMException && e.name === 'NotAllowedError'

export const failureMessage = ({ during, error }: Failure) =>
  during === 'sound' && denied(error)
    ? `Microphone access was turned down. ${SETTINGS}`
    : during === 'captions' && error === 'not-allowed'
      ? `Captions need the microphone. ${SETTINGS}`
      : during === 'tilt'
        ? `Motion access was turned down. ${SETTINGS}`
        : during === 'shutter'
          ? reason(error)
          : `${during}: ${reason(error)}`
