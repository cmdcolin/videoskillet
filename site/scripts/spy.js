// Two things no media query can express: a <details> that starts open only
// where it is the gutter nav, and highlighting the section being read.
;(function () {
  var toc = document.querySelector('details.toc')
  if (toc && matchMedia('(min-width: 68rem)').matches) toc.open = true

  var pages = document.querySelector('.pages')
  var on = pages && pages.querySelector('a.on')
  if (pages && pages.scrollWidth > pages.clientWidth) {
    // Only when the current page is off the end. Centring it unconditionally
    // scrolled a desktop row that overflowed by 30px far enough to cut
    // "Getting started" down to "rted".
    var row = pages.getBoundingClientRect()
    var here = on && on.getBoundingClientRect()
    if (here && (here.left < row.left || here.right > row.right)) {
      on.scrollIntoView({ inline: 'center', block: 'nearest' })
    }
    var ends = function () {
      var left = pages.scrollLeft
      var right = pages.scrollWidth - pages.clientWidth - left
      pages.classList.toggle('more-left', left > 1)
      pages.classList.toggle('more-right', right > 1)
    }
    pages.addEventListener('scroll', ends, { passive: true })
    ends()
  }

  // Mark the section being read. "The last heading that has passed the top of
  // the window" rather than "the heading currently on screen": the second one
  // has nothing to say once the last section is shorter than the viewport,
  // which is where every page ends.
  var pairs = []
  ;[].slice.call(document.querySelectorAll('.toc a')).forEach(function (a) {
    var h = document.getElementById(a.hash.slice(1))
    if (h) pairs.push({ a: a, h: h })
  })
  if (pairs.length === 0) return

  var at = -1
  var queued = false
  function spy() {
    queued = false
    var i = 0
    for (var n = 0; n < pairs.length; n++) {
      if (pairs[n].h.getBoundingClientRect().top - 96 <= 0) i = n
      else break
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
      i = pairs.length - 1
    }
    if (i === at) return
    if (at >= 0) pairs[at].a.classList.remove('here')
    pairs[i].a.classList.add('here')
    at = i
    // Keep the mark visible when the list is longer than its own column.
    if (toc && toc.scrollHeight > toc.clientHeight + 1) {
      toc.scrollTop = pairs[i].a.offsetTop - toc.clientHeight / 2
    }
  }

  addEventListener(
    'scroll',
    function () {
      if (queued) return
      queued = true
      requestAnimationFrame(spy)
    },
    { passive: true },
  )
  spy()
})()
