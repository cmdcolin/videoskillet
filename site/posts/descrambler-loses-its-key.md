---
title: A descrambler box on a weak signal
date: 2026-11-13
summary:
  We made the cable descrambler box read its key off the sound carrier, so a
  weak signal makes it miss lines, and the picture streaks with grey bars while
  it still holds.
image: /blog/scramble-sound-key.webp
imageAlt:
  A 1951 model in a dark coat in front of a lighthouse, the picture crossed by
  thin grey horizontal streaks, and a black bar at the right edge broken into a
  ladder of grey lines.
look: '#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/1951_Toni_Frissell_outdoor_fashion_photo_of_model_and_lighthouse_%28enhanced%29.jpg/960px-1951_Toni_Frissell_outdoor_fashion_photo_of_model_and_lighthouse_%28enhanced%29.jpg&set=scramble:1,scrambleMode:3,decoderDb:10,hDetuneHz:4,agc:1,hvSagUs:14,hvRing:0.2,killThresh:2,accLagLines:30,afpcLagLines:40,matrixClip:1,scDetuneKHz:0.06,burstLock:0.3,noiseIre:2,syncSlicer:2,hHold:0.08,rfSnow:0.14&mod=rfSnow:lorenz:0.15:0.12'
---

We made the cable descrambler box lose its key when the signal gets weak! The
picture holds, but grey streaks comb through it, and they come and go as the
snow gets heavier and lighter. Try
[Foghorn](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/1951_Toni_Frissell_outdoor_fashion_photo_of_model_and_lighthouse_%28enhanced%29.jpg/960px-1951_Toni_Frissell_outdoor_fashion_photo_of_model_and_lighthouse_%28enhanced%29.jpg&set=scramble:1,scrambleMode:3,decoderDb:10,hDetuneHz:4,agc:1,hvSagUs:14,hvRing:0.2,killThresh:2,accLagLines:30,afpcLagLines:40,matrixClip:1,scDetuneKHz:0.06,burstLock:0.3,noiseIre:2,syncSlicer:2,hHold:0.08,rfSnow:0.14&mod=rfSnow:lorenz:0.15:0.12).

<div class="video-frame" style="--video-aspect: 754 / 480">
<video
  aria-label="Eight seconds of the 1951 lighthouse photograph through a scrambled channel and a descrambler box. Thin grey streaks and sideways jitter cover the picture, thin out until it is nearly clean, and come back. A black bar at the right edge breaks into grey lines and closes up again."
  autoplay muted loop playsinline
  poster="/blog/scramble-sound-key-poster.webp"
  src="https://myloveydove.com/videoskillet/blog/scramble-sound-key.mp4"></video>
</div>

In our [scrambled channel](/blog/better-scramble-channel/) post we simulated the
cable channels that
[General Instrument](https://en.wikipedia.org/wiki/General_Instrument) and
[Jerrold](https://en.wikipedia.org/wiki/Jerrold_Electronics) scrambled, by
turning the signal down 6 or 10 dB in the gap between lines, where the sync
pulses sit. Subscribers rented a descrambler box that turned that gap back up,
and we simulated that box too, with the **decoder box** control. With a strong
signal, the box restores the picture.

![The same photograph through the scrambled channel with the box restoring it: a clean, steady picture with soft colour and a plain black bar at the right edge.](/blog/scramble-sound-key-clear.webp)

## Timing pulses on the sound carrier

The box raised the signal during each gap, so it needed a timing pulse at the
start of every line. On a tri-mode channel it also needed a code for each field
that said whether the head-end (the cable company's transmitting equipment) had
cut it by 6 dB, 10 dB or nothing. The cable company sent both on the
[sound carrier](https://en.wikipedia.org/wiki/Subcarrier), the frequency the
channel uses for its audio, as small changes in the sound carrier's strength. A
TV's sound circuit responds to changes in frequency, so these changes in
strength made no sound.

Radio-Electronics explained this to readers building their own decoders: "the
sync signal is amplitude modulated onto the sound carrier" (February 1987, page
44). It also warned them to fine-tune the converter, "because, if it's not, the
circuit will not detect the Tri-mode pulses."

## Missed pulses

The sound carrier is much weaker than the picture carrier, so on a fading signal
the box stops detecting the pulses while the picture is still watchable. We made
the box miss pulses as the **RF snow** rises. Each line it misses comes through
still scrambled, and the TV shows it as a grey streak. Radio-Electronics
described these "streaking horizontal lines" in February 1984 (page 47). The TV
still finds sync on most lines, so the frame holds and the picture stays
readable. With more snow, the box also misreads the mode codes on a tri-mode
channel and restores whole fields by the wrong amount.

In Foghorn we vary the snow with a slow chaotic oscillator (a
[Lorenz attractor](https://en.wikipedia.org/wiki/Lorenz_system)), so the signal
fades and recovers at irregular intervals, and the streaks appear and clear
again.

## Drifting sync and mains hum

We pushed the signal further for this one. We put back the drifting line
oscillator from the scrambled channel post, so the picture swings sideways while
the box loses pulses. We also added mains hum to an amplifier's supply (the
**hum modulation** control). The hum isn't locked to the frame, so a slow ripple
climbs the picture and changes how deep the sync is on each line it passes. The
TV starts each line in a slightly different place, so the torn edge of the
blanking interval, the black band where the sync pulse sits, bends and bulges
instead of holding one shape. We kept the colour lock steady and turned the
saturation up, so the pinks stay pink. Click the clip to open the look.

<figure>
<a href="/app/#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:1,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg"><video style="aspect-ratio: 754 / 480; object-fit: cover; margin: 0; width: 100%;" autoplay muted loop playsinline aria-label="A smiling woman in pink wraparound sunglasses against a pale sky, cut by grey streaks, with the right edge of the picture tearing and bending." poster="/blog/descrambler-pink-shades-poster.webp" src="https://myloveydove.com/videoskillet/blog/descrambler-pink-shades.mp4"></video></a>
</figure>

_The lighthouse photograph is Toni Frissell's
[model and lighthouse](<https://commons.wikimedia.org/wiki/File:1951_Toni_Frissell_outdoor_fashion_photo_of_model_and_lighthouse_(enhanced).jpg>)
from 1951, from the Library of Congress with no known restrictions._

_The sunglasses are
[Pink sunglasses on swimsuit model](<https://commons.wikimedia.org/wiki/File:Pink_sunglasses_on_swimsuit_model_(6080359110).jpg>)
by Michael Dorausch, under CC BY-SA 2.0, from Wikimedia Commons, and the clip of
it here is under the same licence._
