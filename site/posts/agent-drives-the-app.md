---
title: Letting an AI agent drive the app
date: 2026-11-01
summary:
  We made videoskillet drivable by AI agents, so you can ask Claude Code for a
  look.
image: /blog/agent-ai-card.webp
imageAlt:
  The words "videoskillet + AI" in white type on black, fringed in violet and
  crossed by tape dropouts.
look: '#set=capLumaMHz:4.2,demodMHz:3.43,chromaGain:13.62,vir:0.86,lumaMHz:6,noiseIre:9.2,colorUnderMix:0.38,underJitterDeg:1.5,headSwitchNoise:0.15,headSwitchShiftUs:0.3,diffGain:1,diffPhaseDeg:49,tbJitterNs:300,tbWowNs:110,dubGens:3,cfbMix:1,cfbGain:-1.08,cfbDelayUs:2.233,cfbLines:59,cfbKey:0.98,cfbKeyLevel:48,cfbServoUs:0.07,cfbRing:0.89,cfbGenlock:1&mod=&iurlb=https:%2F%2Fthumb.wikimedia.org%2Fwikipedia%2Fcommons%2Fthumb%2Fa%2Fa5%2FMinho_for_Marie_Claire_Magazine_August_Issue_2021_02.png%2F1280px-Minho_for_Marie_Claire_Magazine_August_Issue_2021_02.png%3Futm_source%3Dcommons.wikimedia.org%26utm_campaign%3Dimageinfo%26utm_content%3Dthumbnail&iurl=https:%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2Ff%2Ff1%2FJill_St._John_-_Tony_Rome%252C_1967.jpg%3Futm_source%3Dcommons.wikimedia.org%26utm_campaign%3Dimageinfo%26utm_content%3Dthumbnail_unscaled'
---

<div class="video-frame" style="--video-aspect: 1564 / 552">
<video
  aria-label="Recording of Claude Code in a terminal building a look in videoskillet one stage at a time, with the purple, tape-warped portrait on the left."
  controls muted loop playsinline preload="none"
  poster="/blog/agent-build-poster.webp"
  src="https://myloveydove.com/videoskillet/agent-build.mp4"></video>
<button type="button" class="video-play-overlay" aria-label="Play video"><span class="video-play-icon" aria-hidden="true"></span></button>
</div>

We made videoskillet so an AI agent can run it for you! Tell Claude Code or
Claude in Chrome what you want in plain words, and it turns the knobs, checks
its work and hands you a link to the look. Watch Claude Sonnet rebuild the
Purplady demo from scratch in the video.

Want to try it? Run `claude --chrome` with the app open in Chrome, or open the
Claude in Chrome side panel in the app's tab. The **agent** button in the
sidebar copies a starting prompt for the look on screen.

If you're building your own agent, we added `window.vfBoard.apply(link)` to
apply a whole look at once and `window.vfBoard.read()` to return the board as
text. The [AI guide](/guide/ai/) has the details, and [llms.txt](/llms.txt)
lists every control an agent can set.
