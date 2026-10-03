// A hidden file picker for a video of the user's, opened from a source's list.
export function ClipInput(props: {
  attach: (el: HTMLInputElement | null) => void
  onFile: (file: File) => void
}) {
  return (
    <input
      ref={el => props.attach(el)}
      type="file"
      accept="video/*"
      hidden
      onChange={e => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file !== undefined) props.onFile(file)
      }}
    />
  )
}
