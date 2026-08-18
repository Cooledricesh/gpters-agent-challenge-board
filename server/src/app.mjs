import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const UUID = z.string().uuid();
const StudentCreate = z.object({
  nickname: z.string().trim().min(1).max(64),
  passwordHash: z.string().min(20).max(200),
});
const StudentPassword = z.object({ id: UUID, passwordHash: z.string().min(20).max(200) });
const StudentDelete = z.object({ id: UUID });
const AuthLookup = z.object({ nickname: z.string().min(1).max(64) });
const CompletionToggle = z.object({ userId: UUID, challengeId: UUID, done: z.boolean() });
const ChallengeArea = z.enum([
  "start", "channel", "automation", "content", "operations", "integrations",
  "orchestration", "build", "voice-ui", "edge", "other",
]);
const ChallengeCreate = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  level: z.enum(["basic", "advanced"]).optional(),
  area: ChallengeArea.nullable().optional(),
  tier: z.number().int().min(1).max(3).optional(),
  prerequisiteId: UUID.nullable().optional(),
});
const ChallengeUpdate = ChallengeCreate.partial().extend({ id: UUID });

function digest(value) {
  return createHash("sha256").update(value).digest();
}

function validToken(header, expected) {
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice(7)), digest(expected));
}

const RATE_WINDOW_MS = 60_000;
const MAX_RATE_BUCKETS = 64;
const RATE_ROUTES = new Set([
  "GET:/v1/board",
  "POST:/v1/auth/lookup",
  "POST:/v1/completions/toggle",
  "POST:/v1/admin/students",
  "PATCH:/v1/admin/students",
  "DELETE:/v1/admin/students",
  "POST:/v1/admin/challenges",
  "PATCH:/v1/admin/challenges",
]);

function rateBucketKey(authorized, method, path) {
  const normalizedMethod = ["GET", "POST", "PATCH", "DELETE"].includes(method) ? method : "OTHER";
  if (!authorized) return `invalid:${normalizedMethod}`;
  const route = `${normalizedMethod}:${path}`;
  return `authorized:${RATE_ROUTES.has(route) ? route : "other"}`;
}

function consumeRateLimit(buckets, key, timestamp) {
  for (const [existingKey, bucket] of buckets) {
    if (timestamp - bucket.windowStart >= RATE_WINDOW_MS) buckets.delete(existingKey);
  }

  const current = buckets.get(key);
  if (current) {
    current.count += 1;
    return current.count <= 120;
  }

  if (buckets.size >= MAX_RATE_BUCKETS) buckets.delete(buckets.keys().next().value);
  buckets.set(key, { windowStart: timestamp, count: 1 });
  return true;
}

function send(res, status, payload, requestId) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  });
  res.end(body);
}

async function readJson(req, limit = 65_536) {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > limit) throw Object.assign(new Error("body_too_large"), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("body_too_large"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("invalid_json"), { status: 400 });
  }
}

export function createHandler({ repository, serviceToken, logger = console, now = () => Date.now() }) {
  const buckets = new Map();
  let healthCache;

  return async function handler(req, res) {
    const requestId = randomUUID();
    const started = now();
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = req.method ?? "GET";
    let status = 500;

    try {
      if (method === "GET" && path === "/health") {
        if (!healthCache || started >= healthCache.expiresAt) {
          const health = await repository.health();
          const ready = health.schema_ready === true;
          healthCache = {
            expiresAt: started + 5_000,
            status: ready ? 200 : 503,
            payload: { status: ready ? "ok" : "not_ready" },
          };
        }
        status = healthCache.status;
        return send(res, status, healthCache.payload, requestId);
      }

      if (req.headers.origin) {
        status = 403;
        return send(res, status, { ok: false, error: "browser_origin_forbidden" }, requestId);
      }

      const authorization = req.headers.authorization;
      const authorized = validToken(authorization, serviceToken);
      const bucketKey = rateBucketKey(authorized, method, path);
      if (!consumeRateLimit(buckets, bucketKey, now())) {
        status = 429;
        return send(res, status, { ok: false, error: "rate_limited" }, requestId);
      }
      if (!authorized) {
        status = 401;
        return send(res, status, { ok: false, error: "unauthorized" }, requestId);
      }

      if (method === "GET" && path === "/v1/board") {
        status = 200;
        return send(res, status, { ok: true, data: await repository.board() }, requestId);
      }
      if (method === "POST" && path === "/v1/auth/lookup") {
        const input = AuthLookup.parse(await readJson(req));
        status = 200;
        return send(res, status, { ok: true, user: await repository.findUserByNickname(input.nickname) }, requestId);
      }
      if (method === "POST" && path === "/v1/completions/toggle") {
        const input = CompletionToggle.parse(await readJson(req));
        status = 200;
        return send(res, status, { ok: true, ...(await repository.toggleCompletion(input)) }, requestId);
      }
      if (method === "POST" && path === "/v1/admin/students") {
        const input = StudentCreate.parse(await readJson(req));
        status = 201;
        return send(res, status, { ok: true, student: await repository.createStudent(input) }, requestId);
      }
      if (method === "PATCH" && path === "/v1/admin/students") {
        const input = StudentPassword.parse(await readJson(req));
        const student = await repository.updateStudentPassword(input);
        status = student ? 200 : 404;
        return send(res, status, student ? { ok: true, student } : { ok: false, error: "not_found" }, requestId);
      }
      if (method === "DELETE" && path === "/v1/admin/students") {
        const input = StudentDelete.parse(await readJson(req));
        const student = await repository.deleteStudent(input);
        status = student ? 200 : 404;
        return send(res, status, student ? { ok: true, student } : { ok: false, error: "not_found" }, requestId);
      }
      if (method === "POST" && path === "/v1/admin/challenges") {
        const input = ChallengeCreate.parse(await readJson(req));
        status = 201;
        return send(res, status, { ok: true, challenge: await repository.createChallenge(input) }, requestId);
      }
      if (method === "PATCH" && path === "/v1/admin/challenges") {
        const input = ChallengeUpdate.parse(await readJson(req));
        const challenge = await repository.updateChallenge(input);
        status = challenge ? 200 : 404;
        return send(res, status, challenge ? { ok: true, challenge } : { ok: false, error: "not_found" }, requestId);
      }

      status = 404;
      return send(res, status, { ok: false, error: "not_found" }, requestId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        status = 400;
        return send(res, status, { ok: false, error: "invalid_input" }, requestId);
      }
      if (error?.status === 400 || error?.status === 413) {
        status = error.status;
        return send(res, status, { ok: false, error: error.message }, requestId);
      }
      if (error?.code === "nickname_conflict" || error?.code === "23505") {
        status = 409;
        return send(res, status, { ok: false, error: "conflict" }, requestId);
      }
      logger.error(JSON.stringify({
        level: "error",
        event: "request_failed",
        requestId,
        method,
        path,
        code: error?.code ?? "unknown",
      }));
      status = 500;
      return send(res, status, { ok: false, error: "internal_error" }, requestId);
    } finally {
      logger.info(JSON.stringify({
        level: "info",
        event: "request_complete",
        requestId,
        method,
        path,
        status,
        durationMs: now() - started,
      }));
    }
  };
}
