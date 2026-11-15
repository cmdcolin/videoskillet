---
title: More scramble channel effects - the weak signal
date: 2026-11-13
summary:
  We made the cable descrambler box miss lines on a weak signal, because its
  timing pulses rode on the channel's much weaker sound carrier.
image: /blog/descrambler-foghorn.webp
imageAlt:
  A smiling woman in sunglasses, her face and hair washed in bands of violet,
  cyan and green, crossed by thin grey streaks, with the right edge of the
  picture torn into a ragged black band.
look: '#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:2,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3,scDetuneKHz:0.06,burstLock:0.3,accLagLines:30,matrixClip:1,ghostGain:0.1,ghostDelayUs:1.2&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg'
---

In the 1980s, cable companies scrambled their pay channels, and subscribers
rented a descrambler box to watch them. We made that box miss lines of the
picture when the signal is weak, as it was at the far end of a long cable run or
when split between several TVs.
[Foghorn](/app/#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:2,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3,scDetuneKHz:0.06,burstLock:0.3,accLagLines:30,matrixClip:1,ghostGain:0.1,ghostDelayUs:1.2&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg),
the look at the top of the page, shows the result.

## How the box worked

A TV draws its picture as 525 lines. Between lines there is a short gap with a
sync pulse in it, and the TV starts each new line when it detects that pulse.
The scrambling equipment that
[General Instrument](https://en.wikipedia.org/wiki/General_Instrument) and
[Jerrold](https://en.wikipedia.org/wiki/Jerrold_Electronics) built for cable
companies turned that gap down, so a TV without a box showed the picture torn
apart. The descrambler box turned the gap back up.

The box took its timing from pulses that the cable company sent on the
[sound carrier](https://en.wikipedia.org/wiki/NTSC), the separate radio signal
for the channel's audio. The sound carrier is much weaker than the picture, so
on a weak signal the box misses pulses while the picture is still watchable.
Each missed line stays scrambled and shows as a grey streak. The **RF snow**
control sets how weak the signal is.

## From the magazines

Radio-Electronics explained the trick to readers building their own decoders:
"the sync signal is amplitude modulated onto the sound carrier"
([February 1987, page 44](https://www.worldradiohistory.com/Archive-Radio-Electronics/80s/1987/Radio-Electronics-1987-02.pdf)).
Three years earlier it described the same "streaking horizontal lines" from a
home-built box that triggered at the wrong moments
([February 1984, page 49](https://www.worldradiohistory.com/Archive-Radio-Electronics/80s/1984/Radio_Electronics_February_1984.CV01.pdf)).

<figure style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin: 1.5rem 0; padding: 0.9rem; border: 1px solid var(--border-faint); border-radius: 0.6rem; background: var(--surface);">
<a href="/blog/radio-electronics-1987-tri-mode.webp" style="flex: 0 1 18rem;"><img style="margin: 0; aspect-ratio: 4 / 3; object-fit: cover; object-position: top;" loading="lazy" src="/blog/radio-electronics-1987-tri-mode-thumb.webp" alt="Page 44 of Radio-Electronics, February 1987. A red box surrounds Fig. 1, a waveform diagram that draws one stretch of signal three times, labelled clear, 6dB and 10dB, with the gap between lines sitting lower than the picture's black level in the clear signal and higher in the other two. Lower in the left column, the sentence saying the sync signal is amplitude modulated onto the sound carrier is highlighted in yellow."></a>
<figcaption style="flex: 1 1 14rem; margin: 0;">Fig. 1 from Radio-Electronics, February 1987, page 44, drawing a tri-mode channel at its clear, 6 dB and 10 dB levels. <a href="/blog/radio-electronics-1987-tri-mode.webp">Full page</a></figcaption>
</figure>

<figure style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin: 1.5rem 0; padding: 0.9rem; border: 1px solid var(--border-faint); border-radius: 0.6rem; background: var(--surface);">
<a href="/blog/radio-electronics-1984-cable-descrambling.webp" style="flex: 0 1 18rem;"><img style="margin: 0; aspect-ratio: 4 / 3; object-fit: cover; object-position: top;" loading="lazy" src="/blog/radio-electronics-1984-cable-descrambling.webp" alt="The opening page of Fred Means&#39;s article All About Cable-TV Descrambling in Radio-Electronics, February 1984, with a large red headline, a TV screen showing a smeared scrambled picture, three columns of text and a waveform diagram of a scrambled line."></a>
<figcaption style="flex: 1 1 14rem; margin: 0;">The opening page of Fred Means&rsquo;s article in Radio-Electronics, February 1984. <a href="/blog/radio-electronics-1984-cable-descrambling.webp">Full page</a></figcaption>
</figure>

## Foghorn

For Foghorn we drove the snow with a slow chaotic oscillator, so the streaks
come and go at irregular intervals. We also added the drifting line oscillator
from our [scrambled channel](/blog/better-scramble-channel/) post, which sways
the picture sideways, and mains hum, which bends the black band at the right
edge. We left the TV's colour unlocked, so the hues sweep through the rainbow,
and added a faint reflection from a badly matched splitter, which echoes every
edge a little to the right.

<figure>
<a href="/app/#set=scramble:1,scrambleMode:3,decoderDb:10,rfSnow:0.14,hHold:0.08,syncSlicer:2,agc:1,chromaGain:1.5,crtSat:1.4,noiseIre:2,hDetuneHz:4,hvSagUs:14,hvRing:0.2,afpcLagLines:40,humMod:0.3,scDetuneKHz:0.06,burstLock:0.3,accLagLines:30,matrixClip:1,ghostGain:0.1,ghostDelayUs:1.2&mod=rfSnow:lorenz:0.15:0.12,hDetuneHz:lorenz:0.25:0.0015,hvSagUs:lorenz:0.15:0.05&iurl=https://upload.wikimedia.org/wikipedia/commons/4/40/Pink_sunglasses_on_swimsuit_model_%286080359110%29.jpg"><video style="aspect-ratio: 754 / 480; object-fit: cover; margin: 0; width: 100%;" autoplay muted loop playsinline aria-label="A smiling woman in sunglasses, her face sweeping through magenta, blue and green, cut by grey streaks, with the right edge of the picture tearing and bending." poster="/blog/descrambler-foghorn-poster.webp" src="https://myloveydove.com/videoskillet/blog/descrambler-foghorn.mp4"></video></a>
</figure>

_The sunglasses are
[Pink sunglasses on swimsuit model](<https://commons.wikimedia.org/wiki/File:Pink_sunglasses_on_swimsuit_model_(6080359110).jpg>)
by Michael Dorausch, under CC BY-SA 2.0, from Wikimedia Commons, and the clip of
it here is under the same licence._

_The magazine pages are from Radio-Electronics, February 1984 and February 1987,
from the World Radio History archive._
