---
name: unslop
description: Shared anti-slop style contract - banned AI vocabulary (incl. engineering LLM-isms), structural and whole-piece tells, voice calibration, editing guardrails, and a final pass. Load before composing or de-slopping any text.
---

# unslop — the anti-slop style contract

The shared style contract for every Saywise writing skill (`saywise-stories`,
`saywise-article`, the scan skills' drafts). Load it before composing; run its final
pass before submitting. Sources: Wikipedia's editor-maintained _Signs of AI writing_
catalog, corpus studies of LLM word frequencies (words like "delve" and "it's important
to note" appear 50–269× more often in AI text than in human text), the tech-writing
LLM accent that survives even careful prompting, and the humanizer skill
(github.com/blader/humanizer), which works the same Wikipedia catalog into an editing
loop.

## The one principle

Slop is statistically average prose: correct, polished, and interchangeable. The fix is
never a synonym swap — it's replacing the vague thought with a specific one. A banned
word marks a spot where the writing went generic; cut the thought or make it concrete.
"Laundering" a tell ("delve" → "dive deep", "robust" → "battle-tested") is still slop.

## Voice calibration

When the user's own writing is available — previous Saywise posts, README prose, even
their messages in this session — read it before composing and match its habits:
sentence lengths, punctuation, recurring words, how paragraphs open. The sample
outranks this contract's style rules. If the user writes em dashes everywhere, keep
them; if their posts run terse, don't pad. Sounding like *them* beats scrubbing every
tell.

## Banned vocabulary

Never use these in composed prose. If one appears in the final pass, rewrite the
sentence around a specific fact instead of substituting a synonym.

**Verbs (figurative use):** delve, leverage, utilize, harness, foster, garner, bolster,
underscore, highlight (as analysis), showcase, elevate, empower, unlock, unleash,
streamline, supercharge, revolutionize, transform, navigate, embark, resonate,
encompass, cultivate, boast ("boasts a"), enhance, align ("aligns with").

**Nouns:** tapestry, testament, landscape, realm, journey, ecosystem (figurative),
synergy, paradigm, cornerstone, beacon, treasure trove, game-changer, powerhouse,
insights (unqualified), interplay.

**Adjectives:** crucial, pivotal, vital, paramount, robust, seamless, comprehensive,
multifaceted, intricate, meticulous, vibrant, invaluable, unparalleled, renowned,
groundbreaking, cutting-edge, state-of-the-art, transformative, ever-evolving,
deeply rooted, rich (figurative), profound, enduring, valuable (unqualified),
key (figurative: "key insight").

**Phrases:** it's important to note, it's worth noting/mentioning, in today's
fast-paced world, in the world/realm/age/era of, at the end of the day, when it comes
to, let's dive in, dive deep, deep dive, buckle up, look no further, the best part?,
whether you're a X or a Y, not only X but also Y, aims to / strives to / seeks to,
plays a crucial/key role, a key turning point, setting the stage for, marking a
pivotal moment, part of a broader shift, in conclusion, ultimately, overall, that
said, needless to say, the real question is, what really matters, here's what you
need to know, without further ado, in order to, due to the fact that, at this point
in time, has the ability to.

**Copula dodges:** "serves as", "stands as", "functions as", "acts as", "represents",
"marks", "is a testament to". Write "is" and "are".

## Engineering LLM-isms

The tech-blog accent — jargon that reads AI-generated (or AI-adjacent) in engineering
prose. Each entry: the tell → what to write instead.

- **surface** (verb: "surfaces errors") → show, display, report, raise, or name where it appears
- **shape** (abstract: "the shape of the API", "auth shape") → name the actual thing — the fields, the flow, the design
- **gate / gated** (verb: "gated behind a flag") → requires, checks, is hidden behind — name the mechanism
- **load-bearing** (figurative) → say what depends on it and what breaks without it
- **story** (suffix: "the error-handling story") → the error handling; how errors are handled
- **land / lands** ("the change lands") → merged, shipped, deployed
- **wire up / plumb through** → connect, pass, thread — or the concrete operation
- **sprinkle** ("sprinkle in caching") → add
- **first-class citizen** → supported directly; has its own API
- **under the hood** → internally, or just explain the mechanism
- **at its core** → cut it; start with the fact
- **battle-tested** → in production since [date/version]
- **blazingly fast** → the number
- **elegant / clean** (self-praise) → show the code or cut
- **powerful / flexible** → what it can do / what it lets you change
- **simply / just** (before instructions) → cut; if it were simple you wouldn't be explaining it
- **magic / magically** → explain the mechanism
- **footgun** → the specific mistake it invites
- **ergonomics / developer experience / DX** (as praise) → what got easier, shown
- **opinionated** → what it decides for you
- **-driven / -first / -native** compounds (AI-driven, mobile-first) → only when literal, never as praise
- **modern** (as praise) → cut, or date the thing it replaced

## Structural tells

- **Rule of three.** AI prose defaults to triplets ("fast, reliable, and scalable").
  Use two items, or four, or one.
- **Negative parallelism.** "Not just X, but Y", "it's not about X — it's about Y",
  "less X, more Y". State the positive claim directly.
- **-ing analysis tails.** Never end a sentence with ", highlighting…", ", ensuring…",
  ", reflecting…", ", underscoring…", ", showcasing…", ", contributing to…". If the
  analysis matters, give it its own plain sentence.
- **Elegant variation.** Repeat the word. "The parser… the parser" reads human; "the
  parser… the parsing apparatus" does not.
- **Vague authority.** "Experts say", "studies show", "many developers find",
  "industry reports". Name the source or make the claim as yourself.
- **Significance inflation.** A bug fix is a bug fix, not "a pivotal moment in the
  project's evolution". No "broader trends", no "lasting impact".
- **Hedge-then-assert.** "While results may vary, this approach is essential" — pick
  one.
- **Rhetorical-question pivots.** "The result?", "So what changed?", "Why does this
  matter?". Write the answer as a sentence.
- **Wrap-up endings.** No conclusion paragraph, no "In conclusion", no
  challenges-and-future-outlook section, no moral. End on a specific: what surprised
  you, what you'd do differently, the one thing you'd tell the next person.
- **False ranges.** "From the Big Bang to dark matter", "from startups to
  enterprises" — "from X to Y" where X and Y sit on no real scale. Name the actual
  items.
- **Staccato stacks.** One clipped sentence lands a point. Three in a row ("No
  config. No setup. No excuses.") is manufactured drama — write the plain clause
  back in.
- **Aphorism formulas.** "X is the Y of Z", "attention is the currency of…", "the
  architecture of trust". Replace the formula with the concrete claim it gestures at.
- **Fake-candid openers.** "Honestly?", "Here's the thing:", "Let's be honest" as a
  theatrical pause before an ordinary point. A person being honest just says the
  thing.
- **Tailing negations and subjectless fragments.** "…, no guessing" clipped onto a
  sentence; "No configuration file needed." as a whole one. Write the actor back in:
  "you don't need a config file".

## Whole-piece tells

A draft can pass every sentence-level check and still read generated. These live at
paragraph scale and above — after the word pass, reread the piece as a shape.

- **Survey symmetry.** N things compared, N paragraphs, similar length, same internal
  order (verdict → details → kicker): a comparison table wearing prose. Spend the
  words where the surprise was; a loser can be dismissed in one sentence.
- **Parallel openers.** Consecutive paragraphs opening on the item as grammatical
  subject ("Spotify does… Apple Music is… Last.fm won…"). Recast at least one around
  what you expected, tried, or read.
- **Kicker cadence.** One crafted quip per paragraph, delivered on schedule. Wit at
  uniform density reads manufactured; keep the best line and let the others go plain.
- **Pre-sorted knowledge.** Findings arrive in their final taxonomy with no trace of
  the order you learned them in. Real research has a sequence — the assumption going
  in, the fact found late that reframed the rest. Show it where it existed; never
  invent it.
- **Uniform confidence.** Every claim delivered with the same certainty. Mark what you
  haven't verified yourself: "the docs say", "I haven't tested past X". One honest
  hedge does more than ten synonym swaps.
- **The labeled takeaway.** "One thing to know before building:", "Worth noting:" — a
  pro-tip block in prose clothing. If the fact earns the ending, write it as the last
  sentence, without the badge.

## Formatting tells

- Headings in sentence case ("What broke first"), and only when length demands them.
- No bold-header bullet lists ("**Speed**: …") as the article's skeleton — prose
  carries stories; lists carry inventories.
- Bold sparingly or never. No emoji as structure. No "Key takeaways" block.
- Em dashes: fine occasionally; a tell in every paragraph. When trimming one, replace
  it with a period, comma, colon, or parentheses, whichever the sentence wants.
- No warm-up line after a heading that restates it ("## Performance" followed by
  "Speed matters."). Start with the content.
- Paragraphs of visibly different lengths. Seven same-size paragraphs is a tell on its
  own.

## Rhythm and voice

- Vary sentence length deliberately. Some short. Some that run on because the thought
  needs the room. Uniform medium sentences are the strongest single tell.
- First person, with decisions in it: "I ripped it out" beats "the component was
  removed".
- Concrete beats abstract every time: real error messages, named tools, actual
  numbers, file names, dates.
- One idea can just end. Not every paragraph needs a summary sentence.
- Keep at least one sentence a style guide would flag. If every sentence is polished,
  polish one down.

## Editing text you didn't write

The contract also runs standalone ("apply unslop to this"). Editing is not composing;
two guardrails apply, both from the humanizer skill:

- **Rewrite on clusters, not single tells.** One em dash means nothing; em dashes
  plus a rule-of-three plus "vibrant tapestry" plus a conclusion section is a
  confession. Polish, formal vocabulary, curly quotes, or one clipped sentence are
  not evidence on their own.
- **Preserve the human evidence.** Odd specifics ("the lawyer upstairs from my
  dentist"), mixed feelings left unresolved, self-corrections and asides, era-bound
  slang, deliberate quirks the writer could defend. Editing these away produces slop
  of a different kind: text that sounds like no one.

Leave quoted text, titles, and proper names alone even when they contain watched
phrases — a phrase being discussed is not a phrase being used.

## The final pass (run before submitting)

1. Search the draft for every banned word and LLM-ism above. Target: zero. Rewrite
   around specifics, don't substitute.
2. Check each sentence ending for -ing tails; each paragraph ending for wrap-ups.
3. Count list triplets — break them.
4. Read the sentence lengths. If three in a row are the same size, split or merge one.
5. The interchangeability test: if a sentence could appear unchanged in any tech blog,
   it's carrying no information — make it specific to this work or cut it.
6. Three or more tells in one paragraph means the paragraph went generic — rewrite the
   paragraph from its facts, don't patch the words.
7. Read only the paragraph openers, top to bottom. If they enumerate the things being
   compared, recast one around what you did or expected.
8. Count the quips. One per paragraph like clockwork — keep the best, flatten the
   rest.
9. Find where the piece admits sequence or uncertainty. If the work had either and
   the draft shows neither, put one back — a real one.
10. When editing rather than composing: check each rewrite was forced by a cluster of
    tells, and that the original's specifics, asides, and quirks survived.
