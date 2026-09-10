# Writing patterns to fix

`CLAUDE.md` › _Writing_ states the rule: plain technical English, in ordinary
declarative sentences. This page is the checklist under it — the specific habits
that produced the prose this repo has had to rewrite, each with a pair from the
docs so the fix is a shape rather than a taste.

They compound. One fragment reads as a choice; a page of them reads as
generated, because the sentences stop connecting to each other and the reader
has to supply the joins. That is the failure the pass below was fixing, and it
is the reason to catch these while writing rather than in a rewrite.

## The eight that keep coming back

**A fragment standing in for a sentence.** A caption with no verb, or a subject
with no predicate, usually after a code block or as a bullet's opening.

> Nine load paths, no unit test that can touch them. → Nine load paths, and no
> unit test can touch them.
>
> What a fingertip gets, on every control the panel shows at 390px. → It
> measures what a fingertip gets, on every control the panel shows at 390px.

**An aphorism closing a section.** A short balanced sentence that sounds like a
conclusion and carries no fact. It is the tic most likely to survive a first
edit, because it reads as style.

> Keep the file and the next one is comparable. → Keeping the file makes the
> next render comparable to this one.
>
> A phone GPU is still a phone GPU. → A phone GPU has much less headroom.
>
> A measurement that lives only in a transcript gets paid for again. → A
> measurement that lives only in a transcript has to be made again.

**Contrastive framing where the positive half says it.** "X, not Y", "rather
than", "instead of", "it is not merely". Keep one only where the reader needs
the distinction to choose correctly — an ADR naming the option it turned down, a
fault that resembles another one, a mechanism that multiplies rather than adds.
Everywhere else, state what is true and stop.

> A render with no audio is a render of a different board, not a quiet one. →
> The same look with no audio produces a different picture.
>
> Staleness is stamped, not compared. → Staleness is stamped.

**A heading written as a phrase where a noun would do.** "Where the file
goes" and "What you get out" are sentences doing a label's job. Name the
subject: `Output`. Keep a phrase only where the section answers a question the
reader actually asks in those words — an FAQ entry, or a `Why ...` section whose
whole point is the reasoning.

> Where the file goes → Output
>
> What you need before starting → Requirements
>
> How the look gets in → Looks

**A heading that says what a thing is not.** The reader scanning a contents list
gets nothing from a negative. Name the subject, or call a list of limits
`Limitations`. The exception is a heading whose whole content is a distinction —
"Chaotic is not the same as wild" is the finding of the section under it, and a
positive rewrite states a conclusion the section never reached.

> What it does not do → Limitations
>
> What this is not: an NLE plugin → Why this is not an NLE plugin
>
> Deliberately not this → Out of scope
>
> Morphing is the opposite of modulating → Morphing walks the resting values

**A pronoun centring the program.** A paragraph opening on "it" makes the
software the subject of everything and leaves a reader arriving by deep link
with no antecedent. Name the actor: the renderer, the command, the panel, the
decoder.

> It runs the app's own engine. → The renderer runs the app's own engine.
>
> Feed a clip's own sound in and the artifacts move with it. → The artifacts
> move with the input's sound.

**A mannered inversion or a dropped subject.** Fronting the complement, or
opening a sentence with "So", "And" or "Hence" carrying the previous sentence's
subject.

> Which latency is now known: the lane's own. → The latency is now known, and it
> is the lane's own.
>
> So the proper route. → Hence the demuxer route.
>
> And the signal path rolls too. → The signal path rolls too.

**Cute naming in a reference table.** A flag table, a keyboard table and a
column header are read by someone looking one thing up, and a joke costs them a
second pass.

> `--seed=<n>` | the dice → `--seed=<n>` | random seed; the same seed gives the
> same file
>
> Key | Does → Key | Action

**A rule-of-three list doing a sentence's work.** Three parallel fragments,
usually with the verbs dropped, standing where one sentence with a subject
belongs.

> A look off the address bar, a file in, ProRes 4444 out. → The look comes off
> the address bar and the picture out of the file, and the output is
> ProRes 4444.

## Two more that are structural

**Two clauses stacked on one "so".** A sentence that reaches a conclusion and
then reaches another one wants splitting; the second conclusion is what the
reader loses.

> …bundled so a JavaScript runtime with no bundler in it can load them, so a
> look renders here as it renders on screen. → …bundled so a JavaScript runtime
> with no bundler in it can load them. A look therefore renders here the way it
> renders on screen.

**Em-dash asides doing the work of clauses.** One in a paragraph is punctuation;
three is a writer avoiding sentence boundaries. Promote one to its own sentence,
demote one to a comma, keep the one that is genuinely parenthetical.

## Not a problem here, worth knowing

[Wikipedia's signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
lists several habits this repo has not had: promotional adjectives (`vibrant`,
`groundbreaking`, `boasts`), vague attribution (`industry reports`,
`observers have cited`), present-participle synthesis
(`highlighting the importance of`, `underscoring its role`), the
`Challenges and Future Prospects` section, and the vocabulary cluster around
`delve`, `tapestry`, `testament`, `showcase`, `pivotal`. They are cheap to grep
for and worth a look on anything written from outside.

The one to watch is the participle:
`…, highlighting how the two stages interact` is a claim with nobody making it.
Write the claim as its own sentence or drop it.

## What not to flatten

- **The claim.** A rewrite that changes what a sentence asserts is a worse
  sentence however plain it reads. The heading exception above came out of
  exactly that: "Chaotic is not the same as wild" rewritten as "Wildness is
  large coherent structure" reads better and says something the section does not
  support.
- **The measurement.** Numbers, file paths and the names of mechanisms are the
  content. A prose pass moves sentences around them and changes none of them.
- **The author's own voice** in `README.md`. "Tasty WebGPU signal-level analog
  video emulation" and "Fun bonus" are written by a person and read like one.
- **The distinctions an ADR is about.** A record that names the option it
  declined needs both halves.
- **Generated prose.** `EFFECTS.md`, `llms.txt`, `llms-full.txt` and the loop
  block in `FEATURES.md` come from `src/ui/controls.ts` via `pnpm docgen`; an
  edit to the output lasts until the next build. Fix the control table.
