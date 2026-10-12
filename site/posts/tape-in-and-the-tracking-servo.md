---
title: Tape in, and a tracking servo that hunts
date: 2026-10-05
summary:
  The deck draws PLAY on its output, and pressing it knocks an auto-tracking
  servo off the track so you watch it hunt for the peak.
image: /demos/tape-in.webp
imageAlt:
  Colour bars with the word PLAY and a play arrow in the top left, and a band of
  noise across the lower part of the bars.
look: '#preset=tapeIn&src=clip-haunted-house'
---

Version 2.15.0 gave the deck an on-screen display, and the
[tape in](/app/#preset=tapeIn&src=clip-haunted-house) preset uses it to play the
moment a cassette goes in. The deck outputs its blue background for a second and
a half with PLAY drawn on it. Then the picture arrives with a band of noise
sweeping through it while the tracking settles.

## The tracking servo

![Two cartoon skeletons with a bright band of coloured noise across the screen at the height of their chests.](/blog/servo-hunt.webp)

The noise band comes from the auto-tracking servo, which arrived in version
0.30.2. The servo is a second-order loop with a dead band. It reads the RF
envelope off the heads and steps the tracking until the envelope peaks. The
servo hunt control takes its damping down, so each correction overshoots and
rings. The band nearly vanishes when the loop is at rest and comes back on every
sweep.

Anything that unseats the tape kicks the loop. A shuttle speed change, the
loop's splice going past, a transition cut, a change of source and a hit in the
music all shove it off the peak, and the top of the frame flags on the tension
each time. The [servo hunt](/app/#preset=servoHunt&src=clip-haunted-house)
preset draws nothing on the picture. The band comes from the servo loop running
with too little damping.

## The display

The display is a pass after the timebase that draws PLAY, PAUSE, SLOW, FF or REW
with a transport symbol into the deck's output. The deck adds the letters after
the tape, so wobble and tracking bars leave them alone, and the set still locks
to them and decodes them with the rest of the line. The blue background has
colour, so the pass measures each line's burst and writes the blue at that
phase. Switching the display on is the PLAY button going down, which is also a
kick to the tracking servo.
