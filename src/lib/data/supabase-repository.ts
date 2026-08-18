import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase";
import {
  mapChallenge,
  shouldFallbackToLegacyChallengeShape,
  type RawChallengeRow,
} from "@/lib/load-challenges";
import { makeAnonymousLabel, nextAnonymousIndex } from "@/lib/progress";
import type {
  CompletionDataRow,
  CreateChallengeInput,
  DataRepository,
  ExampleDataRow,
  StudentDataRow,
  UpdateChallengeInput,
} from "./types";

function failure(message: string | undefined, fallback: string) {
  return new Error(message ?? fallback);
}

export class SupabaseRepository implements DataRepository {
  constructor(protected readonly client: SupabaseClient = getSupabaseServiceClient()) {}

  async listStudents() {
    const { data, error } = await this.client
      .from("app_users")
      .select("id, nickname, role, anonymous_label, anonymous_index")
      .eq("role", "student");
    if (error) throw error;
    return (data ?? []) as StudentDataRow[];
  }

  async listChallenges() {
    const shapes = [
      {
        columns: "id, title, description, detail, order_index, level, area, tier, prerequisite_id",
        orderByTier: true,
      },
      { columns: "id, title, description, detail, order_index, level, area", orderByTier: false },
      { columns: "id, title, description, detail, order_index, level", orderByTier: false },
      { columns: "id, title, description, order_index", orderByTier: false },
    ];
    let lastError: Error | null = null;
    for (const shape of shapes) {
      let query = this.client.from("challenges").select(shape.columns);
      if (shape.orderByTier) query = query.order("tier", { ascending: true });
      const result = await query
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (!result.error) {
        return ((result.data ?? []) as unknown as RawChallengeRow[]).map((row) =>
          mapChallenge(shape.columns.includes("level") ? row : { ...row, level: "basic" }),
        );
      }
      lastError = result.error;
      if (!shouldFallbackToLegacyChallengeShape(result.error)) throw result.error;
    }
    throw lastError ?? new Error("challenge_load_failed");
  }

  async listExamples() {
    const { data, error } = await this.client
      .from("challenge_examples")
      .select("id, challenge_id, title, summary, source_url, source_author")
      .order("challenge_id", { ascending: true })
      .order("order_index", { ascending: true });
    if (error) return [];
    return (data ?? []) as ExampleDataRow[];
  }

  async listCompletions(userId?: string) {
    let query = this.client.from("completions").select("id, user_id, challenge_id, completed_at");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CompletionDataRow[];
  }

  async findUserByNickname(nickname: string) {
    const { data, error } = await this.client
      .from("app_users")
      .select("id, nickname, role, password_hash")
      .eq("nickname", nickname)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async toggleCompletion({ userId, challengeId, done }: { userId: string; challengeId: string; done: boolean }) {
    if (done) {
      const { error } = await this.client
        .from("completions")
        .upsert({ user_id: userId, challenge_id: challengeId }, {
          onConflict: "user_id,challenge_id",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      return;
    }
    const { error } = await this.client
      .from("completions")
      .delete()
      .eq("user_id", userId)
      .eq("challenge_id", challengeId);
    if (error) throw error;
  }

  async createStudent({ nickname, passwordHash }: { nickname: string; passwordHash: string }) {
    const [{ data: duplicate, error: duplicateError }, { data: indexRows, error: indexError }] = await Promise.all([
      this.client.from("app_users").select("id").eq("nickname", nickname).maybeSingle(),
      this.client.from("app_users").select("anonymous_index").eq("role", "student"),
    ]);
    if (duplicateError) throw duplicateError;
    if (duplicate) throw Object.assign(new Error("nickname_conflict"), { code: "nickname_conflict" });
    if (indexError) throw indexError;
    const nextIndex = nextAnonymousIndex(
      ((indexRows ?? []) as { anonymous_index: number | null }[]).map((row) => row.anonymous_index),
    );
    const { data, error } = await this.client
      .from("app_users")
      .insert({
        nickname,
        role: "student",
        password_hash: passwordHash,
        anonymous_index: nextIndex,
        anonymous_label: makeAnonymousLabel(nextIndex),
      })
      .select("id, nickname, anonymous_label, anonymous_index")
      .single();
    if (error || !data) throw failure(error?.message, "student_create_failed");
    return data;
  }

  async updateStudentPassword({ id, passwordHash }: { id: string; passwordHash: string }) {
    const { data, error } = await this.client
      .from("app_users")
      .update({ password_hash: passwordHash })
      .eq("id", id)
      .eq("role", "student")
      .select("id, nickname")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteStudent(id: string) {
    const { data, error } = await this.client
      .from("app_users")
      .delete()
      .eq("id", id)
      .eq("role", "student")
      .select("id, nickname")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async createChallenge(input: CreateChallengeInput): Promise<Record<string, unknown>> {
    const { data: maxRow, error: maxError } = await this.client
      .from("challenges")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;
    const { data, error } = await this.client
      .from("challenges")
      .insert({
        title: input.title,
        description: input.description ?? null,
        detail: input.detail ?? null,
        order_index: (maxRow?.order_index ?? 0) + 1,
        level: input.level ?? "basic",
        area: input.area ?? null,
        ...(input.tier !== undefined ? { tier: input.tier } : {}),
        ...(input.prerequisiteId !== undefined ? { prerequisite_id: input.prerequisiteId } : {}),
      })
      .select("id, title, order_index, level, detail, area, tier, prerequisite_id")
      .single();
    if (error || !data) throw failure(error?.message, "challenge_create_failed");
    return data;
  }

  async updateChallenge({ id, prerequisiteId, ...input }: UpdateChallengeInput): Promise<Record<string, unknown> | null> {
    const update = {
      ...input,
      ...(prerequisiteId !== undefined ? { prerequisite_id: prerequisiteId } : {}),
    };
    const { data, error } = await this.client
      .from("challenges")
      .update(update)
      .eq("id", id)
      .select("id, title, description, detail, level, area, tier, prerequisite_id")
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
