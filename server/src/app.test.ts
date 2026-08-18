import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "./app.mjs";

const token = "test-service-token-that-is-at-least-32-characters";
const servers: http.Server[] = [];

async function start(repository: Record<string, unknown>) {
  const logger = { info: vi.fn(), error: vi.fn() };
  const handler = createHandler({ repository, serviceToken: token, logger: logger as unknown as Console });
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test address");
  return { base: `http://127.0.0.1:${address.port}`, logger };
}

function headers() {
  return { authorization: "Bearer " + token, "content-type": "application/json" };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("NAS API handler", () => {
  it("serves cached health without exposing database details", async () => {
    const health = vi.fn(async () => ({ schema_ready: true, database: "hidden", role: "hidden" }));
    const { base } = await start({ health });
    const first = await fetch(`${base}/health`);
    const second = await fetch(`${base}/health`);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "ok" });
    expect(second.status).toBe(200);
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("rejects missing, bad and browser-origin service requests", async () => {
    const { base } = await start({ board: async () => ({}) });
    expect((await fetch(`${base}/v1/board`)).status).toBe(401);
    expect((await fetch(`${base}/v1/board`, {
      headers: { authorization: "Bearer wrong" },
    })).status).toBe(401);
    expect((await fetch(`${base}/v1/board`, {
      headers: { authorization: "Bearer " + token, origin: "https://example.com" },
    })).status).toBe(403);
  });

  it("bounds bad-token rate-limit state across arbitrary paths", async () => {
    const { base } = await start({});
    const responses = await Promise.all(Array.from({ length: 121 }, (_, index) =>
      fetch(`${base}/v1/unknown-${index}`, {
        headers: { authorization: `Bearer wrong-${index}` },
      })));
    expect(responses.slice(0, 120).every((response) => response.status === 401)).toBe(true);
    expect(responses[120].status).toBe(429);
  });

  it("returns protected board data", async () => {
    const data = { users: [], challenges: [], examples: [], completions: [] };
    const { base } = await start({ board: async () => data });
    const response = await fetch(`${base}/v1/board`, { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data });
  });

  it("validates request bodies without logging secrets or bodies", async () => {
    const repository = { findUserByNickname: vi.fn() };
    const { base, logger } = await start(repository);
    const response = await fetch(`${base}/v1/auth/lookup`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ nickname: "" }),
    });
    expect(response.status).toBe(400);
    expect(repository.findUserByNickname).not.toHaveBeenCalled();
    const logs = JSON.stringify([logger.info.mock.calls, logger.error.mock.calls]);
    expect(logs).not.toContain(token);
    expect(logs).not.toContain("nickname");
  });

  it("forwards completion toggles directly without migration headers", async () => {
    const toggleCompletion = vi.fn(async () => ({ done: true, completion: null }));
    const { base } = await start({ toggleCompletion });
    const input = {
      userId: "10000000-0000-4000-8000-000000000001",
      challengeId: "20000000-0000-4000-8000-000000000001",
      done: true,
    };
    const response = await fetch(`${base}/v1/completions/toggle`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(200);
    expect(toggleCompletion).toHaveBeenCalledWith(input);
    expect(await response.json()).toEqual({ ok: true, done: true, completion: null });
  });

  it("preserves the required admin student and challenge endpoints", async () => {
    const createStudent = vi.fn(async () => ({ id: "u", nickname: "n" }));
    const createChallenge = vi.fn(async () => ({ id: "c", title: "t" }));
    const { base } = await start({ createStudent, createChallenge });

    const student = await fetch(`${base}/v1/admin/students`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ nickname: "new-user", passwordHash: "x".repeat(30) }),
    });
    const challenge = await fetch(`${base}/v1/admin/challenges`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ title: "new challenge" }),
    });
    expect(student.status).toBe(201);
    expect(challenge.status).toBe(201);
    expect(createStudent).toHaveBeenCalledOnce();
    expect(createChallenge).toHaveBeenCalledOnce();
  });

  it("maps duplicate names to conflict without leaking details", async () => {
    const conflict = Object.assign(new Error("sensitive"), { code: "nickname_conflict" });
    const { base } = await start({ createStudent: vi.fn().mockRejectedValue(conflict) });
    const response = await fetch(`${base}/v1/admin/students`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ nickname: "duplicate", passwordHash: "x".repeat(30) }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "conflict" });
  });
});
