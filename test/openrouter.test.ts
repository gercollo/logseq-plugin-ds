import { describe, expect, it } from 'vitest';
import { ChatMessage, chat } from '../src/chat';
import { verifyWithSearch } from '../src/verify';

const OPTIONS = {
  apiKey: 'openrouter-test-key',
  basePath: 'https://openrouter.ai/api/v1',
  model: 'example/reasoning-model:variant',
  extraHeaders: {
    'HTTP-Referer': 'https://github.com/gercollo/logseq-plugin-ds',
    'X-OpenRouter-Title': 'Logseq AI Assistant',
  },
};

const tool = (id: string, query: string) => ({
  id, type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query }) },
});

describe('OpenRouter compatibility', () => {
  it.each([
    { reasoning: 'Need evidence before answering.' },
    { reasoning_details: [
      { type: 'reasoning.text', text: 'Need evidence.', signature: 'signature', index: 0 },
      { type: 'reasoning.encrypted', data: 'opaque-test-data', format: 'provider-format', index: 1 },
    ] },
  ])('preserves reasoning across multiple tool rounds: %j', async (reasoning) => {
    const requests: { url: string; headers: Headers; body: { messages: ChatMessage[]; model: string; stream: boolean } }[] = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      const round = requests.length;
      return new Response(JSON.stringify({ choices: [{
        message: round < 3
          ? { role: 'assistant', content: null, ...reasoning, tool_calls: [tool(`search-${round}`, `query ${round}`)] }
          : { role: 'assistant', content: 'Answer with evidence.', ...reasoning },
        finish_reason: round < 3 ? 'tool_calls' : 'stop',
      }] }));
    };
    const result = await verifyWithSearch([{ role: 'user', content: 'A claim to check.' }], { ...OPTIONS, fetch }, {
      search: async () => ({ hits: [{ title: 'Source', url: 'https://example.com/source', content: 'Evidence.' }] }),
    });
    expect(result.content).toBe('Answer with evidence.');
    expect(result.queries).toEqual(['query 1', 'query 2']);
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(request.headers.get('Authorization')).toBe('Bearer openrouter-test-key');
      expect(request.headers.get('HTTP-Referer')).toBe(OPTIONS.extraHeaders['HTTP-Referer']);
      expect(request.headers.get('X-OpenRouter-Title')).toBe('Logseq AI Assistant');
      expect(request.body.model).toBe(OPTIONS.model);
      expect(request.body.stream).toBe(false);
    }
    const assistants = requests[2].body.messages.filter((message) => message.role === 'assistant');
    expect(assistants).toHaveLength(2);
    for (const [index, assistant] of assistants.entries()) {
      expect(assistant).toEqual({ role: 'assistant', content: '', ...reasoning, tool_calls: [tool(`search-${index + 1}`, `query ${index + 1}`)] });
    }
    expect(requests[2].body.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'search-2' });
  });

  it('does not treat reasoning without answer text or tool calls as an answer', async () => {
    const fetch: typeof globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{
      message: { content: null, reasoning: 'Only thinking.', reasoning_details: [{ type: 'reasoning.text', text: 'Only thinking.' }] },
      finish_reason: 'length',
    }] }));
    await expect(chat([{ role: 'user', content: 'Question' }], { ...OPTIONS, fetch }))
      .rejects.toThrow('The model hit the output length limit before producing an answer.');
  });

  it('ignores malformed reasoning fields without changing the answer', async () => {
    const fetch: typeof globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{
      message: { content: 'Answer.', reasoning: { text: 'Invalid' }, reasoning_details: 'Invalid' }, finish_reason: 'stop',
    }] }));
    expect(await chat([{ role: 'user', content: 'Question' }], { ...OPTIONS, fetch }))
      .toEqual({ content: 'Answer.', finishReason: 'stop' });
  });
});
