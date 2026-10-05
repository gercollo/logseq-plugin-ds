/** Generate the English prompt reference and fail when it drifts from the source. */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe as group, expect, it } from 'vitest';
import { presetPrompts } from '../src/prompts';
import { IPrompt } from '../src/prompts/type';

const LANGS = {
  en: {
    file: 'built-in-prompts.md',
    back: '[← readme](../readme.md)',
    title: 'The built-in prompts',
    intro: `Every command's prompt, exactly as it is sent. This file is generated from the code
by \`pnpm docs:prompts\` — edit the prompts, not this.

Copy one as the starting point for your own version: a [custom prompt](./custom-prompts.md)
whose \`name\` matches a built-in one replaces it, keeping its place in the slash menu. **Once you
do that, later fixes to that command stop reaching you** — the prompts here have been through
several rounds of measured correction, and your copy is frozen at the day you took it.`,
    fields: { output: 'Output', format: 'Format', model: 'Model', search: 'Needs a search key' },
    system: 'System',
    user: 'Prompt',
  },
} as const;

interface Labels {
  output: string;
  format: string;
  model: string;
  search: string;
}

function describe(p: IPrompt, f: Labels): string[] {
  const rows = [`${f.output}: \`${p.output}\``];
  if (p.format !== undefined) rows.push(`${f.format}: \`${JSON.stringify(p.format)}\``);
  if (p.model) rows.push(`${f.model}: \`${p.model}\``);
  if (p.requiresSearch) rows.push(`${f.search}`);
  return rows;
}

function render(lang: (typeof LANGS)[keyof typeof LANGS]): string {
  const parts = [`# ${lang.title}`, '', lang.back, '', lang.intro, ''];
  for (const p of presetPrompts) {
    parts.push(`## /${p.name}`, '', describe(p, lang.fields).join(' · '), '');
    if (p.system) parts.push(`**${lang.system}**`, '', '```text', p.system, '```', '');
    parts.push(`**${lang.user}**`, '', '```text', p.prompt, '```', '');
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n');
}

const path = (file: string) => join(__dirname, '..', 'docs', file);

group('the built-in prompt reference', () => {
  for (const lang of Object.values(LANGS)) {
    it(`${lang.file} matches the prompts`, () => {
      const wanted = render(lang);
      if (process.env.WRITE_DOCS) {
        writeFileSync(path(lang.file), wanted);
        return;
      }
      const have = readFileSync(path(lang.file), 'utf8');
      expect(have, `${lang.file} is out of date — run \`pnpm docs:prompts\``).toBe(wanted);
    });
  }
});
