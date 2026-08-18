import "server-only";

import { serverEnv } from "@/lib/env";
import { NasRepository } from "./nas-repository";
import { SupabaseRepository } from "./supabase-repository";
import type { DataBackend, DataRepository } from "./types";

export function createDataRepository(backend: DataBackend): DataRepository {
  return backend === "nas" ? new NasRepository() : new SupabaseRepository();
}

let singleton: DataRepository | undefined;
let singletonBackend: DataBackend | undefined;

/** Reads and writes always use the same authoritative backend. */
export function getDataRepository(): DataRepository {
  const backend = serverEnv.dataBackend;
  if (!singleton || singletonBackend !== backend) {
    singleton = createDataRepository(backend);
    singletonBackend = backend;
  }
  return singleton;
}

export function requireMutationsEnabled(): void {
  if (serverEnv.mutationsPaused) {
    throw Object.assign(new Error("mutations_paused"), { code: "mutations_paused" });
  }
}

export function isMutationsPausedError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === "mutations_paused";
}

export type {
  CompletionDataRow,
  CreateChallengeInput,
  DataBackend,
  DataRepository,
  ExampleDataRow,
  StudentDataRow,
  UpdateChallengeInput,
} from "./types";
