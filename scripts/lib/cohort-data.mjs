/**
 * cohort-data.mjs — export/reset 스크립트 공용 헬퍼.
 *
 * - .env.local을 직접 파싱한다(신규 의존성 없이). Next 런타임 밖에서 도는 일회성 스크립트라
 *   src/lib/env.ts(브라우저/서버 분리 로직)를 끌어오지 않는다.
 * - 가중치는 src/lib/progress.ts와 동일해야 한다. 한 곳(여기)에서만 정의하고 양쪽 스크립트가 쓴다.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "..", "..");

// src/lib/progress.ts와 동일: 기본 1점, 고급 1.25점.
export const BASIC_CHALLENGE_WEIGHT = 1;
export const ADVANCED_CHALLENGE_WEIGHT = 1.25;

export function challengeWeight(level) {
  return level === "advanced" ? ADVANCED_CHALLENGE_WEIGHT : BASIC_CHALLENGE_WEIGHT;
}

/** "챌린저 01" 형식. src/lib/progress.ts makeAnonymousLabel와 동일. */
export function makeAnonymousLabel(index) {
  return `챌린저 ${String(Math.trunc(index)).padStart(2, "0")}`;
}

/** .env.local을 읽어 { KEY: value } 객체로 돌려준다. 따옴표/주석/빈 줄 처리. */
export function loadEnvLocal() {
  const path = resolve(REPO_ROOT, ".env.local");
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** 서비스 롤 클라이언트 생성(RLS 우회). 스크립트 전용. */
export function makeServiceClient() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      ".env.local에 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Supabase 응답에서 에러면 throw, 아니면 data를 돌려준다. */
export function unwrap(result, what) {
  if (result.error) {
    throw new Error(`${what} 조회 실패: ${result.error.message}`);
  }
  return result.data ?? [];
}
