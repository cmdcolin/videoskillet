---
title: Keyer ghosts that fade
date: 2026-10-30
draft: true
summary:
  The chroma keyer's copies can now fade back into the room behind them, turn
  further round the colour wheel with every generation, and build over the
  picture in program A when a link opens.
image: https://myloveydove.com/videoskillet/blog/keyer-fade-skeleton.webp
imageAlt:
  A skeleton dancing beside a grand piano in an abandoned ballroom, trailed by a
  row of fainter copies of itself.
look: '#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.15'
---

[Chroma keying with ghosts](/blog/keyer-ghosts/) set the keyer's **fill** to
**loop bus**, so the hole the key cuts shows the frame store, and a subject
moving in front of the green leaves copies of itself. Every copy stayed in the
store for good. A clip that loops buried the background under copies within
twenty seconds.

**Program A in fill** is a crossfader ahead of the keyer's fill. It mixes
program A in with the frame store, and the store records the result, so each
recording keeps a little less of every copy. At 0.15 a copy is half gone after
about four recordings. With a still of a room in A, the copies fade back into
the room.

- [The skeleton in the ballroom](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.15)
  records every fourth frame and fades each copy at 0.15.
- [Clear on a press](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&mod=bKeyFillMixA:trig:1:1&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.03)
  leaves a long trail and patches a one-shot in the modulation bay to the fade.
  Each fire wipes the copies back to the room, and the trail builds again.

Keep strobe hold at an odd count while the fade is up, or turn on **colour
framing**. The subcarrier inverts on every frame, so with an even count
alternate recordings sit on the opposite phase from program A, and the mix
cancels the background's colour toward grey. With colour framing on, the store
inverts its chroma on frames of the other phase, as a frame synchronizer does,
so the copies and the room keep their own colours at any count and stop flashing
between complementary colours.

**Store hue** is the hue trim on the frame store's output, the proc amp every
frame synchronizer has. The keyer records through it, so each generation of
copies turns that far round the wheel past the one before, and the frozen
background turns with them. A comb filter separates the chroma before the trim,
so the background keeps its fine detail through hundreds of recordings, though
its colour edges soften.
[The sandwich at 30 degrees](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:5,bKeyFillHueDeg:30)
spreads its copies into rainbow bands while the ballroom behind it changes tint.

![The chicken fillet roll turning over the abandoned ballroom. Behind it a disc of its copies runs through bands of every hue, and the room shifts between purple, green and blue.](https://myloveydove.com/videoskillet/blog/keyer-fade-sandwich-hue.webp)

A link with the fill on the loop bus now shows program A until its sources have
loaded, so the copies build over the picture in A. Before, the store held the
link's first frames, which are colour bars.

_Footage: the skeleton is from
[Creatures For Chroma Key](https://archive.org/details/EvaVikstromCreaturesForChromaKey)
by Eva Vikström, under CC BY 3.0. The ballroom is
[Abandoned grand piano](<https://commons.wikimedia.org/wiki/File:Abandoned_grand_piano_-_Abandoned_Ballroom_(6).jpg>)
by Jan Bommes, under CC BY 2.0. The sandwich is by Alan Butler, under CC0._
