import { useState, useSyncExternalStore } from 'react'

import { cx } from './cx'
import { DRIFT_SECONDS } from './drift'
import styles from './LookBar.module.css'
import { MORPH_LABELS, MORPH_SECONDS } from './morph'
import { mutateAmountFor } from './mutate'
import { MenuItem, Popover } from './Popover'

import type { MorphSeconds, MorphStore } from './morph'
import type { MutateAmount } from './mutate'
import type { ReactNode } from 'react'

// The verbs that act on the whole look, in one row under the masthead.
//
// They used to sit at the foot of Presets, where they were the last 58px of the
// section that already took a quarter of the sidebar — and none of them is a
// preset. Compare previews the stock signal, the two random rolls move the
// board wherever it happens to be, undo walks the history: all of them apply
// just as much to a look built slider by slider as to one picked off a chip.
//
// Chrome, not controls, so they wear the quiet outline the masthead icons and
// the catalog handle wear rather than the filled look of the preset chips and
// the control rows. That is the distinction the row is drawing: these do things
// to the board, the buttons below it are the board.
//
// "copy link" used to be the widest of them, and it was a button for something
// the address bar was already doing: useUrlState mirrors the live look into the
// query string every time it changes, so the URL is always the link and copying
// it is the browser's own gesture. It survives in the ⌘K palette for anyone who
// wants one keystroke for it. Losing it is what lets the row carry the panel's
// ordinary type size and still hold all five verbs — including redo, which
// never fit before at either size.
export function LookBar(props: {
  comparing: boolean
  onStartCompare: () => void
  onEndCompare: () => void
  onSurprise: () => void
  onMutate: (amount: MutateAmount) => void
  // The third roll, and the only one that leaves every resting value alone: it
  // re-cables the modulation bay. It belongs in this segmented set rather than
  // in the bay's own stage — which is a box on the map, shut until you press it
  // — because it is the same gesture as the two beside it and gets pressed the
  // same way, repeatedly, while looking at the picture.
  onRollMotion: (amount: MutateAmount) => void
  // The three rolls that did not earn a word in the row. Each is a different
  // *shape* of random rather than a different amount of the ones above — see
  // the menu at the foot of this file for what each is for — and they are
  // behind the set's `⋯` because the row has no width left for a fourth word
  // and the segmented three are the ones a session reaches for by reflex.
  onSurpriseOne: () => void
  onSpike: (amount: MutateAmount) => void
  onCross: () => void
  // The nudge with nobody pressing it (ui/drift.ts). Outside the segmented set
  // rather than a fourth member of it, because it is not another roll: each of
  // the three in the set answers one press, and this is a mode the board stays
  // in until you say otherwise. It says which of its two states it is in in
  // words for the same reason — a switch whose only tell is a lit border is one
  // you have to press to find out about.
  drifting: boolean
  onToggleDrift: () => void
  // How long the verbs in this row take to arrive, and the button that cycles
  // it. It belongs here rather than in a settings dialog because it changes what
  // every other button in the row *does*, and because the duration you want is a
  // function of what you are doing right now: a cut while dialing a look in, a
  // long morph while performing one.
  morphSeconds: MorphSeconds
  onSetMorph: (seconds: MorphSeconds) => void
  // A morph's progress, as a store rather than a value: it changes every frame,
  // and a prop would mean App re-rendering the whole panel at that rate to carry
  // it down here. Subscribed to by the one button that draws it.
  morphStore: MorphStore
  onStopMorph: () => void
  // The tags menu, passed in rather than built here: it owns a popover, and this
  // row's job is to seat it among the other whole-board verbs. It goes after the
  // two that produce a look worth describing — roll something up with the
  // segmented pair, then tag it — and before the buttons that walk the history,
  // which stay the row's tail.
  tags: ReactNode
  // The whole board back to stock. Among the take-back verbs rather than beside
  // `compare` — which is the other button in this row about the clean signal —
  // because what it has in common with undo is what a hand reaching for it
  // wants: out of here. Compare is a look at stock with your finger down, and
  // seating a wipe next to a preview is how a held gesture becomes a lost look.
  onReset: () => void
  canUndo: boolean
  onUndo: () => void
  canRedo: boolean
  onRedo: () => void
}) {
  return (
    <div className={styles.bar}>
      {/* Held, not clicked, so it stays a gesture: press and the picture goes
          to stock, release and it comes back. The label says which state you
          are in, since the button is under your finger while it happens. */}
      <button
        className={cx(styles.btn, props.comparing && styles.btnOn)}
        onPointerDown={props.onStartCompare}
        onPointerUp={props.onEndCompare}
        onPointerLeave={props.onEndCompare}
        title="hold to preview the clean signal, release to return (or hold C)"
      >
        {props.comparing ? 'showing clean…' : 'compare'}
      </button>
      <Rolls
        onSurprise={props.onSurprise}
        onMutate={props.onMutate}
        onRollMotion={props.onRollMotion}
        onSurpriseOne={props.onSurpriseOne}
        onSpike={props.onSpike}
        onCross={props.onCross}
      />
      {/* Next to the rolls, because that is what it is: the gentlest of them,
          on a timer, forever. Nothing else in the app plays itself. */}
      <button
        className={cx(styles.btn, props.drifting && styles.btnOn)}
        onClick={props.onToggleDrift}
        title={
          props.drifting
            ? 'stop here and keep the look wherever it has got to. One ctrl+z then puts back the look you set drifting — none of the legs is in the walk (d)'
            : `let the look wander with nobody at the keyboard: every ${DRIFT_SECONDS} seconds it nudges itself somewhere near where it stands and travels most of the way there, so the picture never cuts. It stays around the look you set drifting rather than wandering off, and one ctrl+z after you stop puts that look back (d)`
        }
      >
        {props.drifting ? 'drifting…' : 'drift'}
      </button>
      <MorphControl
        morphSeconds={props.morphSeconds}
        onSetMorph={props.onSetMorph}
        store={props.morphStore}
        onStop={props.onStopMorph}
      />
      {props.tags}
      <button
        className={styles.btn}
        onClick={props.onReset}
        title="put the whole board back to stock: every control, the modulation bay and the stab gate — the same as the “clean” chip. Your sources and where you are looking stay as they are, and ctrl+z takes the look back"
      >
        reset
      </button>
      <button
        className={cx(styles.btn, !props.canUndo && styles.btnOff)}
        onClick={props.onUndo}
        disabled={!props.canUndo}
        title="step back through the looks you have been through (ctrl+z). It arrives however morph says looks arrive, so at a long one the way back is a transition too"
      >
        undo
      </button>
      {/* Only once there is a walk to step forward into: a permanently greyed
          redo would cost a slot in the row on every session that never undid
          anything, and this row has one line to fit in. */}
      {props.canRedo ? (
        <button
          className={styles.btn}
          onClick={props.onRedo}
          title="step forward again (ctrl+shift+z)"
        >
          redo
        </button>
      ) : null}
    </div>
  )
}

