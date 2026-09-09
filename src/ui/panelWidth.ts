// How wide the sidebar is allowed to be, as arithmetic — the component that
// drags it is PanelResizer.tsx.
//
// Its own module for the reason `miniFrame.ts` and `lens.ts` are: the numbers
// are shared with app.tsx (which gates the bench on one of them) and with the
// shell's own stylesheet, and a constant exported beside a component costs the
// component its fast refresh.

// The panel's starting width, and the floor a drag stops at. 300 is where a
// slider's label and its value stop sharing a line (app.module.css .panel), so
// below it every row in the sidebar grows a second line.
export const PANEL_W = 332
export const MIN_PANEL_W = 300

// What the picture keeps whatever the rail is dragged to. A 4:3 stage at 320px
// is still a picture; past that the drag would be shutting the app's subject
// rather than widening its controls.
const KEEP_PICTURE = 320

// Where the bench's two columns become possible: the same 540 the panel's own
// container queries pair off at (ChainMap.module.css, SignalPath.module.css).
// It is the panel that has to be wide enough, which is a different question
// from the one the viewport used to be asked — and on a screen too small for
// the old gate, dragging the rail is now the answer to it.
export const BENCH_W = 540

// A width the drag can actually land on, given the window it is happening in.
// The CSS clamps too, at 70vw, so a width stored on a wide display cannot eat
// the picture when the same profile opens on a laptop; this is the same rule
// said in the units the gesture has in hand.
//
// The floor wins a narrow window outright: on a screen with less than
// MIN_PANEL_W + KEEP_PICTURE to give, something has to overflow, and a sidebar whose
// every label wraps is worse than a picture a few pixels short of its share.
export const panelWidthIn = (want: number, viewport: number): number =>
  Math.round(Math.max(MIN_PANEL_W, Math.min(want, viewport - KEEP_PICTURE)))
