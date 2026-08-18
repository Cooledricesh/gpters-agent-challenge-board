import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("NAS data repository", () => {
  it("uses one NAS repository for both reads and writes", async () => {
    vi.stubEnv("NAS_API_BASE_URL", "https://nas.example.test");
    vi.stubEnv("NAS_API_SERVICE_TOKEN", "test-token");
    const data = await import("./index");
    expect(data.getDataRepository()).toBe(data.getDataRepository());
    expect(data.getDataRepository().constructor.name).toBe("NasRepository");
  });

  it("fails closed for malformed maintenance values", async () => {
    vi.stubEnv("MUTATIONS_PAUSED", "yes");
    const data = await import("./index");
    expect(() => data.requireMutationsEnabled()).toThrow("MUTATIONS_PAUSED");
  });

  it("blocks mutations only when explicitly paused", async () => {
    vi.stubEnv("MUTATIONS_PAUSED", "true");
    const data = await import("./index");
    let error: unknown;
    try {
      data.requireMutationsEnabled();
    } catch (caught) {
      error = caught;
    }
    expect(data.isMutationsPausedError(error)).toBe(true);
  });
});
