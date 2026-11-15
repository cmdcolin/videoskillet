---
title: More scramble channel effects - the weak signal
date: 2026-11-13
summary:
  We made the cable descrambler box miss lines of the picture on a weak signal.
  The box reads its timing from the channel's sound carrier, which is much
  weaker than the picture, so it starts missing lines while the picture is still
  easy to watch.
image: /blog/descrambler-pink-shades.webp
imageAlt:
  A smiling woman in pink wraparound sunglasses against a pale sky, her hair and
  face crossed by thin grey streaks, with the right edge of the picture torn
  into a bulging black band.
look: '#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:1,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg'
---

In the 1980s, cable companies scrambled their pay channels, and subscribers
rented a descrambler box to watch them. We made that box miss lines of the
picture when the signal is weak (at the far end of a long cable run, for
example, or split between several TVs), so those lines stay scrambled. The clip
below is a 1951 lighthouse photograph through the box as the signal grows weaker
and then stronger again.

<div class="video-frame" style="--video-aspect: 754 / 480">
<video
  aria-label="Eight seconds of the 1951 lighthouse photograph through a scrambled channel and a descrambler box. Thin grey streaks and sideways jitter cover the picture, thin out until it is nearly clean, and come back. A black bar at the right edge breaks into grey lines and closes up again."
  autoplay muted loop playsinline
  poster="/blog/scramble-sound-key-poster.webp"
  src="https://myloveydove.com/videoskillet/blog/scramble-sound-key.mp4"></video>
</div>

## Scrambling and the descrambler box