// Every way this row has of handing you a look you did not ask for, behind one
// button.
//
// They were six: three words joined into a segmented set — `random look`,
// `random nudge`, `random motion` — and three more behind a `⋯` because the row
// had no width for a fourth. That spelled the word `random` three times across
// 190px of a 332px row, and it put the two that a session reaches for least in
// the place nothing is ever found. Worse than the width: six labels read as six
// things to understand before you are allowed to press one, when the honest
// summary is that every one of them hands you a look and they differ only in
// how much of yours they keep.
//
// So: press it and get a look. The caret is where that is chosen, and choosing
// rolls at once rather than arming something to press after — the menu is a way
// of rolling. What you chose stays on the face, so going again on one you like
// is the same single press it was when each had its own button.
//
// Ordered by how much of your look survives, which is the one axis they vary
// on: a fresh look, a preset drawn whole, this look crossed with a fresh one, a
// nudge to every control, two controls thrown hard, and the bay re-cabled with
// every slider left where it stands.
type RollName = 'look' | 'preset' | 'cross' | 'nudge' | 'fault' | 'motion'

const ROLL_ORDER: RollName[] = [
  'look',
  'preset',
  'cross',
  'nudge',
  'fault',
  'motion',
]

interface Roll {
  label: string
  icon: string
  title: string
  run: (amount: MutateAmount) => void
}

