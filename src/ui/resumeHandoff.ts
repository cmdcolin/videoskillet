// Which recent session a Resume press continues. The home page writes the
// session's id into sessionStorage as its link is followed, and the app takes it
// once on load, so the resumed session keeps its entry and any later load in the
// tab starts a new one. A link opened some other way carries no id, and its
// session is a new entry.
const RESUME_KEY = 'videoskillet.js_resume'

// sessionStorage throws where the browser has storage switched off, like
// localStorage does (storage.ts). A lost id costs one extra entry in the list.
export function handOffSession(id: string): void {
  try {
    sessionStorage.setItem(RESUME_KEY, id)
  } catch {}
}

export function takeSessionId(): string | null {
  try {
    const id = sessionStorage.getItem(RESUME_KEY)
    sessionStorage.removeItem(RESUME_KEY)
    return id
  } catch {
    return null
  }
}
