import { useEffect, useRef, useState } from 'react'

import { usePersistedString } from '../ui/storage'

export type Facing = 'user' | 'environment'
export type CameraState = 'off' | 'starting' | 'on' | 'error'

const FACING_STORE = 'videoskillet_cam_facing'

const opposite = (f: Facing): Facing => (f === 'user' ? 'environment' : 'user')

const say = (e: unknown): string => {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError')
      return 'Camera access was turned down. Allow it in the browser’s site settings and try again.'
    if (e.name === 'NotFoundError') return 'No camera was found.'
    if (e.name === 'NotReadableError')
      return 'The camera is in use by another app.'
  }
  return e instanceof Error ? e.message : String(e)
}

// The next camera after `current` in the device list, for a machine whose
// cameras do not say which way they face: a desktop with a webcam and a
// capture dongle, where facingMode picks the same device every time.
async function nextDevice(current: string): Promise<string | null> {
  const ids = (await navigator.mediaDevices.enumerateDevices())
    .filter(d => d.kind === 'videoinput')
    .map(d => d.deviceId)
  if (ids.length < 2) return null
  return ids[(ids.indexOf(current) + 1) % ids.length]
}

export const stopAll = (stream: MediaStream | null) => {
  for (const t of stream?.getTracks() ?? []) t.stop()
}

// A camera still delivering. A phone that cannot run two cameras at once may
// mute the first when a page asks for the second, rather than refusing.
const delivering = (stream: MediaStream) =>
  stream.getVideoTracks().every(t => t.readyState === 'live' && !t.muted)

// How long a second camera is given to take the first one down.
const SETTLE_MS = 600

export interface Opened {
  stream: MediaStream
  video: HTMLVideoElement
  faces: Facing
  cameras: number
}

// The camera that is not `settings`, asked for while that one stays open, or
// null when the phone refuses it. A camera that says which way it faces is
// asked for the other way; one that does not is asked for by the next device.
async function askOther(
  settings: MediaTrackSettings,
  facing: Facing,
): Promise<Opened | null> {
  try {
    if (settings.facingMode !== undefined && settings.facingMode !== '')
      return await openCamera(opposite(facing))
    const next = await nextDevice(settings.deviceId ?? '')
    return next === null ? null : await openCamera(facing, next)
  } catch {
    return null
  }
}

// One camera, playing in a <video> the engine can read from. Which way it
// faces comes from the track, since `ideal` lets the browser hand over another
// camera when the asked-for one is missing.
async function openCamera(want: Facing, deviceId?: string): Promise<Opened> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video:
      deviceId === undefined
        ? { facingMode: { ideal: want } }
        : { deviceId: { exact: deviceId } },
  })
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()
  const settings = stream.getVideoTracks()[0]?.getSettings() ?? {}
  // Labels and the full list arrive only after a grant.
  const devices = await navigator.mediaDevices.enumerateDevices()
  return {
    stream,
    video,
    faces: settings.facingMode === 'environment' ? 'environment' : 'user',
    cameras: devices.filter(d => d.kind === 'videoinput').length,
  }
}

// The phone's camera, front or back, handed to `show` as a playing <video>.
//
// A camera that faces the person holding the phone is shown as a mirror, which
// is what every camera app does and what makes framing yourself possible. One
// that says nothing about which way it faces is taken to be a webcam, which
// faces its user too.
export function useCamera(
  show: (video: HTMLVideoElement, mirror: boolean) => void,
) {
  const [stored, setStored] = usePersistedString(FACING_STORE)
  const facing: Facing = stored === 'environment' ? 'environment' : 'user'
  const [state, setState] = useState<CameraState>('off')
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState(0)
  const stream = useRef<MediaStream | null>(null)
  const held = useRef<Opened | null>(null)
  // Which open is the latest. A flip pressed twice quickly must not land on the
  // first answer after the second was asked for.
  const ask = useRef(0)

  const take = (opened: Opened) => {
    const got = opened.stream
    stream.current = got
    held.current = opened
    // Another app taking the camera, or the phone ending it in the background,
    // leaves the last frame standing unless something says so.
    got.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (stream.current === got) setState('off')
    })
    show(opened.video, opened.faces === 'user')
    setStored(opened.faces)
    setCameras(opened.cameras)
    setState('on')
  }

  const open = async (want: Facing, deviceId?: string) => {
    const mine = ++ask.current
    setState('starting')
    setError('')
    // Most phones cannot hold both cameras open at once, so the one on screen
    // has to go before the other can be asked for.
    stopAll(stream.current)
    stream.current = null
    held.current = null
    let opened: Opened
    try {
      opened = await openCamera(want, deviceId)
    } catch (e) {
      if (mine === ask.current) {
        setState('error')
        setError(say(e))
      }
      return
    }
    if (mine !== ask.current) {
      stopAll(opened.stream)
      return
    }
    take(opened)
  }

  // Puts `next` on screen and hands back the camera that was there, still
  // running, for the caller to keep or stop.
  const adopt = (next: Opened): Opened | null => {
    ++ask.current
    const prev = held.current
    take(next)
    return prev
  }

  // The other camera, opened beside the one on screen, or null where the phone
  // cannot run both. A refusal is the plain answer; a phone that mutes or ends
  // the first camera instead gets it back, reopened.
  const openOther = async (): Promise<Opened | null> => {
    const cur = held.current
    if (cur === null) return null
    const mine = ++ask.current
    const settings = cur.stream.getVideoTracks()[0]?.getSettings() ?? {}
    const other = await askOther(settings, facing)
    await new Promise(r => setTimeout(r, SETTLE_MS))
    const same =
      other?.stream.getVideoTracks()[0]?.getSettings().deviceId ===
      settings.deviceId
    if (
      other !== null &&
      mine === ask.current &&
      !same &&
      delivering(cur.stream) &&
      delivering(other.stream)
    )
      return other
    stopAll(other?.stream ?? null)
    if (mine === ask.current && !delivering(cur.stream)) await open(facing)
    return null
  }

  const start = () => void open(facing)

  const flip = async () => {
    const track = stream.current?.getVideoTracks()[0]
    const settings = track?.getSettings() ?? {}
    if (settings.facingMode !== undefined && settings.facingMode !== '') {
      await open(opposite(facing))
      return
    }
    const next = await nextDevice(settings.deviceId ?? '')
    if (next !== null) await open(facing, next)
  }

  // When the browser already has permission, the camera opens on arrival, so
  // a second visit does not stop at the button pressed last time.
  useEffect(() => {
    let live = true
    navigator.permissions
      .query({ name: 'camera' })
      .then(status => {
        if (live && status.state === 'granted') void open(facing)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // Once, on arrival.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  // A phone ends the camera when the page goes to the background, and nothing
  // brings it back by itself.
  useEffect(() => {
    const onVisible = () => {
      const track = stream.current?.getVideoTracks()[0]
      if (
        document.visibilityState === 'visible' &&
        track !== undefined &&
        track.readyState === 'ended'
      )
        void open(facing)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  })

  return {
    state,
    error,
    facing,
    canFlip: cameras > 1,
    start,
    flip: () => void flip(),
    adopt,
    openOther,
  }
}
