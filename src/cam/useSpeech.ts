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

// Errors after which listening again would only fail the same way.
const FINAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])

// What people near the phone say, as it is recognised, handed to `onText` as
// the latest few hundred characters. The browser ends a session after a pause
// or a minute, so a session that ends is started again while `on` holds.
export function useSpeech(on: boolean, onText: (text: string) => void) {
  const report = useEffectEvent(onText)

  useEffect(() => {
    const Recognition = recognizerClass()
    if (on && Recognition !== undefined) {
      let heard = ''
      let live = true
      const rec = new Recognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = navigator.language
      rec.addEventListener('result', e => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]!
          const words = result[0]?.transcript.trim() ?? ''
          if (result.isFinal) heard = `${heard} ${words}`.trim().slice(-KEEP)
          else interim = `${interim} ${words}`
        }
        report(`${heard} ${interim.trim()}`.trim().slice(-KEEP))
      })
      rec.addEventListener('error', e => {
        debugLog(`speech error: ${e.error} ${e.message}`)
        if (FINAL.has(e.error)) live = false
      })
      rec.addEventListener('end', () => {
        debugLog(`speech ended, again: ${live}`)
        if (live) rec.start()
      })
      rec.start()
      return () => {
        live = false
        rec.abort()
      }
    }
    return undefined
  }, [on])
}
