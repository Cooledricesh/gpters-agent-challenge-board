import { beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("NasRepository", () => {
  it("shares one board request across concurrent list calls", async () => {
    vi.stubEnv("NAS_API_BASE_URL", "https://nas.example.test");
    vi.stubEnv("NAS_API_SERVICE_TOKEN", "test-token");
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      data: { users: [], challenges: [], examples: [], completions: [] },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { NasRepository } = await import("./nas-repository");
    const repository = new NasRepository();

    await Promise.all([
      repository.listStudents(),
      repository.listChallenges(),
      repository.listExamples(),
      repository.listCompletions(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[0]).toBe("https://nas.example.test/v1/board");
  });

  it("does not keep a rejected board request cached", async () => {
    vi.stubEnv("NAS_API_BASE_URL", "https://nas.example.test");
    vi.stubEnv("NAS_API_SERVICE_TOKEN", "test-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: false }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: { users: [], challenges: [], examples: [], completions: [] },
      }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { NasRepository } = await import("./nas-repository");
    const repository = new NasRepository();

    await expect(repository.listStudents()).rejects.toThrow("NAS API request failed (503)");
    await expect(repository.listStudents()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends plain completion mutation and invalidates the board cache", async () => {
    vi.stubEnv("NAS_API_BASE_URL", "https://nas.example.test");
    vi.stubEnv("NAS_API_SERVICE_TOKEN", "test-token");
    const board = { users: [], challenges: [], examples: [], completions: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: board }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, done: true, completion: null }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: board }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { NasRepository } = await import("./nas-repository");
    const repository = new NasRepository();

    await repository.listStudents();
    await repository.toggleCompletion({
      userId: "10000000-0000-4000-8000-000000000001",
      challengeId: "20000000-0000-4000-8000-000000000001",
      done: true,
    });
    await repository.listStudents();

    const mutation = fetchMock.mock.calls[1];
    expect(mutation[0]).toBe("https://nas.example.test/v1/completions/toggle");
    expect(mutation[1]).toMatchObject({ method: "POST" });
    expect((mutation[1]?.headers as Record<string, string>)["x-operation-id"]).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects a non-true success envelope", async () => {
    vi.stubEnv("NAS_API_BASE_URL", "https://nas.example.test");
    vi.stubEnv("NAS_API_SERVICE_TOKEN", "test-token");
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: "true", data: {} })) as unknown as typeof fetch;
    const { NasRepository } = await import("./nas-repository");
    await expect(new NasRepository().listStudents()).rejects.toThrow("invalid success response");
  });
});
