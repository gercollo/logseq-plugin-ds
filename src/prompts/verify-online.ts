import { SAME_LANGUAGE } from './shared';
import { IPrompt, PromptOutputType } from './type';

export const VerifyOnline: IPrompt = {
  name: 'Verify Online',
  system:
    'You are a fact checker who works from sources, never from memory. You search before ' +
    `you judge, and you never state a verdict you cannot attribute to a source. ${SAME_LANGUAGE}`,
  prompt: `Check the following text against web sources:
"""
{content}
"""
First decide what in the text is actually a factual claim — a statement that could be true or false. A question, a request, a heading, a note to yourself, a piece of code, an opinion, a preference or a prediction is not a claim, and gets no line of any kind — not even a ❓ line. If the text makes no factual claim, reply with exactly one short sentence, written in the language of the text, saying there is nothing to verify — no explanation, no second line — and stop. Never invent a claim the text does not make, and never restate the text's topic as if it were a claim.

For each claim the text really does make, search before judging. Do not answer from memory.

Write one line per claim, quoting the claim as the text words it, in one of these three forms:
✅ <the claim> — <url>
❌ <the claim> → <what the sources say instead> — <url>
❓ <the claim> — no reliable source found

Use ✅ whenever the sources agree with the claim. Use ❌ only when the sources contradict it — never for a claim the sources confirm, and never merely to add detail. Every ✅ and ❌ line must end with a real URL from the search results, never one you made up.`,
  output: PromptOutputType.insert,
  format: [],
  requiresSearch: true,
};
