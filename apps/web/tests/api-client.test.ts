import { ApiClient } from '../../../packages/shared/src/api-client';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ApiClient — tolerância sem duplicar escrita', () => {
  it('repete GET após falha de rede e preserva a resposta bem-sucedida', async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response(200, { ok: true }));
    const client = new ApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl,
      timeoutMs: 2_000,
    });

    await expect(client.get('/conversas')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('repete GET em 503, mas nunca repete POST implicitamente', async () => {
    const getFetch = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(response(503, { message: 'voltando' }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    const getClient = new ApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: getFetch,
    });
    await expect(getClient.get('/resumo')).resolves.toEqual({ ok: true });
    expect(getFetch).toHaveBeenCalledTimes(2);

    const postFetch = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    const postClient = new ApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: postFetch,
    });
    await expect(postClient.post('/mensagens', { text: 'não duplicar' })).rejects.toThrow(
      'Failed to fetch',
    );
    expect(postFetch).toHaveBeenCalledTimes(1);
  });
});
