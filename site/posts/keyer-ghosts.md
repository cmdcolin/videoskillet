---
title: Chroma keying with ghosts
date: 2026-10-28
draft: false
summary:
  Claude Code drove the chroma keyer from a script and found a fireball that
  blooms in rainbow rings over the aurora, and a sandwich that sweeps out a disc
  of copies of itself. A new agent button explains how to connect your own
  agent.
image: /blog/keyer-rings.webp
imageAlt:
  An explosion keyed over a green aurora seen from orbit. The fireball is drawn
  as nested outlines in white, pink, blue, green and orange.
look: '#vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Earth_Illuminated-_ISS_Time-lapse_Photography.webm/Earth_Illuminated-_ISS_Time-lapse_Photography.webm.480p.vp9.webm&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/d/df/EXPLOSION_green_screen_%28no_copyright%29_-_the_chosen_one_%28720p%2C_h264%29.webm/EXPLOSION_green_screen_%28no_copyright%29_-_the_chosen_one_%28720p%2C_h264%29.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,cfbMix:0.95,cfbGain:0.98,cfbDelayUs:0.07,cfbLines:-3,cfbKey:1,cfbKeyLevel:60,cfbKeySoft:10,cfbTrail:0.3,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6&cuea=68,84'
---

Try it:
[rainbow rings](/app/#vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Earth_Illuminated-_ISS_Time-lapse_Photography.webm/Earth_Illuminated-_ISS_Time-lapse_Photography.webm.480p.vp9.webm&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/d/df/EXPLOSION_green_screen_%28no_copyright%29_-_the_chosen_one_%28720p%2C_h264%29.webm/EXPLOSION_green_screen_%28no_copyright%29_-_the_chosen_one_%28720p%2C_h264%29.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,cfbMix:0.95,cfbGain:0.98,cfbDelayUs:0.07,cfbLines:-3,cfbKey:1,cfbKeyLevel:60,cfbKeySoft:10,cfbTrail:0.3,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6&cuea=68,84).

An explosion shot on a green screen, keyed over a NASA time-lapse from the
International Space Station. The feedback loop keeps the bright parts of its own
return, so earlier outlines of the fireball stay on screen. The loop delay turns
the colour of each outline a quarter of the way round the colour wheel on every
pass.

![Six seconds of the explosion over the aurora. The fireball grows in rainbow rings, turns to orange flame and burns off, and the next one starts.](https://myloveydove.com/videoskillet/blog/keyer-rings-anim.webp)

## How an agent found these

Claude Code found these looks with a person steering. It launched Firefox from a
script, opened the app, and set controls by calling the engine in the page with
`window.vf.applyControls`. Then it took a screenshot of the picture, looked at
it, and adjusted, many times over.

The new **agent** button at the top of the sidebar explains how to connect your
own agent the same way. It also copies a prompt that hands the agent the look on
screen.

## The keyer

The mixer's chroma keyer cuts the green backing out of source B, and source A
shows through the hole:
[the fireball](/app/#vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Earth_Illuminated-_ISS_Time-lapse_Photography.webm/Earth_Illuminated-_ISS_Time-lapse_Photography.webm.480p.vp9.webm&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/d/df/EXPLOSION_green_screen_%28no_copyright%29_-_the_chosen_one_%28720p%2C_h264%29.webm/EXPLOSION_green_screen_%28no_copyright%29_-_the_chosen_one_%28720p%2C_h264%29.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6&cuea=68,84).

![An orange fireball keyed over the curve of the Earth, beside a solar panel of the space station.](/blog/keyer-fireball.webp)

## Ghosts from the frame store

The keyer's **fill** setting can also put the mixer's frame store in the hole.
The frame store holds the previous output frame, so a moving subject leaves
copies of itself wherever it has been. With **strobe hold** at 5, the store
records every sixth frame, and a turning sandwich sweeps out a disc:
[the disc](/app/#vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Earth_Illuminated-_ISS_Time-lapse_Photography.webm/Earth_Illuminated-_ISS_Time-lapse_Photography.webm.480p.vp9.webm&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbHold:5,bKeyFill:2&cuea=68,84).

![A chicken fillet roll turning over the space station's window, twice. On the left its copies form a gold disc behind it, and on the right the same disc is pale blue.](/blog/keyer-disc.webp)

The copies flash between gold and blue because NTSC's colour subcarrier inverts
its phase on every frame. The frame store keeps the phase each copy was recorded
with. On alternate frames the set decodes the copies against the opposite phase,
so they come back in the complementary colour.

![Six seconds of the turning roll. Its disc of copies flashes gold and blue over a green and magenta aurora.](https://myloveydove.com/videoskillet/blog/keyer-disc-anim.webp)

Without strobe hold, the copies blur into a fan:
[the fan](/app/#vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Earth_Illuminated-_ISS_Time-lapse_Photography.webm/Earth_Illuminated-_ISS_Time-lapse_Photography.webm.480p.vp9.webm&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbDelayUs:0,bKeyFill:2&cuea=68,84).

![The roll lying flat over the aurora, with a pale grey fan of copies trailing below it.](/blog/keyer-fan.webp)

The frame store records every frame while **fill** is set to **loop bus**. It
records the colour bars source A shows while the space footage loads, so the
links open with the copies over colour bars. To put the footage behind them, set
**fill** to **program A**, then **freeze**, then back to **loop bus**. Freeze
grabs the frame on screen, footage included. Back on loop bus, the store records
a picture whose hole shows that frame, so the footage stays behind the new
copies.

## The keyhole

With the key inverted, the keyer keeps the backing and cuts out the subject:
[the keyhole](/app/#vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Earth_Illuminated-_ISS_Time-lapse_Photography.webm/Earth_Illuminated-_ISS_Time-lapse_Photography.webm.480p.vp9.webm&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:-1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6&cuea=68,84).

![A green screen with a hole in the shape of the roll, showing the aurora through it.](/blog/keyer-keyhole.webp)

_Footage from Wikimedia Commons:
[EXPLOSION green screen](<https://commons.wikimedia.org/wiki/File:EXPLOSION_green_screen_(no_copyright)_-_the_chosen_one_(720p,_h264).webm>)
by the chosen one on YouTube, under CC BY 3.0, as are the stills and animation
of it here;
[HD video of a Chicken fillet roll](https://commons.wikimedia.org/wiki/File:HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm)
by Alan Butler, under CC0; and
[Earth Illuminated](https://commons.wikimedia.org/wiki/File:Earth_Illuminated-_ISS_Time-lapse_Photography.webm),
an ISS time-lapse by NASA Johnson Space Center, in the public domain._
