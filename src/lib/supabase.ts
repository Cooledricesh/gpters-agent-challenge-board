/**
 * supabase.ts — Supabase 클라이언트 팩토리.
 *
 * 두 종류 분리:
 *   - getSupabaseAnonClient(): 공개 키 사용. 읽기 전용 페이지(공개 진행률 등)에서 사용.
 *     RLS 정책에 의존하므로 SELECT 권한이 열려 있어야 한다.
 *   - getSupabaseServiceClient(): 서비스 롤 키 사용. RLS 우회. 관리자 mutation·인증 검증 등
 *     서버 전용 코드에서만 호출. 클라이언트 번들에 절대 포함시키지 말 것.
 *
 * 두 함수 모두 호출마다 새 클라이언트를 만든다(Next 서버 컴포넌트의 요청 단위 라이프사이클).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "./env";

export function getSupabaseAnonClient(): SupabaseClient {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseServiceClient(): SupabaseClient {
  return createClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
