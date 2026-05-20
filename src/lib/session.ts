/**
 * session.ts — Next.js 서버 컴포넌트·route handler에서 현재 세션 조회.
 *
 * Next 16의 `cookies()`는 비동기 함수. 반드시 await.
 * Reference: node_modules/next/dist/docs/01-app 가이드의 동적 API 변경사항.
 */

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./auth";

/** 현재 세션 페이로드 또는 null. 비로그인·만료·위조 모두 null. */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/** 수강생/관리자 페이지 가드용 헬퍼. role 일치 확인. */
export async function requireSession(role?: "student" | "admin"): Promise<SessionPayload | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (role && session.role !== role) return null;
  return session;
}
