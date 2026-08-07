---
name: saywise-article
description: Use this when the user asks to write an article for Saywise — a long-form telling of a project, build, debug, or decision. Structures the piece as a real story, writes it so it reads human (the unslop style contract), plans image placeholders for the editor, and presents one finished article for the user to post on their Saywise profile.
---

# Writing a Saywise article that tells a story

## When to trigger

Trigger when the user wants long-form, not a quick post:

- "Write an article about this project for Saywise"
- "Tell the story of this migration on my profile"
- "/saywise-article" (the explicit slash command)

For a short share of the current session, the `saywise-stories` skill's `post` format is the right lane. This skill produces exactly **one `article` draft** per call — long-form earns its length or shouldn't exist.

## How to tell the story

An article is a story about work, not documentation of it. The reader should feel the problem before they hear the solution.

1. **Open on the specific moment.** The failing dashboard, the number that made someone swear, the ticket nobody wanted. Never open with scene-setting ("In today's fast-paced world of AI development…") — start where it hurts.
2. **Stakes, in one or two sentences.** Why did this matter to the author? Time, money, pride, users — name the real one.
3. **The middle is the wrong turns.** What was tried first, why it failed, what the failure taught. A story where the first attempt works isn't a story. Include the decision that actually mattered and what it traded away.
4. **Resolve with specifics.** Real numbers if they exist ("cold starts dropped from 8s to 900ms"), a shipped thing, a before/after. If there's no number, don't invent one — a concrete observation beats a fake metric.
5. **End on a specific, not a moral.** What surprised the author, what they'd do differently, the one thing they'd tell someone doing this next week. Never a summary paragraph, never "In conclusion".

Aim for 200–400 words. First person, past tense — the user is the protagonist and the AI tools are supporting cast. Every claim must be grounded in what the user actually did (from the session or from what they tell you); if a fact wasn't established, ask or omit.

## Write like a person

Load the **`unslop`** skill and write under its full contract — the banned vocabulary
(including the engineering LLM-isms like "surface", "shape", "gate"), the structural
and formatting tells, the rhythm rules — then run its final pass on the finished draft
before submitting. That contract is shared by every Saywise writing skill; this skill
adds only what is article-specific. If `unslop` isn't installed, ask the user to add
it (it ships in the same plugin/repo) rather than approximating it from memory.

## Images

**Do not embed Markdown images** (`![alt](url)`) in the article body — images enter a
Saywise article through the editor's image upload when the user posts it.

Plan for images anyway — they carry story beats:

- Where an image belongs, drop an italic placeholder in the body: `*[Add screenshot: the failing build matrix]*`.
- **Prefer the user's real artifacts** — a screenshot from the project's README, a diagram committed to the repo, the graph pasted into a PR. Name the specific artifact in the placeholder so the user knows exactly what to upload.
- **Never suggest stock photos.** A generic workspace photo is itself an AI tell.
- When you hand the article over, tell the user which placeholders to replace with the editor's image upload.

One or two images placed where they carry the story beat the same images stacked at the top.

## Deliver

Present the finished piece — title on its own line, then the body — ready to copy. The title follows the same style contract: specific and sentence case ("Cutting our Lambda cold starts by 8x", not "A Journey of Optimization"). Point the user at the Saywise composer (https://saywise.com/posts/new) to post it, name the image placeholders they should fill with the editor's upload, and offer one round of edits. You post nothing yourself.

## Common pitfalls

- **Don't summarize the session — narrate it.** Chronology with stakes, not a changelog.
- **Don't launder the style contract.** Rewriting "delve" as "dive deep" misses the point; cut the filler thought, don't re-dress it.
- **Don't embed image URLs.** Placeholders + editor uploads are the only image path; a hotlinked Markdown image renders as text.
- **One article, not an article plus a post.** If the user also wants a short version, ask first.
