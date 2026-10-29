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

A chroma keyer replaces every pixel of the key colour with a fill picture. With
**fill** set to **loop bus**, the keyer takes the fill from the frame store,
which holds the keyer's output from a few frames earlier, with the subject where
it stood then. Each frame the store records already contains the copies from
earlier recordings, so anything that moves in front of the green screen leaves a
trail of copies.

**Strobe hold** sets how many frames the frame store skips between recordings.
With strobe hold at 5, each copy is six frames behind the one before it, so the
copies stay distinct. The sandwich in this clip turns about its centre, so the
copies form a disc around it.

The copies flash between complementary colours because NTSC encodes hue as the
phase of a colour subcarrier, and that phase inverts on each frame. The frame
store records the composite signal, subcarrier included. On every other frame,
the TV decodes a stored copy against the opposite phase, which turns each hue in
it to its complement, such as gold to pale blue. The live subject keeps its
colours, because the TV decodes it against the phase it was encoded with.

Two variations:

- [The fan](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbDelayUs:0,bKeyFill:2)
  turns strobe hold off, and the copies blur together.
- [The keyhole](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:-1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6)
  inverts the key and cuts out the sandwich.

Claude Code found these settings by driving the app from a script. The new
**agent** button in the sidebar opens a prompt to paste into your own agent, so
that it can drive the app the same way.

_Footage from Wikimedia Commons:
[HD video of a Chicken fillet roll](https://commons.wikimedia.org/wiki/File:HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm)
by Alan Butler, under CC0._
