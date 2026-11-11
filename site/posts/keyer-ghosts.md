---
title: Chroma keying with ghosts
date: 2026-11-02
summary:
  The chroma keyer can fill the hole it cuts with its own earlier output, so
  anything that moves in front of the green screen leaves copies of itself.
image: https://myloveydove.com/videoskillet/blog/keyer-sandwich-turn.webp
imageAlt:
  A chicken fillet roll turning over colour bars. A disc of copies of the roll
  spreads out behind it and flashes between gold and pale blue.
look: '#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbHold:5,bKeyFill:2'
---

- Chroma key: fill to loop bus
- Mixer feedback: strobe hold to 5

The frame store records the composite signal with its colour subcarrier, whose
phase inverts every frame. Alternate copies therefore decode in complementary
colours, and gold turns pale blue. **Colour framing** turns this off.

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1.25rem 0;">
<figure style="margin: 0;">
<a href="/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:5,bKeyFillHueDeg:30"><img style="aspect-ratio: 4 / 3; object-fit: cover; margin: 0;" loading="lazy" src="https://myloveydove.com/videoskillet/blog/keyer-fade-sandwich-hue.webp" alt="The chicken fillet roll turning over an abandoned ballroom. Behind it a disc of its copies runs through bands of every hue."></a>
<figcaption>Store hue at 30°</figcaption>
</figure>
<figure style="margin: 0;">
<a href="/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&mod=bKeyFillHueDeg:sine:0.25:1&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:3"><img style="aspect-ratio: 4 / 3; object-fit: cover; margin: 0;" loading="lazy" src="https://myloveydove.com/videoskillet/blog/keyer-freeze-hue-roll.webp" alt="The chicken fillet roll turning in front of a frozen copy of itself. The frozen copy cycles through blue, green and purple while the live roll stays gold."></a>
<figcaption>Fill to freeze, store hue on a sine</figcaption>
</figure>
</div>

Set the key edge to extrude and each copy stands on a
[violet slab](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:5,bKeyFillMixA:0.1,bKeyEdge:3,bKeyEdgeUs:1.5,bKeyEdgeY:0.5,bKeyEdgeSat:0.35,bKeyEdgeHueDeg:30).

A cutout with transparency needs no green screen. Set **key source** to B alpha
and the keyer cuts by the source's alpha channel, so a transparent PNG, WebP or
WebM keys as it loads.

_Footage: the sandwich is
[HD video of a Chicken fillet roll](https://commons.wikimedia.org/wiki/File:HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm)
by Alan Butler, under CC0. The ballroom is
[Abandoned grand piano](<https://commons.wikimedia.org/wiki/File:Abandoned_grand_piano_-_Abandoned_Ballroom_(6).jpg>)
by Jan Bommes, under CC BY 2.0._
