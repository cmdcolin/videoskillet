// The route tabs, on a page that offers the reader more than one way in. The
// install section of the CLI page is the first of them. The row and the panels
// come out of the markdown pipeline (site/lib/rehype-guide.mjs), and this
// script switches between them.
//
// Written in the same ES5 the rest of the inlined scripts here are: they go into
// the page as they are, so nothing transpiles them.
;(function () {
  function panels(row) {
    return [].slice
      .call(row.querySelectorAll('[role="tab"]'))
      .map(function (tab) {
        return {
          tab: tab,
          panel: document.getElementById(tab.getAttribute('aria-controls')),
        }
      })
      .filter(function (pair) {
        return pair.panel
      })
  }

  function select(row, tab, focus) {
    panels(row).forEach(function (pair) {
      var on = pair.tab === tab
      pair.tab.setAttribute('aria-selected', on ? 'true' : 'false')
      pair.tab.tabIndex = on ? 0 : -1
      pair.panel.hidden = !on
    })
    if (focus) tab.focus()
  }

  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]')
    var row = tab && tab.closest('.tabbar')
    if (row) select(row, tab)
  })

  // The arrow keys move within the row and wrap around, and Home and End go to
  // its ends. The tab key leaves the row entirely, which is what the roving
  // tabindex in the markup is for.
  var STEP = { ArrowLeft: -1, ArrowRight: 1, Home: 'first', End: 'last' }

  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]')
    var row = tab && tab.closest('.tabbar')
    var step = STEP[e.key]
    if (!row || step === undefined) return
    e.preventDefault()
    var tabs = panels(row).map(function (pair) {
      return pair.tab
    })
    var at = tabs.indexOf(tab)
    var to =
      step === 'first'
        ? 0
        : step === 'last'
          ? tabs.length - 1
          : (at + step + tabs.length) % tabs.length
    select(row, tabs[to], true)
  })

  // A link to a panel's own id opens the tab that names it. That id is the
  // heading anchor the section had before it became a tab.
  function fromHash() {
    var panel = location.hash && document.querySelector(location.hash)
    if (!panel || panel.className.indexOf('tabpanel') < 0) return
    var tab = document.getElementById(panel.getAttribute('aria-labelledby'))
    var row = tab && tab.closest('.tabbar')
    if (row) select(row, tab)
  }

  addEventListener('hashchange', fromHash)
  fromHash()
})()
