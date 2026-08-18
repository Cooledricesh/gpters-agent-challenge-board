import "server-only";

import { serverEnv } from "@/lib/env";
import type {
  CompletionDataRow,
  CreateChallengeInput,
  DataRepository,
  ExampleDataRow,
  StudentDataRow,
  UpdateChallengeInput,
} from "./types";

interface BoardPayload {
  users: StudentDataRow[];
  challenges: Awaited<ReturnType<DataRepository["listChallenges"]>>;
  examples: ExampleDataRow[];
  completions: CompletionDataRow[];
}

export class NasRepository implements DataRepository {
  private boardCache: { promise: Promise<BoardPayload>; expiresAt: number } | null = null;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly boardCacheMs = 250,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${serverEnv.nasApiBaseUrl}${path}`, {
      ...init,
      headers: {
        authorization: "Bearer " + serverEnv.nasApiServiceToken,
        "content-type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw Object.assign(new Error(`NAS API request failed (${response.status})`), {
        status: response.status,
      });
    }
    const payload = await response.json() as T & { ok?: unknown };
    if (payload && typeof payload === "object" && "ok" in payload && payload.ok !== true) {
      throw new Error("NAS API returned an invalid success response");
    }
    return payload;
  }

  private async requestNullable<T>(path: string, init: RequestInit): Promise<T | null> {
    try {
      return await this.request<T>(path, init);
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
      throw error;
    }
  }

  private mutationInit(method: "POST" | "PATCH" | "DELETE", body: unknown): RequestInit {
    return { method, body: JSON.stringify(body) };
  }

  private invalidateBoard(): void {
    this.boardCache = null;
  }

  private async board() {
    if (this.boardCache && this.boardCache.expiresAt > this.now()) return this.boardCache.promise;

    const entry = {
      expiresAt: Number.POSITIVE_INFINITY,
      promise: this.request<{ ok: true; data: BoardPayload }>("/v1/board").then((response) => response.data),
    };
    this.boardCache = entry;
    entry.promise.then(
      () => { entry.expiresAt = this.now() + this.boardCacheMs; },
      () => { if (this.boardCache === entry) this.boardCache = null; },
    );
    return entry.promise;
  }

  async listStudents() {
    return (await this.board()).users;
  }

  async listChallenges() {
    return (await this.board()).challenges;
  }

  async listExamples() {
    return (await this.board()).examples;
  }

  async listCompletions(userId?: string) {
    const rows = (await this.board()).completions;
    return userId ? rows.filter((row) => row.user_id === userId) : rows;
  }

  async findUserByNickname(nickname: string) {
    const response = await this.request<{
      ok: true;
      user: { id: string; nickname: string; role: string; password_hash: string | null } | null;
    }>("/v1/auth/lookup", {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
    return response.user;
  }

  async toggleCompletion(input: { userId: string; challengeId: string; done: boolean }) {
    await this.request("/v1/completions/toggle", this.mutationInit("POST", input));
    this.invalidateBoard();
  }

  async createStudent(input: { nickname: string; passwordHash: string }) {
    const response = await this.request<{
      ok: true;
      student: {
        id: string;
        nickname: string;
        anonymous_label: string | null;
        anonymous_index: number | null;
      };
    }>("/v1/admin/students", this.mutationInit("POST", input));
    this.invalidateBoard();
    return response.student;
  }

  async updateStudentPassword(input: { id: string; passwordHash: string }) {
    const response = await this.requestNullable<{ ok: true; student: { id: string; nickname: string } }>(
      "/v1/admin/students",
      this.mutationInit("PATCH", input),
    );
    return response?.student ?? null;
  }

  async deleteStudent(id: string) {
    const response = await this.requestNullable<{ ok: true; student: { id: string; nickname: string } }>(
      "/v1/admin/students",
      this.mutationInit("DELETE", { id }),
    );
    if (response) this.invalidateBoard();
    return response?.student ?? null;
  }

  async createChallenge(input: CreateChallengeInput) {
    const response = await this.request<{ ok: true; challenge: Record<string, unknown> }>(
      "/v1/admin/challenges",
      this.mutationInit("POST", input),
    );
    this.invalidateBoard();
    return response.challenge;
  }

  async updateChallenge(input: UpdateChallengeInput) {
    const response = await this.requestNullable<{ ok: true; challenge: Record<string, unknown> }>(
      "/v1/admin/challenges",
      this.mutationInit("PATCH", input),
    );
    if (response) this.invalidateBoard();
    return response?.challenge ?? null;
  }
}
