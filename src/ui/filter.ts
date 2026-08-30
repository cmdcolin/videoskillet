import { createContext, use } from 'react'

import type { Group, SliderDef } from './controls'

// What the panel is being asked for. Two fields because they are two questions:
// free text asks "what is this called, or what does it do", and the motion mode
// asks "what is the bay driving". They narrow together — moving rows whose prose
// says "ghost" is askable — where the single string this used to be made them
// alternatives, spelled the mode as a token nobody can type, and left the ✕
// unable to tell a mode from a search.
export interface Filter {
  // Lowercased and trimmed; '' for none.
  text: string
  // Narrowed to what the bay is driving.
  moving: boolean
}

export const NO_FILTER: Filter = { text: '', moving: false }

// Whether anything is narrowing the panel at all. The panel keys a lot off this
// — the box stays open, the presets and the catalog stand down, the map expands
// — and every one of those questions is about the filter as a whole rather than
// about the text in it.
export const filterActive = (f: Filter) => f.text !== '' || f.moving

// The live filter, read from the tree: it reaches rows, groups and the sections
// holding them, and threading it by hand left Favorites filtering nothing while
// everything else filtered.
export const FilterContext = createContext<Filter>(NO_FILTER)

export const useFilter = () => use(FilterContext)

// What the box and the toggle read as together — two fields, and nothing typed
// into the box can reach the second one.
//
// A bare `∿` in the text used to mean the mode, so a pasted glyph or a note
// could carry it. That went with the glyph: nothing in the panel wears ∿ as a
// state any more (the row's badge says `mod`, the strip's count says `N mod`),
// so a mark meaning "modulated" would have been a key to a legend that no
// longer exists. "moving", "modulated", "motion" and "lfo" mean themselves here
// for the same reason they always have — typing "lfo" has to find the help text
// explaining what an LFO does. The strip's count and the palette's "show what is
// moving" are the mode, and both are buttons.
export const readFilter = (raw: string, moving: boolean): Filter => ({
  text: raw.trim().toLowerCase(),
  moving,
})

// Whether a control is driven by the bay. Passed in rather than read from a
// context here: this module is pure, and the bay lives in a context of its own
// precisely so a slider drag doesn't rebuild its consumers.
export type IsRouted = (key: SliderDef['key']) => boolean

const NONE_ROUTED: IsRouted = () => false

// Match help text too, not just labels: users hunt by artifact ("rainbow",
// "ghost", "comb"), and the mechanism prose is where those words live.
const textMatches = (s: SliderDef, text: string) =>
  s.label.toLowerCase().includes(text) || s.help.toLowerCase().includes(text)

// Both halves narrow, and either can be the only one asked. A routing never
// touches the resting value, so a driven row is indistinguishable from an
// untouched one by every other signal the panel has — which left "show me what
// is wobbling" unaskable while the bay could hold eight of them, scattered
// across six stages.
export const sliderMatches = (s: SliderDef, f: Filter, routed = false) =>
  (!f.moving || routed) && (f.text === '' || textMatches(s, f.text))

// The rows a group has to show. A name hit takes the whole group, as a heading
// always has — except under the motion mode, where taking a stage whole would
// bury the two rows that are actually moving in the sixteen that are not.
export const matchedSliders = (
  group: Group,
  f: Filter,
  isRouted: IsRouted = NONE_ROUTED,
): SliderDef[] =>
  !filterActive(f)
    ? group.sliders
    : !f.moving && group.name.toLowerCase().includes(f.text)
      ? group.sliders
      : group.sliders.filter(s => sliderMatches(s, f, isRouted(s.key)))

// Whether a group has anything to show — the same rule its rows are picked by,
// as data, so a stage drops off the spine without building its sections first
// and the two can never disagree about what a filter means.
export const groupMatches = (
  group: Group,
  f: Filter,
  isRouted: IsRouted = NONE_ROUTED,
) => matchedSliders(group, f, isRouted).length > 0

// Whether a box wired to nothing survives. Name, blurb or one of the words it
// declares, which is the same rule a slider follows (label or help) — so
// "matches the prose too" means one thing across the whole panel.
//
// It takes the shape rather than a FreeStage so this module stays the pure one:
// panelChain imports from here, and the box that owns the type lives there.
//
// **Keywords are how a box opts into being searchable at all**, and the absence
// of them is a positive answer rather than an empty list. The two free boxes are
// not the same kind of thing under a query:
//
// Everything the DECK draws is a real row borrowed from the stage that owns it —
// the wipe is Mix's, the tracking is Tape's — so those rows are already in the
// results under their own names, and a box that matched on its contents would
// print them a second time. Its blurb names all of them ("the transition lever
// and its wipe patterns… the tracking knob"), so it would match "wipe" and
// "tracking" and be a duplicate exactly when it matched. It declares nothing and
// stays out of every query, which is what it did before this function existed.
//
// The bay's own rows — the gate, its rate, the tempo, the split against a held
// look — are borrowed from nowhere, live in no group and are in no palette pool.
// Dropping that box under a query is the one case where the filter hides
// controls that have no other home, which is exactly what it used to do.
export const freeMatches = (
  box: { name: string; blurb: string; keywords?: readonly string[] },
  f: Filter,
) => {
  // The motion mode is left to the rows it was built for. It answers "show me
  // what is wobbling", and the whole bay dropped on top of that answer would
  // bury the two rows that are actually moving under the surface that lists
  // them — the same reason matchedSliders refuses to take a group whole for it.
  if (box.keywords === undefined || f.moving) return false
  return (
    box.name.toLowerCase().includes(f.text) ||
    box.blurb.toLowerCase().includes(f.text) ||
    box.keywords.some(k => k.includes(f.text))
  )
}
