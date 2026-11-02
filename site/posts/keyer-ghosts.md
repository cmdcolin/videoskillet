---
title: Chroma keying with ghosts and freezes
date: 2026-11-02
summary:
  The chroma keyer can fill the hole it cuts with its own earlier output, so a
  subject moving in front of the green screen leaves copies of itself. The
  copies can fade, turn round the colour wheel and stand on edges of their own,
  and a freeze holds them behind whatever is keyed in next.
image: https://myloveydove.com/videoskillet/blog/keyer-freeze-crowd.webp
imageAlt:
  A chicken fillet roll turning over an abandoned ballroom, in front of a frozen
  row of a skeleton's copies standing one behind the other.
look: '#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.15'
---

A chroma keyer replaces every pixel of the key colour with a fill picture. The
keyer's **fill** can be program A, a flat matte, the **loop bus** or a
**freeze**. The last two take the fill from the mixer's frame store, which holds
the keyer's own output from a few frames earlier.

## Ghosts

![A chicken fillet roll turning over colour bars. A disc of copies of the roll spreads out behind it and flashes between gold and pale blue.](https://myloveydove.com/videoskillet/blog/keyer-sandwich-turn.webp)

With **fill** set to **loop bus**, the hole the key cuts shows the frame store,
with the subject where it stood a few frames ago. Each frame the store records
already contains the copies from earlier recordings, so anything that moves in
front of the green screen leaves a trail of copies.

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

- [The disc](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:5)
  is the clip above.
- [The fan](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,cfbDelayUs:0,bKeyFill:2)
  turns strobe hold off, and the copies blur together.
- [The keyhole](/app/#vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:-1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6)
  inverts the key and cuts out the sandwich.

## Freeze

![The chicken fillet roll turning over the abandoned ballroom. Behind it a row of a skeleton's copies stands frozen, one behind the other, and the room and the row flicker between brown and blue.](https://myloveydove.com/videoskillet/blog/keyer-freeze-crowd.webp)

**Freeze** holds the picture that is on screen when you select it. The hole the
key cuts shows that held frame from then on, and the subject in front of the
green goes on moving over a still of the scene.

Freeze is the freeze button on a frame synchronizer. The frame store records the
program once, on the frame freeze is selected, and then stops recording. On that
frame the keyer is still cutting to the fill that was selected before, so that
fill decides what gets held:

- From **loop bus**, the trail of copies stops where it is. A dancer becomes a
  frozen crowd of itself.
- From **program A**, the store holds A with the subject keyed into it. The live
  subject then dances beside a still of itself.

The held frame stays when a source changes. That makes it possible to build a
scene in layers: freeze one subject's trail, then load a different clip into B
and key it in front. The picture above was made this way:

- Open
  [the skeleton in the ballroom](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.15)
  and let the skeleton dance for about ten seconds, until a row of copies has
  built up behind it. The fade at 0.15 keeps the row from burying the room.
- Set **fill** to **freeze**. The row stops, and the live skeleton dances in
  front of it.
- Load the
  [chicken fillet roll](https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm)
  into source B. The roll takes the skeleton's place and turns in front of the
  frozen crowd.

A link opened with freeze set holds nothing until its sources have loaded and
stayed quiet for about a second. Without that wait it would hold the colour bars
that show while a clip loads, or the black frame while a cued clip seeks to its
in-point.
[Dancing beside itself](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:3)
opens on program A, then holds one frame of the skeleton in the ballroom while
the live one keeps dancing over it.

![The skeleton dancing in the ballroom beside a frozen copy of itself caught mid-step. The room and the frozen copy flicker between brown and blue.](https://myloveydove.com/videoskillet/blog/keyer-freeze-self.webp)

## The held frame flashes

![The chicken fillet roll turning in front of a frozen copy of itself. The frozen copy and the room around it flash between gold and pale blue, while the live roll stays gold.](https://myloveydove.com/videoskillet/blog/keyer-freeze-flash.webp)

A frozen frame flashes for the same reason the copies do. It keeps the
subcarrier phase of the one frame it was recorded on, so on every other frame
the TV decodes it in complementary colours: a gold roll turns pale blue, and the
brown room turns blue-grey. The live subject in front of it keeps its colours.

**Colour framing** stops the flashing, for a held frame and for the copies on
the loop bus alike. With it on, the store inverts its chroma on the frames of
the other phase, as a real frame synchronizer does. It is off by default, and
the flashing is part of the look.

## Copies that fade

![A skeleton dancing beside a grand piano in an abandoned ballroom, trailed by a row of fainter copies of itself.](https://myloveydove.com/videoskillet/blog/keyer-fade-skeleton.webp)

On the loop bus every copy used to stay in the store for good. A clip that loops
buried the background under copies within twenty seconds.

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

Keep strobe hold at an odd count while the fade is up, or turn on colour
framing. With an even count, alternate recordings sit on the opposite subcarrier
phase from program A, and the mix cancels the background's colour toward grey.

## Copies that turn round the colour wheel

![The chicken fillet roll turning over the abandoned ballroom. Behind it a disc of its copies runs through bands of every hue, and the room shifts between purple, green and blue.](https://myloveydove.com/videoskillet/blog/keyer-fade-sandwich-hue.webp)

**Store hue** is the hue trim on the frame store's output, the proc amp every
frame synchronizer has. On the loop bus the keyer records through it, so each
generation of copies turns that far round the wheel past the one before.
[The sandwich at 30 degrees](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://upload.wikimedia.org/wikipedia/commons/transcoded/1/14/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm/HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm.480p.vp9.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:5,bKeyFillHueDeg:30)
spreads its copies into rainbow bands while the ballroom behind it changes tint.
A comb filter separates the chroma before the trim, so the background keeps its
fine detail through hundreds of recordings, though its colour edges soften.

On a freeze the store does not record, so the trim turns the held frame once and
the live subject keeps its own colours.
[The frozen room on a sine](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&mod=bKeyFillHueDeg:sine:0.25:1&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:3)
patches a slow sine to store hue, so the held ballroom and the held skeleton
cycle through every hue while the live skeleton stays white.

![The skeleton dancing beside a frozen copy of itself. The frozen ballroom turns from blue to brown to green, and the piano turns purple, while the live skeleton stays white.](https://myloveydove.com/videoskillet/blog/keyer-freeze-hue.webp)

## Ghosts with edges

![The skeleton dancing in the ballroom with a trail of copies behind it. The live skeleton and every copy stand on a thick violet slab that runs down and to the right from each bone.](https://myloveydove.com/videoskillet/blog/keyer-loop-extrude.webp)

The **edge generator** delays the key by a few samples and lines and fills
wherever the delayed copies reach past the subject with a matte of its own.
**Border** grows a rim all round, **drop shadow** lays one copy down and to the
right, and **extrude** stacks a run of copies along that diagonal into a slab.
The edge is the key moved, so it has the key's soft-across, sharp-down composite
edge.

On the loop bus the frame store records the keyer's output, edge included, so
every ghost keeps the edge it had when it was recorded.
[Violet slabs](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:5,bKeyFillMixA:0.1,bKeyEdge:3,bKeyEdgeUs:1.5,bKeyEdgeY:0.5,bKeyEdgeSat:0.35,bKeyEdgeHueDeg:30)
stands the skeleton and each of its copies on an extruded slab, and
[drop shadows](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.15,bKeyEdge:2,bKeyEdgeUs:1.5)
gives every copy a black shadow of its own.
[Extruded ribbons](/app/#preset=extrudedRibbons&srcb=synth) stands the video
synth's colour bands on copper slabs.

## Two more keyer changes

- **The additive keyer** works like an Ultimatte. It measures how much backing
  colour each sample holds, subtracts that much backing from B, and adds the
  same share of the fill underneath. A shadow cast on the green becomes a shadow
  on the fill, and fine hair keys part way. Set **backing level** and **backing
  luma** a little under the lit backing.
- **A damaged feed makes the key chatter.** The keyer slices the chroma it
  receives on the bus, so the snow and dropouts on B's feed are in the signal it
  decides on. Colours near the edge of the acceptance wedge are pushed across it
  and back every frame and boil into grain, and each dropout tears a streak
  through the key. [Key off a dub](/app/#preset=keyOffADub&srcb=synth) feeds the
  keyer from a worn tape.

_Footage: the skeleton is from
[Creatures For Chroma Key](https://archive.org/details/EvaVikstromCreaturesForChromaKey)
by Eva Vikström, under CC BY 3.0. The ballroom is
[Abandoned grand piano](<https://commons.wikimedia.org/wiki/File:Abandoned_grand_piano_-_Abandoned_Ballroom_(6).jpg>)
by Jan Bommes, under CC BY 2.0. The sandwich is
[HD video of a Chicken fillet roll](https://commons.wikimedia.org/wiki/File:HD_video_of_a_Chicken_fillet_roll_-_rotating_green_screen_alan_butler.webm)
by Alan Butler, under CC0._
