/**
 * auth.ts — 비밀번호 해싱·검증, 세션 JWT 발급·검증.
 *
 * 비밀번호 정책:
 *   - 수강생: 관리자가 직접 지정한 비밀번호를 bcrypt로 해싱해 app_users.password_hash 저장.
 *   - 관리자: ADMIN_PASSWORD env(기본 "5231"). 시드 시점에 동일하게 해시 저장.
 *
 * 세션 정책:
 *   - jose의 HS256 JWT. 7일 만료.
 *   - payload: { sub: userId, nickname, role }.
 *   - 쿠키 이름은 SESSION_COOKIE_NAME. httpOnly·sameSite=lax·secure(production).
 */

import { SignJWT, jwtVerify } from "jose";
import * as bcrypt from "bcryptjs";

import { serverEnv } from "./env";

export const SESSION_COOKIE_NAME = "gpters_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7d

export type SessionRole = "student" | "admin";

export interface SessionPayload {
  sub: string;
  nickname: string;
  role: SessionRole;
}

/** bcrypt 라운드 — 서버 부하·보안 균형(10). */
const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length === 0) {
    throw new Error("비밀번호가 비어 있습니다.");
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function getSessionKey(): Uint8Array {
  return new TextEncoder().encode(serverEnv.sessionSecret);
}

/** 세션 JWT 발급. 만료 7일 고정. */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionKey());
}

/**
 * 세션 JWT 검증. 만료·서명 불일치 시 null 반환(예외 던지지 않음 — 미들웨어 친화).
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const nickname = typeof payload.nickname === "string" ? payload.nickname : null;
    const roleRaw = typeof payload.role === "string" ? payload.role : null;
    if (!sub || !nickname || (roleRaw !== "student" && roleRaw !== "admin")) return null;
    return { sub, nickname, role: roleRaw };
  } catch {
    return null;
  }
}

/** Next route handler에서 쿠키 옵션을 만들 때 사용. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
