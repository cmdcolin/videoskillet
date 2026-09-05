// The play button on a clip: start it, take the cover away, and put the cover
// back over the last frame when it ends so the button reads as replay.
//
// Delegated, because the frames come out of the markdown pipeline
// (site/lib/rehype-guide.mjs) and there is no list of them to bind to. Written
// in the same ES5 the rest of the inlined scripts here are: they are inlined
// into the page rather than bundled, so nothing transpiles them.
;(function () {
  document.addEventListener('click', function (e) {
    var button = e.target.closest && e.target.closest('.videoplay')
    if (!button) return
    var frame = button.closest('.videoframe')
    var video = frame && frame.querySelector('video')
    if (!video) return
    frame.classList.add('playing')
    var started = video.play()
    // Autoplay policy refuses a muted clip almost nowhere, but a refusal that
    // left the cover down would be a picture with no way back to the button.
    if (started && started.catch) {
      started.catch(function () {
        frame.classList.remove('playing')
      })
    }
  })

  // Media events do not bubble, so these listen on the way down instead.
  document.addEventListener(
    'play',
    function (e) {
      var frame = e.target.closest && e.target.closest('.videoframe')
      if (frame) frame.classList.add('playing')
    },
    true,
  )

  document.addEventListener(
    'ended',
    function (e) {
      var frame = e.target.closest && e.target.closest('.videoframe')
      if (!frame) return
      frame.classList.remove('playing')
      var button = frame.querySelector('.videoplay')
      if (button) button.setAttribute('aria-label', 'Play again')
    },
    true,
  )

  // Pausing is not ending: the reader stopped to look at a frame, and dropping
  // the cover over it would hide the thing they paused to see. The button comes
  // back only when the clip runs out.
})()
