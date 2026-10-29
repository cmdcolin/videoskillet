---
title: Chroma keying with ghosts
date: 2026-10-28
draft: false
summary:
  The chroma keyer can fill the hole it cuts with the previous frame, so a
  turning sandwich sweeps out a disc of copies of itself that flash gold and
  blue. A new agent button explains how to connect your own agent.
image: /blog/keyer-sandwich.webp
imageAlt:
  A chicken fillet roll keyed over colour bars, with a pale blue disc of copies
  of itself spread out behind it.
look: '#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbHold:5,bKeyFill:2'
---

A chicken fillet roll turns on a green screen. The mixer's chroma keyer cuts
the green out, and its **fill** setting puts the mixer's frame store in the
hole. The frame store holds the previous output frame, so the roll leaves a copy
of itself wherever it has been. With **strobe hold** at 5, the store records
every sixth frame, and the copies sweep out a disc.

![Six seconds of the turning roll over colour bars. Its disc of copies flashes between gold and pale blue, and the colour bars behind it flash with it.](https://myloveydove.com/videoskillet/blog/keyer-sandwich-anim.webp)

## Why the copies flash gold and blue

NTSC's colour subcarrier inverts its phase on every frame. The frame store keeps
the phase each copy was recorded with. On alternate frames the set decodes the
copies against the opposite phase, so they come back in the complementary
colour. The colour bars behind the roll are in the frame store too, and they
flash with the copies.

## Variations

- Without strobe hold, the copies blur into a
  [fan](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbDelayUs:0,bKeyFill:2).
- With the key inverted, the keyer keeps the backing and cuts out the roll:
  [the keyhole](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:-1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6).
- To put your own picture behind the copies, load it as source A, set **fill**
  to **program A**, then **freeze**, then back to **loop bus**. Freeze grabs the
  frame on screen, and the frame store keeps it behind every copy that follows.

## How an agent found this

Claude Code found this look with a person steering. It launched Firefox from a
script, opened the app, and set controls by calling the engine in the page with
`window.vf.applyControls`. Then it took a screenshot of the picture, looked at
it, and adjusted, many times over.

The new **agent** button at the top of the sidebar explains how to connect your
own agent the same way. It also copies a prompt that hands the agent the look on
screen.

_Footage from Wikimedia Commons:
[HD video of a Chicken fillet roll](https://commons.wikimedia.org/wiki/File:HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm)
by Alan Butler, under CC0._
