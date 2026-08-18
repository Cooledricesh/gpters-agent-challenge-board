import "server-only";

import { serverEnv } from "@/lib/env";
import { NasRepository } from "./nas-repository";
import type { DataRepository } from "./types";

let singleton: DataRepository | undefined;

/** Reads and writes always use the NAS API as the sole authoritative backend. */
export function getDataRepository(): DataRepository {
  singleton ??= new NasRepository();
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
  DataRepository,
  ExampleDataRow,
  StudentDataRow,
  UpdateChallengeInput,
} from "./types";
