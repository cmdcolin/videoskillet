import { useEffect, useEffectEvent } from 'react'

import { debugLog } from '../core/gpu/env'

interface Recognizer {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  abort(): void
  addEventListener(
    type: 'result',
    listener: (e: SpeechRecognitionEvent) => void,
  ): void
  addEventListener(
    type: 'error',
    listener: (e: SpeechRecognitionErrorEvent) => void,
  ): void
  addEventListener(type: 'end', listener: () => void): void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => Recognizer
    webkitSpeechRecognition?: new () => Recognizer
  }
}

const recognizerClass = () =>
  typeof window === 'undefined'
    ? undefined
    : (window.SpeechRecognition ?? window.webkitSpeechRecognition)

export const canHear = () => recognizerClass() !== undefined

// Enough for the chyron's four rows several times over.
const KEEP = 400

// How long the chyron keeps the last words after people stop talking.
const QUIET_MS = 20000

// How long a session that ended waits before listening again, so a browser
// that ends every session at once is not asked again in a tight loop.
const AGAIN_MS = 1000

// Errors after which listening again would only fail the same way.
const FINAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])

// The chyron's words: `fallback` while it is quiet, and what people near the
// phone say, in capitals the way a caption set them, while they talk. Each
// finished phrase is handed to `onPhrase`. The browser ends a session after a
// pause or a minute, so a session that ends is started again while `on` holds.
// A browser with no recognition keeps `fallback` up.
export function useSpeech(
  on: boolean,
  opts: {
    fallback: string
    onText: (text: string) => void
    onPhrase: (words: string) => void
  },
) {
  const report = useEffectEvent(opts.onText)
  const phrase = useEffectEvent(opts.onPhrase)
  const { fallback } = opts

  useEffect(() => {
    if (on) {
      const Recognition = recognizerClass()
      let heard = ''
      let live = true
      let quiet = 0
      let again = 0
      const hush = () => {
        window.clearTimeout(quiet)
        quiet = window.setTimeout(() => {
          debugLog('speech quiet, back to the fallback')
          heard = ''
          report(fallback)
        }, QUIET_MS)
      }
      report(fallback)
      const rec = Recognition === undefined ? null : new Recognition()
      if (rec !== null) {
        const listen = () => {
          try {
            rec.start()
          } catch (e) {
            debugLog('speech start failed', e)
          }
        }
        rec.continuous = true
        rec.interimResults = true
        rec.lang = navigator.language
        rec.addEventListener('result', e => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const result = e.results[i]!
            const words = result[0]?.transcript.trim() ?? ''
            if (result.isFinal && words !== '') {
              heard = `${heard} ${words}`.trim().slice(-KEEP)
              phrase(words)
            } else {
              interim = `${interim} ${words}`
            }
          }
          const text = `${heard} ${interim.trim()}`.trim()
          if (text !== '') {
            report(text.slice(-KEEP).toUpperCase())
            hush()
          }
        })
        rec.addEventListener('error', e => {
          debugLog(`speech error: ${e.error} ${e.message}`)
          if (FINAL.has(e.error)) live = false
        })
        rec.addEventListener('end', () => {
          debugLog(`speech ended, again: ${live}`)
          if (live) again = window.setTimeout(listen, AGAIN_MS)
        })
        listen()
      }
      return () => {
        live = false
        window.clearTimeout(quiet)
        window.clearTimeout(again)
        rec?.abort()
      }
    }
    return undefined
  }, [on, fallback])
}
