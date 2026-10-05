import { describe, expect, it } from 'vitest';
import { ChatMessage, chat } from '../src/chat';
import { chatOptionsFor } from '../src/plugin';
import { AskAI } from '../src/prompts';
import { readSettings } from '../src/settings';
import { verifyWithSearch } from '../src/verify';

const OPTIONS = chatOptionsFor(readSettings({
  apiKey: 'xai-test-key', basePath: 'https://api.x.ai/v1', model: 'grok-4.7',
  sendTemperature: false, temperature: '0.3',
}), AskAI);

describe('Grok / xAI compatibility', () => {
  it('uses the direct xAI endpoint and server sampling defaults', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Answer in the input language.' },
      { role: 'user', content: 'What is 101 times 3?' },
    ];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.x.ai/v1/chat/completions');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer xai-test-key');
      expect(JSON.parse(String(init?.body))).toEqual({ model: 'grok-4.7', messages, stream: false });
      return new Response(JSON.stringify({
        id: 'xai-completion', object: 'chat.completion', model: 'grok-4.7',
        choices: [{ index: 0, message: { role: 'assistant', content: '303.', refusal: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 32, completion_tokens: 9, total_tokens: 135, completion_tokens_details: { reasoning_tokens: 94 } },
      }));
    };
    expect(await chat(messages, { ...OPTIONS, fetch })).toEqual({ content: '303.', finishReason: 'stop' });
  });

  it('returns each function result before continuing the conversation', async () => {
    const calls = ['first', 'second'].map((id) => ({
      id, type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query: id }) },
    }));
    let round = 0;
    const queries: string[] = [];
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.tools[0].function.name).toBe('web_search');
      expect(body).not.toHaveProperty('temperature');
      if (++round === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: calls }, finish_reason: 'tool_calls' }] }));
      }
      expect(body.messages[1]).toEqual({ role: 'assistant', content: '', tool_calls: calls });
      expect(body.messages.slice(2).map((message: ChatMessage) => [message.role, message.tool_call_id]))
        .toEqual([['tool', 'first'], ['tool', 'second']]);
      expect(body.messages[2].content).toContain('https://example.com/first');
      expect(body.messages[3].content).toContain('https://example.com/second');
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Answer citing both sources.' }, finish_reason: 'stop' }] }));
    };
    const result = await verifyWithSearch([{ role: 'user', content: 'Check these claims.' }], { ...OPTIONS, fetch }, {
      search: async (query) => {
        queries.push(query);
        return { hits: [{ title: query, url: `https://example.com/${query}`, content: 'Evidence.' }] };
      },
    });
    expect(round).toBe(2);
    expect(queries).toEqual(['first', 'second']);
    expect(result.content).toBe('Answer citing both sources.');
  });
});
