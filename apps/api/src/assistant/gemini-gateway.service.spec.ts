import { BadGatewayException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiGatewayService } from './gemini-gateway.service';

describe('GeminiGatewayService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails over to the next key after a rate-limit response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text: 'OK' }] } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new GeminiGatewayService();

    const response = await gateway.generate('gemini-test', ['key-one', 'key-two'], {
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
    });

    expect(response.candidates?.[0]?.content?.parts[0]?.text).toBe('OK');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      'x-goog-api-key': 'key-one',
    });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({
      'x-goog-api-key': 'key-two',
    });
  });

  it('does not rotate keys for a non-retryable request error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new GeminiGatewayService();

    await expect(
      gateway.generate('invalid model', ['key-one', 'key-two'], {
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
