import { save } from '../ui/download'

// The last thing the shutter made, held until the next one replaces it.
export interface Shot {
  blob: Blob
  name: string
  url: string
  video: boolean
}

const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError'

// A phone saves to its photo library through the share sheet; anything without
// one downloads the file.
export async function deliver(shot: Shot) {
  const file = new File([shot.blob], shot.name, { type: shot.blob.type })
  if ('canShare' in navigator && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (e) {
      if (!isAbort(e)) save(shot.blob, shot.name)
    }
  } else {
    save(shot.blob, shot.name)
  }
}

// A link goes out through the share sheet, or onto the clipboard where there is
// none. Resolves to a word for the picture, or '' when the sheet was closed.
export async function shareLink(url: string, title: string): Promise<string> {
  if ('share' in navigator) {
    try {
      await navigator.share({ url, title })
      return ''
    } catch (e) {
      if (isAbort(e)) return ''
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'link copied'
  } catch {
    return 'could not copy the link'
  }
}
