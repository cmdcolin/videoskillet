---
title: Tube camera lag, vertical foldover and phosphor burn-in
date: 2026-10-11
summary:
  The feedback camera gets a pickup tube that drags comet tails, the vertical
  stage can fold the picture over itself, and the phosphor now wears out.
image: /blog/comet-tails.webp
imageAlt:
  Two cartoon skeletons dancing, each white bone dragging an orange trail.
look: '#preset=cometTails&src=clip-haunted-house'
---

Version 2.16 adds lag to the feedback camera's tube, foldover to the vertical
deflection and burn-in to the phosphor. Each fault happens in the part of the
set that causes it.

## Comet tails

The feedback camera now has a pickup tube between its lens and its sensor. A
tube camera reads its picture off a charged target with a scanning beam, and the
beam never quite clears the target in one field. Dark detail smears behind
anything that moves. A highlight charges the target past what the beam can
drain, so every bright point drags a trail that holds its brightness and then
collapses. The red tube lags most, so the trails run orange.

On the feedback loop, each lap photographs the trails the last lap left, so the
trails feed themselves. Try
[comet tails](/app/#preset=cometTails&src=clip-haunted-house) on the
haunted-house cartoon, where the white bones drag the longest trails. The
[night tube](/app/#preset=nightTube&src=clip-haunted-house) preset runs the same
camera with beam cutoff crushing the shadows to black.

## Foldover

![A cartoon skeleton stretched down the screen, with a brighter band near the bottom where the folded lines overlap the picture.](/blog/foldover.webp)

The vertical output stage can now fail. Its ramp curves, which squeezes the top
of the picture and stretches the bottom. Past the middle of the frame the stage
saturates. The sweep stops, the yoke pulls the beam back up, and the beam draws
the rest of the frame upside down over the top half. Every line in the knee
lands on the same row, so that row glows white.

The fault is in the deflection, so the picture folds and its colours stay where
they are. The [foldover](/app/#preset=foldover&src=clip-haunted-house) preset
moves the fold with two modulators, so the knee wanders up and down the screen.

## Burn-in

![Two cartoon skeletons with the deck's PLAY display over them, etching into the phosphor.](/blog/burned-in.webp)

The phosphor now wears with the beam current that hits it. The blue phosphor
wears fastest, so a bright image held in one place etches into the glass as a
dark yellow-brown ghost. The
[burned in](/app/#preset=burnedIn&src=clip-haunted-house) preset runs the wear
at years per second under the deck's on-screen display, and within a few seconds
the word PLAY is etched into the screen. The ghost stays when you change the
source or pick another preset, and setting burn-in depth to 0 wipes it.