function Rolls(props: {
  onSurprise: () => void
  onMutate: (amount: MutateAmount) => void
  onRollMotion: (amount: MutateAmount) => void
  onSurpriseOne: () => void
  onSpike: (amount: MutateAmount) => void
  onCross: () => void
}) {
  const [held, setHeld] = useState<RollName>('look')
  // A record rather than a list the face searches, so the held name always
  // names a roll and there is no missing one to fall back from.
  const rolls: Record<RollName, Roll> = {
    look: {
      label: 'random look',
      icon: '✳',
      title:
        'a look you have not seen: a few random presets from different groups, stacked over stock — the preset chips light up to show what went in. This replaces the look you have; random nudge keeps it',
      run: () => props.onSurprise(),
    },
    preset: {
      label: 'random preset',
      icon: '◆',
      title:
        'one of the authored looks, whole and at full strength — no stacking and no jitter, so what you get is what somebody tuned. The chip lights up to say which',
      run: () => props.onSurpriseOne(),
    },
    cross: {
      label: 'random cross',
      icon: '⤫',
      title:
        'keep some circuits of this look — the tape, the tube, whichever way it falls — and let a fresh roll answer for the rest',
      run: () => props.onCross(),
    },
    nudge: {
      label: 'random nudge',
      icon: '≈',
      title:
        'keep this look and nudge every control randomly around where it sits, for a related variation (also happy accidents) — shift for a wilder roll, alt for a gentler one, ctrl (or cmd) for turbo, which throws most controls past anything a real set would do. A stage heading\u2019s own randomize nudges that stage alone',
      run: amount => props.onMutate(amount),
    },
    fault: {
      label: 'random fault',
      icon: '↯',
      title:
        'throw a couple of controls a long way and touch nothing else: one fault you can see, name and take back, on a look otherwise exactly as you left it',
      run: amount => props.onSpike(amount),
    },
    motion: {
      label: 'random motion',
      icon: '∿',
      title:
        'keep every slider where it is and re-cable what is moving them: a fresh patch of LFOs, drift and sample-and-hold onto controls this look is actually using. It replaces what is in the modulation bay, and undo puts it back — shift for more and deeper, alt for a single slow one, ctrl (or cmd) for turbo',
      run: amount => props.onRollMotion(amount),
    },
  }
  const face = rolls[held]
  const roll = (name: RollName, amount: MutateAmount) => {
    setHeld(name)
    rolls[name].run(amount)
  }
  return (
    <div className={styles.pair}>
      <button
        className={cx(styles.btn, styles.pairLeft)}
        onClick={e => roll(held, mutateAmountFor(e))}
        title={face.title}
      >
        {face.label}
      </button>
      <Popover
        trigger={attrs => (
          <button
            {...attrs}
            className={cx(styles.btn, styles.pairRight, styles.caret)}
            aria-label="pick a kind of roll"
            title="the other ways this row has of rolling you one. Picking one rolls it, and it stays on the button, so going again is one press"
          >
            ▾
          </button>
        )}
      >
        {id => (
          <>
            {ROLL_ORDER.map(name => (
              <MenuItem
                key={name}
                icon={rolls[name].icon}
                label={rolls[name].label}
                hint=""
                title={rolls[name].title}
                closes={id}
                onClick={() => roll(name, 'normal')}
              />
            ))}
          </>
        )}
      </Popover>
    </div>
  )
}

// The morph slot, which holds one of two things: the duration a look *will*
// take, or — while one is travelling — how far along it is and the way to stop
// it. One slot rather than two, because they are one widget read two ways and
// this row has no sixth place to give.
//
// The flight readout is worth drawing at all because a long morph is otherwise
// indistinguishable from an app that ignored you: at 30s the first second of a
// step back moves almost nothing, and undo is exactly the verb where "did that
// register?" is the question. The bar answers it, and pressing it answers "I
// liked it better half way" — which until now you could only say by grabbing a
// slider, that is, by changing the look you wanted to keep.
//
// This is the only component that subscribes to the morph, and that is the
// point: progress moves every frame, so anything holding it as state re-renders
// at the frame rate. Held here it costs one button per frame, for the seconds a
// morph lasts. Held in App — which builds the whole panel — it would cost ~200
// control rows per frame, which is why the engine publishes it as a store
// instead of the app threading it down as a prop.
function MorphControl(props: {
  morphSeconds: MorphSeconds
  onSetMorph: (seconds: MorphSeconds) => void
  store: MorphStore
  onStop: () => void
}) {
  const progress = useSyncExternalStore(props.store.subscribe, props.store.get)
  if (progress === null) {
    return (
      <MorphSelect
        morphSeconds={props.morphSeconds}
        onSetMorph={props.onSetMorph}
      />
    )
  }
  return (
    <button
      className={cx(styles.btn, styles.flight)}
      onClick={props.onStop}
      title={`travelling to the new look over ${props.morphSeconds}s — press to stop here and keep the half-way look, which is a look like any other. Grabbing any slider does the same`}
    >
      <span
        className={styles.flightFill}
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className={styles.flightLabel}>stop here</span>
    </button>
  )
}

// How long a look takes to arrive. Split out only so the row above reads as the
// five verbs it is rather than as four verbs and a select's worth of markup.
function MorphSelect(props: {
  morphSeconds: MorphSeconds
  onSetMorph: (seconds: MorphSeconds) => void
}) {
  return (
    <select
      className={cx(
        styles.btn,
        styles.morphSelect,
        props.morphSeconds > 0 && styles.btnOn,
      )}
      value={props.morphSeconds}
      onChange={e => {
        const picked = MORPH_SECONDS.find(s => String(s) === e.target.value)
        if (picked !== undefined) props.onSetMorph(picked)
      }}
      title={
        props.morphSeconds > 0
          ? `presets, both rolls and undo travel to the new look over ${props.morphSeconds}s instead of cutting to it — change it here. While one travels this button becomes the way to stop it. Rolling again mid-morph carries on from wherever the board has got to`
          : 'presets, rolls and undo land in one frame — pick a duration to make them travel there instead, which is where the looks between two presets live'
      }
    >
      {MORPH_SECONDS.map(s => (
        <option key={s} value={s}>{`morph: ${MORPH_LABELS[s]}`}</option>
      ))}
    </select>
  )
}