In our [scrambled channel](/blog/better-scramble-channel/) post we simulated the
scrambling that
[General Instrument](https://en.wikipedia.org/wiki/General_Instrument) and
[Jerrold](https://en.wikipedia.org/wiki/Jerrold_Electronics) built for cable
companies. A TV draws its picture as 525 horizontal lines, one after another.
Their equipment at the head-end (the cable company's transmitting station)
turned the signal down by 6 or 10 dB, to a half or about a third of its
strength, in the gap between lines. That gap holds the sync pulse, which tells
the TV when to start each new line, so a TV without a box could not find the
start of each line and showed the picture torn apart. The descrambler box raised
the signal in that gap back to full strength, and we simulated that box too,
with the **decoder box** control. With a strong signal, the box restores the
picture.

![The same photograph through the scrambled channel with the box restoring it: a clean, steady picture with soft colour and a plain black bar at the right edge.](/blog/scramble-sound-key-clear.webp)

## Timing pulses on the sound carrier

To raise the signal at the right moment, the box needed a timing pulse at the
start of every line. The cable company sent these pulses on the
[sound carrier](https://en.wikipedia.org/wiki/NTSC), the separate radio signal
that holds the channel's audio, as small changes in its strength. A TV's sound
circuit responds to changes in frequency, so these changes in strength made
little or no sound.

Some channels used a tri-mode system, which could switch the cut between 6 dB,
10 dB and none from one field to the next (a field is half a frame, and the TV
draws about 60 of them a second). On those channels the cable company also sent
a mode code on the sound carrier for each field, giving the amount of the cut.

The magazine Radio-Electronics explained this to readers building their own
decoders: "the sync signal is amplitude modulated onto the sound carrier"
(February 1987, page 44). It also warned them to fine-tune the converter (the
cable tuner box ahead of the TV), "because, if it's not, the circuit will not
detect the Tri-mode pulses."

## Why a cable signal gets weak

A cable signal loses strength on its way from the head-end to the TV. Coaxial
cable absorbs some of the signal along every metre, more on the higher channels
and more when the cable is hot, so the cable company put amplifiers at intervals
along the street to boost it again. Each amplifier also added a little noise, so
a house at the end of a long chain of amplifiers got the weakest and noisiest
signal. Inside the house, every splitter that fed another TV cut the signal
roughly in half. Water inside the cable from the street to the house, or a loose
or corroded connector, cut it further, and an amplifier that drifted or failed
could weaken the signal for a whole street.

When the signal reaching the TV is weak, the TV turns its gain up to make up for
it. That also turns up the noise from the amplifiers and from the TV's own
circuits, which the TV shows as snow, a layer of flickering random dots over the
picture.

## Missed pulses

A weak signal has the same effect on the box as a badly tuned converter. The
sound carrier is much weaker than the picture, so the box stops detecting its
pulses while the picture is still easy to watch.

We made the box miss more pulses as you raise the **RF snow** control. The TV
shows each missed line as a grey streak. Radio-Electronics described these
"streaking horizontal lines" in February 1984 (page 47). On a missed line the
sync pulse stays turned down, but the TV's line oscillator (the clock that
starts each line) keeps time across the occasional missing pulse, so the TV
still draws a steady picture. On a tri-mode channel, more snow also makes the
box misread mode codes, and the box restores whole fields by the wrong amount,
so the picture tears on those fields.

## Foghorn

For
[Foghorn](/app/#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:1,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg),
the look at the top of the page, we varied the snow with a slow chaotic
oscillator (a [Lorenz attractor](https://en.wikipedia.org/wiki/Lorenz_system)),
so the signal weakens and recovers at irregular intervals and the streaks appear
and clear again.

We also reused the drifting line oscillator from the scrambled channel post, so
the TV starts each line a little early or late and draws the picture leaning and
swaying sideways. We added mains hum to the power supply of a cable amplifier
(the **hum modulation** control). The supply's rectifier doubles the 60 Hz
mains, so the hum ripples at 120 Hz, which is slightly more than twice the 59.94
fields a second the TV draws, so two bands of ripple creep slowly up the screen.
The ripple changes the strength of the sync pulse on each line it crosses, and
the TV starts those lines in slightly different places. The TV then draws the
black band at the right edge of the picture, where the sync pulse sits, with a
bent and bulging edge. We kept the TV's colour circuit locked, so the hue stays
put while the lines move, and turned the saturation up.

<figure>
<a href="/app/#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:1,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg"><video style="aspect-ratio: 754 / 480; object-fit: cover; margin: 0; width: 100%;" autoplay muted loop playsinline aria-label="A smiling woman in pink wraparound sunglasses against a pale sky, cut by grey streaks, with the right edge of the picture tearing and bending." poster="/blog/descrambler-pink-shades-poster.webp" src="https://myloveydove.com/videoskillet/blog/descrambler-pink-shades.mp4"></video></a>
</figure>

## Gate timing

A box can also fail on a strong signal when its own timing is off. The box
raises the signal during a window called the gate. We made two more looks with a
box whose gate timing has gone wrong. When the gate timing drifts, the box
raises a strip of picture where the sync pulse should be, and the TV locks to
that strip. With
[the drifting box](/app/#preset=driftingBox&vurl=https://myloveydove.com/videoskillet/sources/artifacts-fashion-film.webm),
the TV shows slabs of red and blue along the left edge of the picture. When the
gate also opens 2 µs early, it closes before the burst (the short colour
reference at the start of each line), so the burst stays turned down. The TV's
colour control then turns the colour far up, and the TV shows the picture
[washed out in pink and yellow](/app/#preset=earlyBox&vurl=https://myloveydove.com/videoskillet/sources/artifacts-fashion-film.webm).
For Gatecrasher on the gallery we pointed a camera at the screen and fed its
picture back in, and the feedback repeats the torn edge as a column of folds.

_The lighthouse photograph is Toni Frissell's
[model and lighthouse](<https://commons.wikimedia.org/wiki/File:1951_Toni_Frissell_outdoor_fashion_photo_of_model_and_lighthouse_(enhanced).jpg>)
from 1951, from the Library of Congress with no known restrictions._

_The sunglasses are
[Pink sunglasses on swimsuit model](<https://commons.wikimedia.org/wiki/File:Pink_sunglasses_on_swimsuit_model_(6080359110).jpg>)
by Michael Dorausch, under CC BY-SA 2.0, from Wikimedia Commons, and the clip of
it here is under the same licence._

_The gate timing clip is from ARTIFACTS by Tiffany Frances, under CC BY 3.0._
