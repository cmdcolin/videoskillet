---
title: Chroma keying with ghosts
date: 2026-10-28
draft: false
summary:
  The chroma keyer can fill the hole it cuts with its own earlier output, so
  anything that moves in front of the green screen leaves copies of itself.
image: https://myloveydove.com/videoskillet/blog/keyer-sandwich-turn.webp
imageAlt:
  A chicken fillet roll turning over colour bars. A disc of copies of the roll
  spreads out behind it and flashes between gold and pale blue.
look: '#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbHold:5,bKeyFill:2'
---

A chroma keyer replaces every pixel of the key colour with a fill. With the fill
patched to the loop bus, the fill is the frame store, which holds the keyer's
own output from a few frames earlier. Wherever the green screen shows, the
viewer sees an older picture, and that picture already shows the subject where
it stood then. Anything that moves in front of the screen leaves a trail of
copies of itself, and each copy contains the copies recorded before it.

**Strobe hold** sets how often the frame store records. At 5 it records every
sixth frame, so the copies land six frames apart and stay distinct. The sandwich
in this clip spins about its own centre, so its copies fan out into a disc.

The copies flash between complementary colours because of the NTSC colour
subcarrier:

- NTSC encodes hue as the phase of the subcarrier, and that phase inverts from
  one frame to the next.
- The frame store records the composite signal, subcarrier included.
- On every other frame, the TV decodes a stored copy against the opposite phase,
  and each hue in it turns to its complement. Gold becomes pale blue.

Two variations:

- [The fan](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbDelayUs:0,bKeyFill:2)
  turns strobe hold off, and the copies blur together.
- [The keyhole](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:-1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6)
  inverts the key and cuts out the sandwich.

Claude Code found this look by driving the app from a script. The new **agent**
button in the sidebar shows how to connect your own agent the same way.

_Footage from Wikimedia Commons:
[HD video of a Chicken fillet roll](https://commons.wikimedia.org/wiki/File:HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm)
by Alan Butler, under CC0._
