---
title: Keying by alpha
date: 2026-11-11
summary:
  We taught the keyer to cut out transparent PNGs, WebPs and WebMs, so you can
  key a fox, a clover or a spacecraft over anything without a green screen.
image: /blog/alpha-fox-mist.webp
imageAlt:
  A yawning red fox cut out of its photograph and keyed over a misty forest with
  sun shining through the trees.
look: '#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg/1280px-Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg&iurlb=https://upload.wikimedia.org/wikipedia/commons/f/f6/Yawning_red_fox_%28transparent_background%29.png&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeySource:1'
---

- Source B: a picture with a transparent background
- Chroma key: key to 1, key source to B alpha

We made the keyer cut out transparent images, so you can put a fox in a misty
forest without a green screen! Drop a PNG, WebP or WebM with a transparent
background on B, flip the new **Key source** switch to B alpha, and your cutout
appears over A. Old character generators (the machines that put titles and
captions on TV) sent the shape of their lettering down a separate wire beside
the picture. We send B's alpha the same way, so the edge stays as crisp as the
artist drew it.

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1.25rem 0;">
<figure style="margin: 0;">
<a href="/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Vignes_pr%C3%A8s_du_Pic_de_Vissou_-_October_2020.jpg/1280px-Vignes_pr%C3%A8s_du_Pic_de_Vissou_-_October_2020.jpg&iurlb=https://upload.wikimedia.org/wikipedia/commons/3/3a/Gluecksklee_%28transparent_background%292.png&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1"><img style="aspect-ratio: 4 / 3; object-fit: cover; margin: 0;" loading="lazy" src="/blog/alpha-clover-chroma.webp" alt="A four-leaf clover over an autumn vineyard on a black field. The vineyard shows faintly through the green of the leaves."></a>
<figcaption>Key source on chroma</figcaption>
</figure>
<figure style="margin: 0;">
<a href="/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Vignes_pr%C3%A8s_du_Pic_de_Vissou_-_October_2020.jpg/1280px-Vignes_pr%C3%A8s_du_Pic_de_Vissou_-_October_2020.jpg&iurlb=https://upload.wikimedia.org/wikipedia/commons/3/3a/Gluecksklee_%28transparent_background%292.png&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeySource:1"><img style="aspect-ratio: 4 / 3; object-fit: cover; margin: 0;" loading="lazy" src="/blog/alpha-clover-alpha.webp" alt="The same clover keyed cleanly over the vineyard, its leaves solid green."></a>
<figcaption>Key source on B alpha</figcaption>
</figure>
</div>

The [chroma keyer](https://en.wikipedia.org/wiki/Chroma_key) cuts out green, so
on the left the vineyard shows through the clover's leaves. On the right we key
by alpha, and the clover keeps all of its green.

## Key edges

We made all the key edge effects work on alpha too. Give the clover a
[drop shadow](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Beech_forest_M%C3%A1tra_in_winter.jpg/1280px-Beech_forest_M%C3%A1tra_in_winter.jpg&iurlb=https://upload.wikimedia.org/wikipedia/commons/3/3a/Gluecksklee_%28transparent_background%292.png&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeySource:1,bKeyEdge:2,bKeyEdgeUs:2.5,bKeyEdgeY:0.05).

![The clover over a winter beech forest with a black drop shadow below and to the right of it.](/blog/alpha-clover-shadow.webp)

## Genlock off

Turn genlock off and B's picture stops keeping time with A's, so the cutout
slips and rolls around the screen with B's picture. It looks gloriously broken.
Watch
[the fox unlocked](/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg/1280px-Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg&iurlb=https://upload.wikimedia.org/wikipedia/commons/f/f6/Yawning_red_fox_%28transparent_background%29.png&set=chromaGain:1.3,crtSat:1.2,bGain:0.6,aGain:0.7,bKey:1,bKeySource:1,bDetuneHz:5).

![The fox washed pale and summed over the misty forest, with a coloured stripe and a dark bar where its sync rolls through the picture.](/blog/alpha-fox-unlocked.webp)

## A moving cutout

Moving cutouts work too! We read a WebM's alpha channel frame by frame. Set
**Fill** to loop bus (the mixer's feedback path) and this spacecraft leaves a
trail of ghosts, as in [Chroma keying with ghosts](/blog/keyer-ghosts/).

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 1.25rem 0;">
<figure style="margin: 0;">
<a href="/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Beech_forest_M%C3%A1tra_in_winter.jpg/1280px-Beech_forest_M%C3%A1tra_in_winter.jpg&vurlb=https://myloveydove.com/videoskillet/sources/swift-alpha.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeySource:1,bKeyFill:2,cfbHold:5,bKeyFillHueDeg:30"><img style="aspect-ratio: 4 / 3; object-fit: cover; margin: 0;" loading="lazy" src="https://myloveydove.com/videoskillet/blog/alpha-swift-hue.webp" alt="Four seconds of a gold-foiled spacecraft turning over a winter beech forest. A stepped stack of its copies trails behind it, edged in green, blue and magenta, and the forest's tint drifts between violet and green."></a>
<figcaption>Fill to loop bus, store hue at 30°</figcaption>
</figure>
<figure style="margin: 0;">
<a href="/app/#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg/1280px-Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg&vurlb=https://myloveydove.com/videoskillet/sources/swift-alpha.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeySource:1,bKeyFill:2,cfbHold:4,bKeyFillMixA:0.1"><img style="aspect-ratio: 4 / 3; object-fit: cover; margin: 0;" loading="lazy" src="https://myloveydove.com/videoskillet/blog/alpha-swift-fade.webp" alt="Four seconds of the spacecraft turning over the misty forest, trailed by a stepped stack of copies that fade into the trees."></a>
<figcaption>Fill to loop bus, program A in fill at 0.1</figcaption>
</figure>
</div>

_Footage: the fox is
[Yawning red fox (transparent background)](<https://commons.wikimedia.org/wiki/File:Yawning_red_fox_(transparent_background).png>)
by Peter G Trimming, under CC BY 2.0. The clover is
[Gluecksklee (transparent background)2](<https://commons.wikimedia.org/wiki/File:Gluecksklee_(transparent_background)2.png>)
by Kolossos, under CC BY-SA 3.0. The forest in the mist is
[Baumsilhouetten am Uetliberg mit Novembernebel und Sonnenstrahlen](https://commons.wikimedia.org/wiki/File:Baumsilhouetten_am_Uetliberg_mit_Novembernebel_und_Sonnenstrahlen.jpg)
by Kuhnmi, under CC BY-SA 4.0. The vineyard is
[Vignes près du Pic de Vissou - October 2020](https://commons.wikimedia.org/wiki/File:Vignes_pr%C3%A8s_du_Pic_de_Vissou_-_October_2020.jpg)
by Christian Ferrer, under CC BY 4.0. The beech forest is
[Beech forest Mátra in winter](https://commons.wikimedia.org/wiki/File:Beech_forest_M%C3%A1tra_in_winter.jpg)
by Susulyka, under CC BY-SA 4.0. The spacecraft is from
[Swift Spacecraft Animations: 2025](https://svs.gsfc.nasa.gov/14786) by NASA's
Scientific Visualization Studio, in the public domain, cut to four seconds at
twice its speed and encoded as a WebM with alpha._
