export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchMock {
  calls: string[];
  restore: () => void;
}

export function mockFetch(responses: MockResponse[]): FetchMock {
  const original = globalThis.fetch;
  const calls: string[] = [];
  let i = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    if (i >= responses.length) {
      throw new Error(`mockFetch: no scripted response for call #${i + 1} (${url})`);
    }
    const r = responses[i++];
    return new Response(r.body ?? "", {
      status: r.status,
      headers: r.headers ?? {},
    });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
