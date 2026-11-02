---
title: Letting an AI agent drive the app
date: 2026-11-01
summary:
  Claude Code and other AI agents can drive videoskillet from a description of a
  look.
image: https://myloveydove.com/videoskillet/blog/agent-drive.webp
imageAlt:
  A calico cat on a red armchair beside a green plush toy. The picture tears
  into wavy bands of purple, green and grey as the scrambled channel preset
  lands, and the cat stays recognizable through the tearing.
look: '#preset=scrambledChannel&src=cat&set=scramble:0.3,noiseIre:3'
---

An AI agent can drive videoskillet while it runs. Ask Claude Code or Claude in
Chrome for a look in plain words, and the agent sets the controls, reads the
board back and gives you the link.

<video
  controls muted loop playsinline preload="none"
  poster="/blog/agent-drive-poster.webp"
  style="width: 100%; height: auto"
  src="https://myloveydove.com/videoskillet/agent-drive.mp4"></video>

In the recording, Claude Sonnet is asked to make the cat look like a scrambled
premium cable channel while keeping the cat recognizable.

To start, run `claude --chrome` with the app open in Chrome, or open the Claude
in Chrome side panel in the app's tab. The **agent** button in the sidebar
copies a prompt that starts from the look on screen.

The [AI guide](/guide/ai/) covers the details, and [llms.txt](/llms.txt) lists
every control an agent can set.
