# Writing patterns to fix

`CLAUDE.md` › _Writing_ states the rule: plain technical English, in ordinary
declarative sentences. This is the checklist under it — the habits that produced
prose this repo has had to rewrite, each with a pair so the fix is a shape
rather than a taste. It covers the comments in the source too, which carry the
measurement behind a decision and get read the way a page of the guide does.
They compound: one fragment reads as a choice, and a page of them reads as
generated, because the sentences stop connecting and the reader supplies the
joins.

## The ones that keep coming back

**A fragment standing in for a sentence.** A caption with no verb, or a subject
with no predicate, usually after a code block or opening a bullet.

> Nine load paths, no unit test that can touch them. → Nine load paths, and no
> unit test can touch them.

**An aphorism closing a section.** A short balanced sentence that sounds like a
conclusion and carries no fact. It survives a first edit because it reads as
style.

> Keep the file and the next one is comparable. → Keeping the file makes the
> next render comparable to this one.
>
> A phone GPU is still a phone GPU. → A phone GPU has much less headroom.

**A conclusion standing in for the mechanism.** A sentence naming the outcome —
the build stops, the link breaks, the choice is hidden — where the sentence
saying how it happens belongs. It carries a fact, so the edit that catches an
aphorism leaves it alone, and it still hands the reader a verdict with no
machine behind it. Write what the machine does and name the actor working it.

> A marker that does not parse stops the build. → The build fails when a marker
> is misspelled.
>
> A row that scrolls hides the choice it exists to offer. → A reader who has to
> scroll the row sideways cannot see the whole choice it offers.

**Contrastive framing where the positive half says it.** "X, not Y", "rather
than", "instead of". Keep one only where the reader needs the distinction to
choose correctly — an ADR naming the option it turned down, a fault that
resembles another one, a mechanism that multiplies rather than adds.

> Staleness is stamped, not compared. → Staleness is stamped.

**A heading written as a phrase where a noun would do.** Name the subject. Keep
a phrase only where the section answers a question the reader asks in those
words — an FAQ entry, or a `Why ...` section whose point is the reasoning.

> Where the file goes → Output · What you need before starting → Requirements

**A heading that says what a thing is not.** A reader scanning a contents list
gets nothing from a negative. The exception is a heading whose whole content is
a distinction: "Chaotic is not the same as wild" is the finding of the section
under it, and a positive rewrite states a conclusion the section never reached.

> What it does not do → Limitations · Deliberately not this → Out of scope

**A pronoun centring the program.** A paragraph opening on "it" makes the
software the subject of everything and leaves a reader arriving by deep link
with no antecedent. Name the actor: the renderer, the command, the panel.

> It runs the app's own engine. → The renderer runs the app's own engine.

**A mannered inversion or a dropped subject.** Fronting the complement, or
opening on "So", "And" or "Hence" carrying the previous sentence's subject.

> Which latency is now known: the lane's own. → The latency is now known, and it
> is the lane's own.

**Cute naming in a reference table.** A flag table, a keyboard table and a
column header are read by someone looking one thing up, and a joke costs them a
second pass.

> `--seed=<n>` | the dice → `--seed=<n>` | random seed; the same seed gives the
> same file

**A rule-of-three list doing a sentence's work.** Three parallel fragments with
the verbs dropped, standing where one sentence with a subject belongs.

> A look off the address bar, a file in, ProRes 4444 out. → The look comes off
> the address bar and the picture out of the file, and the output is
> ProRes 4444.

**Two clauses stacked on one "so".** A sentence that reaches a conclusion and
then reaches another one wants splitting; the second conclusion is what the
reader loses.

> …so a runtime with no bundler can load them, so a look renders here as on
> screen. → …so a runtime with no bundler can load them. A look therefore
> renders here the way it renders on screen.

**Em-dash asides doing the work of clauses.** One in a paragraph is punctuation;
three is a writer avoiding sentence boundaries. Promote one to its own sentence,
demote one to a comma, keep the one that is genuinely parenthetical.

## Voice, register and terminology

A checklist misses these three, because each looks like the house voice around
it.

**A value given a stance.** A component may speak — a track, a lane, a file or a
caller can say, report or refuse — but a value may not: a sign, a flag, a column
or a coordinate is a thing being described, so it holds no opinion and disagrees
with nothing. The same covers a subject given a will, since "a strain breaks
from the backbone" describes an absence of alignment. A sentence that gives an
artifact a purpose does it too: "the choice it exists to offer".

> The test is two ends on the backbone with signs that disagree. → A breakpoint
> link has rank 0 at both ends, one ending in `+` and the other in `-`.

**A technical term given a personality.** Keep the term the tools use, since
`--reference backbone` is what minigraph calls it and renaming it costs the
reader the word they meet in the manual; fix the sentence around it instead.

> stated as an orientation disagreement between two backbone segments → a pair
> of backbone segments entered in opposite orientations

**An informalism in a formal register.** A word can be exactly right in a
tutorial and wrong in a manuscript, so the test is the document rather than the
word. An intensifier with no number behind it is the same slip in a document
that quantifies everything else: `dramatically simpler`, `greatly reduced`.

> uploading to the graphics card is slow → uploading to the GPU is slow

## A rule that breaks its own rule teaches the break

`website/docs/tutorials/CLAUDE.md` in the JBrowse repository opens with "No
em-dashes anywhere, including code comments", in a sentence that contained one,
and the file held fifteen more. A style rule is read as prose before it is read
as a rule, and the prose is the part that gets imitated. A rule illustrated with
a violation ships the violation.

## Not a problem here, worth knowing

[Wikipedia's signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
lists habits this repo has not had, all cheap to grep for on anything written
from outside: promotional adjectives (`vibrant`, `groundbreaking`, `boasts`),
vague attribution (`industry reports`, `observers have cited`),
present-participle synthesis (`highlighting the importance of`,
`underscoring its role`), the `Challenges and Future Prospects` section, and the
cluster around `delve`, `tapestry`, `testament`, `showcase`, `pivotal`. Watch
the participle: `…, highlighting how the two stages interact` is a claim with
nobody making it, so write the claim as its own sentence or drop it.

## What not to flatten

- **The claim.** A rewrite that changes what a sentence asserts is worse however
  plain it reads. "Chaotic is not the same as wild" rewritten as "Wildness is
  large coherent structure" says something its section does not support.
- **An author's established idiom.** One flagged instance is not licence to
  sweep a device used deliberately and consistently — forty of "the bubbles say
  where the graph varies" in one corpus are a voice. Fix the value that borrowed
  it.
- **A term the tools use.** Renaming `--reference backbone` in prose leaves the
  reader without the word the manual uses.
- **The measurement.** Numbers, file paths and the names of mechanisms are the
  content. A prose pass moves sentences around them and changes none of them.
- **The author's own voice** in `README.md`. "Tasty WebGPU signal-level analog
  video emulation" is written by a person and reads like one.
- **The distinctions an ADR is about.** A record that names the option it
  declined needs both halves.
- **Generated prose.** `EFFECTS.md`, `llms.txt`, `llms-full.txt` and the loop
  block in `FEATURES.md` come from `src/ui/controls.ts` via `pnpm docgen`, so an
  edit to the output lasts until the next build. Fix the control table.
