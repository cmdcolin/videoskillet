---
title: A paperclip held against a point inside the set
date: 2026-08-19
summary:
  You pick a circuit inside the receiver and short it a few times a second, and
  the picture breaks the way that circuit breaks.
image: /blog/paperclip-sync.webp
imageAlt:
  A cartoon skeleton scene torn diagonally across the screen, with a black wedge
  where the lines start late.
look: '#set=clipHz:4,clipPoint:0,clipBite:0.9,clipDwellMs:250&src=clip-haunted-house'
---

Version 0.28.9 added the paperclip. It models bare metal that somebody holds
against a pin inside the set, several times a second, at a point they choose.
Five contact points are on offer: the sync separator, the vertical oscillator,
the EHT supply, the chroma demodulator and the video output stage. Each one
shorts controls in a single domain, so the five read as five different faults.

## The sync separator

A contact on the sync separator takes away the set's idea of where each line
starts. The picture tears sideways, and because the colour burst sits on the
same line, the hue goes with it. Open the
[sync separator contact](/app/#set=clipHz:4,clipPoint:0,clipBite:0.9,clipDwellMs:250&src=clip-haunted-house)
on the haunted-house cartoon to see it.

The recovery belongs to the receiver. A pin against stray capacitance settles in
microseconds, three orders of magnitude under a frame, so the clip itself leaves
no tail. What takes time is the flywheel hauling itself back onto sync and the
level loop finding the sync tip again. A bite takes two or three frames to show
and five or six to clear, whatever the dwell is set to.

## The chroma demodulator

![A calico cat in a station master's cap, with the orange patches on its fur turned yellow-green while the red chair stays red.](/blog/paperclip-chroma.webp)

A contact on the chroma demodulator shorts its reference network. While the
metal is down, the set stops trusting the burst and its two demodulators stop
sitting 90° apart. Hue shears instead of rotating, so some colours come through
the bite and their opposites do not. In the still above, the cat's orange fur
has gone yellow-green and the chair has kept its red. The
[paperclip on the chroma](/app/#preset=paperclipChroma&src=cat) preset makes
three contacts a second.

## Random timing

Contacts arrive with exponentially distributed gaps. Two land together, and then
nothing happens for a second. A strobe gate on a clock makes the same shape at a
steady rate, and the difference is visible straight away. The chatter control
lifts the contact clean off for an instant, the way a scraping clip does.

![A feedback loop collapsing into a bright magenta and green bloom in the middle of the screen, with dark trails radiating outward.](/blog/paperclip-chassis.webp)

On a feedback loop, the loop keeps what each contact made for several seconds
after the hand has moved on. The
[hand on the chassis](/app/#preset=handOnTheChassis&src=clip-haunted-house)
preset holds the clip on the chroma demodulator about once a second over a loop
that otherwise collapses cleanly, so each bite leaves colour that the loop
carries inward.
