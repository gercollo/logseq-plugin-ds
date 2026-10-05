import { createServer, IncomingHttpHeaders } from 'node:http';
import { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { ChatMessage } from '../src/chat';
import { verifyWithSearch } from '../src/verify';

it('completes a search conversation through a real compatible HTTP endpoint', async () => {
  const requests: { url: string; headers: IncomingHttpHeaders; body: { messages: ChatMessage[]; temperature?: number; model: string } }[] = [];
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    requests.push({ url: request.url ?? '', headers: request.headers, body: JSON.parse(text) });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ choices: [{
      message: requests.length === 1
        ? { content: null, tool_calls: [{ id: 'search-1', type: 'function', function: { name: 'web_search', arguments: '{"query":"test question"}' } }] }
        : { content: 'Answer from the search result.' },
      finish_reason: requests.length === 1 ? 'tool_calls' : 'stop',
    }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const result = await verifyWithSearch(
      [{ role: 'system', content: 'Answer using web_search.' }, { role: 'user', content: 'test question' }],
      { apiKey: '', basePath: `http://127.0.0.1:${port}/custom/v1?version=test`, model: 'local-model', extraHeaders: { 'api-key': 'custom-key' } },
      { search: async () => ({ hits: [{ title: 'Evidence', url: 'https://example.com/evidence', content: 'A source for the answer.' }] }) },
    );
    expect(result.content).toBe('Answer from the search result.');
    expect(result.queries).toEqual(['test question']);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url).toBe('/custom/v1/chat/completions?version=test');
      expect(request.headers.authorization).toBeUndefined();
      expect(request.headers['api-key']).toBe('custom-key');
      expect(request.body.model).toBe('local-model');
      expect(request.body).not.toHaveProperty('temperature');
    }
    expect(requests[1].body.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'search-1' });
    expect(requests[1].body.messages.at(-1)?.content).toContain('https://example.com/evidence');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
