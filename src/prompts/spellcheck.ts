import { REWRITE_RULES, SAME_LANGUAGE } from './shared';
import { IPrompt, PromptOutputType } from './type';

export const Spellcheck: IPrompt = {
  name: 'Spellcheck',
  system:
    'You correct spelling mistakes and obvious typing errors with the smallest possible edits. ' +
    `Preserve the author's wording and voice. ${SAME_LANGUAGE}`,
  prompt: `${REWRITE_RULES}

Correct only spelling mistakes and obvious typing errors in the following text.
Do not improve grammar, punctuation, style, tone or phrasing. Do not translate or change facts.
Keep the original meaning and every detail — do not add, remove or invent information.
Preserve line breaks, whitespace, capitalization and outline nesting; never merge or split points.
Leave Markdown markup, inline code, URLs, email addresses, file paths, hashtags, page references
like [[...]] and block references like ((...)) exactly as they are. Fenced code must remain unchanged.
Keep proper names and specialist terms unless a spelling correction is unambiguous.
When no correction is needed, return the original text exactly; never say "no errors found".
Preserve quotation marks that belong to the source. Do not add surrounding quotation marks,
triple-quote delimiter lines or a code fence around your reply.
The source text starts on the next line; return only that text with any spelling corrections:
{content}`,
  output: PromptOutputType.replace,
};
